import Docker from "dockerode";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative } from "node:path";
import { createLogger } from "./logger";
import { setUpdateLastCheck } from "./DataManager";

const log = createLogger("UPDATER");

export type UpdatePhase = "idle" | "checking" | "applying";

export type UpdateState = {
	phase: UpdatePhase;
	lastCheckedAt: Date | null;
	updateAvailable: boolean | null;
	currentImageId: string | null;
	newImageId: string | null;
	error: string | null;
};

const state: UpdateState = {
	phase: "idle",
	lastCheckedAt: null,
	updateAvailable: null,
	currentImageId: null,
	newImageId: null,
	error: null,
};

const HELPER_PROJECT_DIRECTORY = "/compose-project";

type ComposeProject = {
	projectName: string;
	projectDirectory: string;
	configFiles: string[];
};

function shellQuote(value: string): string {
	return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

/**
 * Builds the commands executed by the short-lived updater container. The
 * complete project is deliberately pulled and recreated: updating only this
 * service can leave linked services on an incompatible image version.
 */
export function buildComposeUpdateCommand(project: ComposeProject): string {
	const composeFiles = project.configFiles.map((configFile) => {
		const pathFromProject = relative(project.projectDirectory, configFile);
		if (pathFromProject === "" || pathFromProject.startsWith("..") || isAbsolute(pathFromProject)) {
			throw new Error("Docker Compose config file is outside the Compose project directory");
		}
		return `-f ${shellQuote(`${HELPER_PROJECT_DIRECTORY}/${pathFromProject}`)}`;
	});

	const compose = [
		"docker compose",
		`-p ${shellQuote(project.projectName)}`,
		`--project-directory ${shellQuote(HELPER_PROJECT_DIRECTORY)}`,
		...composeFiles,
	].join(" ");

	return `${compose} pull && ${compose} up -d --force-recreate`;
}

function getComposeProject(labels: Record<string, string>): ComposeProject | null {
	const projectName = labels["com.docker.compose.project"];
	const configFiles = labels["com.docker.compose.project.config_files"]
		?.split(",")
		.map((path) => path.trim())
		.filter(Boolean);
	if (!projectName || !configFiles?.length) return null;

	// Compose v2 provides this label. Deriving it keeps updates working for
	// containers created by older Compose releases.
	const projectDirectory = labels["com.docker.compose.project.working_dir"] || dirname(configFiles[0]);
	return { projectName, projectDirectory, configFiles };
}

export function getUpdateState(): Readonly<UpdateState> {
	return { ...state };
}

export function updateWasApplied(
	lastCheck: Pick<UpdateState, "updateAvailable" | "currentImageId">,
	runningImageId: string,
): boolean {
	return lastCheck.updateAvailable === true && runningImageId !== lastCheck.currentImageId;
}

export function hydrateUpdateState(lastCheck: { checkedAt: string; updateAvailable: boolean; currentImageId: string; newImageId: string | null }): void {
	state.lastCheckedAt = new Date(lastCheck.checkedAt);
	state.updateAvailable = lastCheck.updateAvailable;
	state.currentImageId = lastCheck.currentImageId;
	state.newImageId = lastCheck.newImageId;
}

/**
 * Reconcile the persisted check result with the image that is actually
 * running. The updater process is replaced during a successful self-update,
 * so the in-memory state from before the restart is not available afterwards.
 */
export async function reconcileUpdateState(lastCheck: {
	checkedAt: string;
	updateAvailable: boolean;
	currentImageId: string;
	newImageId: string | null;
}): Promise<void> {
	try {
		const docker = new Docker();
		const selfId = await getSelfContainerId(docker);
		if (!selfId) {
			hydrateUpdateState(lastCheck);
			return;
		}

		const selfInfo = await docker.getContainer(selfId).inspect();
		// As in checkForUpdate, use the container's immutable image ID instead
		// of resolving its mutable image tag in the local image cache.
		const runningImageId = selfInfo.Image;
		if (!runningImageId) throw new Error("Could not determine the running container image ID");
		// The helper pulls again immediately before recreation, so the selected
		// tag can advance between Check and Update Now. Any image different from
		// the one that was running when an update was found is therefore a
		// successful update, even if it is newer than the originally observed SHA.
		const updateApplied = updateWasApplied(lastCheck, runningImageId);

		if (updateApplied) {
			const reconciled = {
				checkedAt: new Date().toISOString(),
				updateAvailable: false,
				currentImageId: runningImageId,
				newImageId: null,
			};
			hydrateUpdateState(reconciled);
			await setUpdateLastCheck(reconciled);
			return;
		}

		hydrateUpdateState(lastCheck);
	} catch (err) {
		// Startup must remain available if Docker introspection is unavailable.
		log.warn({ err }, "Could not reconcile persisted update state");
		hydrateUpdateState(lastCheck);
	}
}

async function getSelfContainerId(docker: Docker): Promise<string | null> {
	try {
		const cgroup = await readFile("/proc/self/cgroup", "utf-8");
		for (const line of cgroup.split("\n")) {
			// cgroup v1: 12:pids:/docker/<id>
			const v1 = line.match(/\/docker\/([a-f0-9]{64})/);
			if (v1) return v1[1];
			// cgroup v2: 0::/system.slice/docker-<id>.scope
			const v2 = line.match(/docker-([a-f0-9]{64})\.scope/);
			if (v2) return v2[1];
		}
	} catch {
		// Not in a container or /proc unavailable
	}

	// Fallback: hostname is the short container ID in default Docker setups
	const hostname = process.env.HOSTNAME ?? "";
	if (/^[a-f0-9]{12}$/.test(hostname)) {
		try {
			const containers = await docker.listContainers();
			const self = containers.find((c) => c.Id.startsWith(hostname));
			if (self) return self.Id;
		} catch {
			// ignore
		}
	}

	return null;
}

export async function checkForUpdate(): Promise<{ updateAvailable: boolean; currentImageId: string; newImageId: string | null }> {
	if (state.phase !== "idle") {
		throw new Error("An update operation is already in progress");
	}

	state.phase = "checking";
	state.error = null;

	try {
		const docker = new Docker();

		const selfId = await getSelfContainerId(docker);
		if (!selfId) throw new Error("Could not determine own container ID — not running inside Docker?");

		const selfInfo = await docker.getContainer(selfId).inspect();
		const imageName = selfInfo.Config.Image;

		log.info({ imageName }, "Checking for update");

		// Container.Image is immutable for the lifetime of a container. Looking
		// up imageName here is incorrect because its mutable tag may already have
		// been moved by a previous pull while this container still runs the old
		// SHA.
		const currentImageId = selfInfo.Image;
		if (!currentImageId) throw new Error("Could not determine the running container image ID");

		// Pull — uses host Docker daemon credentials; fast if nothing changed
		const pullStream = await docker.pull(imageName);
		await new Promise<void>((resolve, reject) => {
			docker.modem.followProgress(pullStream, (err: Error | null) => {
				if (err) reject(err);
				else resolve();
			});
		});

		const newImg = await docker.getImage(imageName).inspect();
		const newImageId = newImg.Id;

		const updateAvailable = currentImageId !== newImageId;

		state.phase = "idle";
		state.lastCheckedAt = new Date();
		state.updateAvailable = updateAvailable;
		state.currentImageId = currentImageId;
		state.newImageId = updateAvailable ? newImageId : null;

		await setUpdateLastCheck({
			checkedAt: state.lastCheckedAt.toISOString(),
			updateAvailable,
			currentImageId: state.currentImageId,
			newImageId: state.newImageId,
		});

		log.info({ updateAvailable, currentImageId, newImageId }, "Update check complete");

		return {
			updateAvailable,
			currentImageId: state.currentImageId,
			newImageId: state.newImageId,
		};
	} catch (err) {
		state.phase = "idle";
		state.error = err instanceof Error ? err.message : String(err);
		log.error({ err }, "Update check failed");
		throw err;
	}
}

export async function applyUpdate(): Promise<{ method: "compose" | "raw" }> {
	if (state.phase !== "idle") {
		throw new Error("An update operation is already in progress");
	}
	if (!state.updateAvailable || !state.newImageId) {
		throw new Error("No update available to apply — run a check first");
	}

	state.phase = "applying";
	state.error = null;

	const docker = new Docker();
	const newImageId = state.newImageId;

	try {
		const selfId = await getSelfContainerId(docker);
		if (!selfId) throw new Error("Could not determine own container ID");

		const selfInfo = await docker.getContainer(selfId).inspect();
		const labels = selfInfo.Config.Labels ?? {};

		const composeProject = getComposeProject(labels);

		if (composeProject) {
			const composeCommand = buildComposeUpdateCommand(composeProject);
			log.info(
				{ projectDirectory: composeProject.projectDirectory, projectName: composeProject.projectName },
				"Applying update via docker compose helper",
			);

			// Run Compose outside of the container it recreates. Mounting the whole
			// project, rather than just the YAML file, also makes env_file and
			// secondary Compose files available to the helper.
			setImmediate(async () => {
				try {
					// Ensure docker:cli is available (pull if necessary)
					try {
						const stream = await docker.pull("docker:cli");
						await new Promise<void>((resolve, reject) => {
							docker.modem.followProgress(stream, (err: Error | null) => {
								if (err) reject(err);
								else resolve();
							});
						});
					} catch (pullErr) {
						log.warn({ err: pullErr }, "Could not pull docker:cli — attempting with existing local image");
					}

					const helper = await docker.createContainer({
						Image: "docker:cli",
						Cmd: [
							"sh",
							"-c",
							// Wait for the API response to be delivered before recreating
							`sleep 3 && ${composeCommand}`,
						],
						HostConfig: {
							AutoRemove: true,
							Binds: [
								"/var/run/docker.sock:/var/run/docker.sock",
								`${composeProject.projectDirectory}:${HELPER_PROJECT_DIRECTORY}:ro`,
							],
						},
						WorkingDir: HELPER_PROJECT_DIRECTORY,
					});

					await helper.start();
					log.info({ helperId: helper.id }, "Compose helper container started");
					const result = await helper.wait();
					if (result.StatusCode !== 0) {
						throw new Error(`Docker Compose update failed with exit code ${result.StatusCode}`);
					}
					state.phase = "idle";
				} catch (err) {
					state.phase = "idle";
					state.error = err instanceof Error ? err.message : String(err);
					log.error({ err }, "Compose update failed");
				}
			});

			return { method: "compose" };
		}

		// Fallback: raw container recreation without compose
		log.warn("Container not managed by docker compose — using raw recreation");

		setImmediate(async () => {
			try {
				await rawRecreate(docker, selfId, selfInfo, newImageId);
			} catch (err) {
				state.phase = "idle";
				state.error = err instanceof Error ? err.message : String(err);
				log.error({ err }, "Raw container recreation failed");
			}
		});

		return { method: "raw" };
	} catch (err) {
		state.phase = "idle";
		state.error = err instanceof Error ? err.message : String(err);
		throw err;
	}
}

async function rawRecreate(
	docker: Docker,
	selfId: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	selfInfo: any,
	newImageId: string,
): Promise<void> {
	const name = (selfInfo.Name as string).replace(/^\//, "");

	const createOpts = {
		Image: newImageId,
		Env: (selfInfo.Config.Env as string[]) ?? [],
		Labels: (selfInfo.Config.Labels as Record<string, string>) ?? {},
		Cmd: (selfInfo.Config.Cmd as string[] | null) ?? undefined,
		Entrypoint: (selfInfo.Config.Entrypoint as string[] | null) ?? undefined,
		WorkingDir: selfInfo.Config.WorkingDir as string,
		HostConfig: {
			Binds: (selfInfo.HostConfig.Binds as string[]) ?? [],
			NetworkMode: (selfInfo.HostConfig.NetworkMode as string) ?? "bridge",
			PortBindings: selfInfo.HostConfig.PortBindings ?? {},
			RestartPolicy: selfInfo.HostConfig.RestartPolicy ?? { Name: "always", MaximumRetryCount: 0 },
		},
	};

	const newContainer = await docker.createContainer({ ...createOpts, name: `${name}_update_${Date.now()}` });
	log.info({ newContainerId: newContainer.id }, "New container created — stopping old container");

	// Stopping ourselves sends SIGTERM; ensure the new container is created before that.
	await new Promise((r) => setTimeout(r, 3000));
	await docker.getContainer(selfId).stop({ t: 15 });
	await docker.getContainer(selfId).remove();

	await newContainer.start();
	await newContainer.rename({ name });

	log.info("Raw container recreation complete");
}
