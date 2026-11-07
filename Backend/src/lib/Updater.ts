import Docker from "dockerode";
import { readFile } from "node:fs/promises";
import type { UpdateOperation, UpdateOperationPhase, UpdateOperationStatus } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { createLogger } from "./logger";
import { getUpdateLastCheck, setUpdateLastCheck } from "./DataManager";
import {
	HELPER_EXIT_ROLLED_BACK,
	UPDATE_TIMEOUTS,
	buildHelperScript,
	parseHelperOutput,
	registryAuth,
	resolveComposeLayout,
	resolveTrackedRef,
	type ComposeLayout,
} from "./UpdaterCompose";

/**
 * Self-update state machine. Every update is a durable `UpdateOperation` row
 * (see prisma/schema.prisma) that always ends in completed / failed /
 * cancelled / rolled_back:
 *
 *   preflight -> pull -> [helper container] replacement -> migration ->
 *   verification -> completion, or rollback -> (rolled_back | failure)
 *
 * This process only prepares things (inspect, pull, start helper). The helper
 * (UpdaterCompose.buildHelperScript) outlives this process, replaces just the
 * app service, verifies readiness and rolls back. Whichever backend process is
 * alive then reads the helper's exit code + output and persists the outcome;
 * after a restart `recoverOperations` resumes that.
 */

const log = createLogger("UPDATER");

export { UPDATE_TIMEOUTS };

export class UpdateBusyError extends Error {}
export class UpdateNotCancellableError extends Error {}

const OUTPUT_CAP = 60_000;
const LOG_CAP = 20_000;
const DOCKER_SOCKET = "/var/run/docker.sock";

export type OperationView = {
	id: string;
	status: UpdateOperationStatus;
	phase: UpdateOperationPhase;
	trigger: string;
	imageRef: string | null;
	fromImageId: string | null;
	fromDigest: string | null;
	toImageId: string | null;
	toDigest: string | null;
	helperContainerId: string | null;
	exitCode: number | null;
	error: string | null;
	startedAt: string;
	updatedAt: string;
	finishedAt: string | null;
	deadlineAt: string;
	log?: string;
	helperOutput?: string;
};

export function serializeOperation(row: UpdateOperation, withOutput = false): OperationView {
	return {
		id: row.id,
		status: row.status,
		phase: row.phase,
		trigger: row.trigger,
		imageRef: row.imageRef,
		fromImageId: row.fromImageId,
		fromDigest: row.fromDigest,
		toImageId: row.toImageId,
		toDigest: row.toDigest,
		helperContainerId: row.helperContainerId,
		exitCode: row.exitCode,
		error: row.error,
		startedAt: row.startedAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		finishedAt: row.finishedAt?.toISOString() ?? null,
		deadlineAt: row.deadlineAt.toISOString(),
		...(withOutput ? { log: row.log ?? "", helperOutput: row.helperOutput ?? "" } : {}),
	};
}

// ---------------------------------------------------------------- persistence

const controllers = new Map<string, AbortController>(); // operations still cancellable (before the helper starts)
const monitors = new Set<string>();
let checking = false;
let starting = false;
// Operations between row creation and a registered monitor: recovery must not touch them.
const launching = new Set<string>();
// ponytail: busy-state is per process. Fine for the single backend; a second replica would
// need a DB-level uniqueness guard on running operations.

const isTerminal = (status: UpdateOperationStatus) => status !== "running";

/** Updates only while the operation is still running, so a terminal state is never overwritten. */
async function patch(id: string, data: Parameters<typeof prisma.updateOperation.updateMany>[0]["data"]): Promise<boolean> {
	const result = await prisma.updateOperation.updateMany({ where: { id, status: "running" }, data });
	return result.count > 0;
}

async function note(id: string, message: string): Promise<void> {
	log.info({ operationId: id }, message);
	const row = await prisma.updateOperation.findUnique({ where: { id }, select: { log: true } });
	const next = `${row?.log ? `${row.log}\n` : ""}[${new Date().toISOString()}] ${message}`.slice(-LOG_CAP);
	await patch(id, { log: next });
}

async function finish(
	id: string,
	status: Exclude<UpdateOperationStatus, "running">,
	data: { error?: string | null; exitCode?: number | null; phase?: UpdateOperationPhase },
): Promise<boolean> {
	const phase = data.phase ?? (status === "completed" ? "completion" : status === "rolled_back" ? "rollback" : "failure");
	const done = await patch(id, { ...data, status, phase, finishedAt: new Date() });
	if (done) log.info({ operationId: id, status, error: data.error }, "Update operation finished");
	return done;
}

export async function getOperation(id: string): Promise<UpdateOperation | null> {
	return prisma.updateOperation.findUnique({ where: { id } });
}

export async function listOperations(limit = 10): Promise<UpdateOperation[]> {
	return prisma.updateOperation.findMany({ orderBy: { startedAt: "desc" }, take: limit });
}

export async function getActiveOperation(): Promise<UpdateOperation | null> {
	return prisma.updateOperation.findFirst({ where: { status: "running" }, orderBy: { startedAt: "desc" } });
}

/** True when an operation for this image already failed or was rolled back; auto-update must not retry it forever. */
export async function hasFailedAttempt(imageId: string): Promise<boolean> {
	const row = await prisma.updateOperation.findFirst({
		// Only attempts that reached the replacement (a helper existed) count; a pull error must not block the image forever.
		where: { toImageId: imageId, status: { in: ["failed", "rolled_back"] }, helperContainerId: { not: null } },
		select: { id: true },
	});
	return row !== null;
}

export async function getUpdateStatus() {
	const [active, recent, lastCheck] = await Promise.all([getActiveOperation(), listOperations(1), getUpdateLastCheck()]);
	const operation = active ?? recent[0] ?? null;
	return { checking, applying: starting || active !== null, operation: operation && serializeOperation(operation), lastCheck };
}

// -------------------------------------------------------------------- docker

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

async function inspectSelf(docker: Docker) {
	const selfId = await getSelfContainerId(docker);
	if (!selfId) throw new Error("Could not determine own container ID — not running inside Docker?");
	const info = await docker.getContainer(selfId).inspect();
	// Container.Image is the immutable image ID the container was created from.
	// Resolving the mutable tag instead would give the wrong answer after a pull.
	if (!info.Image) throw new Error("Could not determine the running container image ID");
	return info;
}

/** Turns Docker's pull errors into something an admin can act on. */
export function describePullError(ref: string, err: unknown, timedOut: boolean): Error {
	if (timedOut) return new Error(`Pulling ${ref} timed out after ${UPDATE_TIMEOUTS.pullMs / 1000}s`);
	const message = err instanceof Error ? err.message : String(err);
	if (/unauthorized|denied|authentication required|\b401\b|\b403\b|no basic auth/i.test(message)) {
		return new Error(
			`Registry authentication failed while pulling ${ref}: ${message}. ` +
				"Set UPDATE_REGISTRY_USERNAME and UPDATE_REGISTRY_PASSWORD (and UPDATE_REGISTRY_SERVER if needed).",
		);
	}
	return new Error(`Pulling ${ref} failed: ${message}`);
}

async function pullImage(docker: Docker, ref: string, signal?: AbortSignal, trackedRef: string = ref): Promise<void> {
	const timeout = AbortSignal.timeout(UPDATE_TIMEOUTS.pullMs);
	const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
	try {
		const stream = await docker.pull(ref, { authconfig: registryAuth(ref, env, trackedRef), abortSignal: combined });
		await new Promise<void>((resolve, reject) => {
			combined.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
			docker.modem.followProgress(stream, (err: Error | null) => (err ? reject(err) : resolve()));
		});
	} catch (err) {
		if (signal?.aborted) throw new Error("Update cancelled");
		throw describePullError(ref, err, timeout.aborted);
	}
}

function digestFor(ref: string, repoDigests: string[] | undefined): string | null {
	const repo = ref.replace(/@.*$/, "").replace(/:[^/:]+$/, "");
	return repoDigests?.find((d) => d.startsWith(`${repo}@`))?.split("@")[1] ?? null;
}

function networkOf(info: Docker.ContainerInspectInfo): string {
	const name = Object.keys(info.NetworkSettings?.Networks ?? {})[0] ?? info.HostConfig?.NetworkMode ?? "bridge";
	return name === "default" ? "bridge" : name;
}

// --------------------------------------------------------------------- check

export type CheckResult = { updateAvailable: boolean; currentImageId: string; newImageId: string | null; imageRef: string };

export async function checkForUpdate(): Promise<CheckResult> {
	if (checking || starting) throw new UpdateBusyError("An update operation is already in progress");
	checking = true; // set before any await so concurrent callers cannot both pass the guard
	try {
		if (await getActiveOperation()) throw new UpdateBusyError("An update operation is already in progress");
		const docker = new Docker();
		const self = await inspectSelf(docker);
		const imageRef = resolveTrackedRef(env, self.Config.Labels ?? {}, self.Config.Image);
		log.info({ imageRef }, "Checking for update");

		await pullImage(docker, imageRef);
		const newImageId = (await docker.getImage(imageRef).inspect()).Id;
		const updateAvailable = self.Image !== newImageId;

		await setUpdateLastCheck({
			checkedAt: new Date().toISOString(),
			updateAvailable,
			currentImageId: self.Image,
			newImageId: updateAvailable ? newImageId : null,
		});
		log.info({ updateAvailable, currentImageId: self.Image, newImageId }, "Update check complete");
		return { updateAvailable, currentImageId: self.Image, newImageId: updateAvailable ? newImageId : null, imageRef };
	} finally {
		checking = false;
	}
}

// --------------------------------------------------------------------- apply

/**
 * Starts an update and returns its durable operation ID immediately. Success is
 * only ever reported by the operation reaching `completed`, which requires the
 * replacement to pass the readiness checks.
 */
export async function applyUpdate(trigger: "manual" | "auto" = "manual"): Promise<{ operationId: string }> {
	if (checking || starting) throw new UpdateBusyError("An update operation is already in progress");
	starting = true; // set before any await so concurrent callers cannot both pass the guard
	try {
		await recoverOperations();
		if (await getActiveOperation()) throw new UpdateBusyError("An update operation is already in progress");
		const row = await prisma.updateOperation.create({
			data: { trigger, deadlineAt: new Date(Date.now() + UPDATE_TIMEOUTS.operationMs) },
		});
		const controller = new AbortController();
		controllers.set(row.id, controller);
		launching.add(row.id);
		setImmediate(() => {
			void runOperation(row.id, controller);
		});
		return { operationId: row.id };
	} finally {
		starting = false;
	}
}

async function runOperation(id: string, controller: AbortController): Promise<void> {
	try {
		const docker = new Docker();

		await note(id, "Preflight: inspecting the running container and Compose layout");
		const self = await inspectSelf(docker);
		const labels = self.Config.Labels ?? {};
		const layout = resolveComposeLayout(labels, env);
		const imageRef = resolveTrackedRef(env, labels, self.Config.Image);
		const fromImage = await docker.getImage(self.Image).inspect().catch(() => null);
		await patch(id, { imageRef, fromImageId: self.Image, fromDigest: digestFor(imageRef, fromImage?.RepoDigests) });

		await patch(id, { phase: "pull" });
		await note(id, `Pulling ${imageRef}`);
		await pullImage(docker, imageRef, controller.signal);
		const target = await docker.getImage(imageRef).inspect();
		await patch(id, { toImageId: target.Id, toDigest: digestFor(imageRef, target.RepoDigests) });
		if (target.Id === self.Image) {
			await note(id, "Already running the latest image; nothing to do");
			await finish(id, "completed", {});
			return;
		}

		await note(id, `Preparing helper image ${env.UPDATE_HELPER_IMAGE}`);
		try {
			await pullImage(docker, env.UPDATE_HELPER_IMAGE, controller.signal, imageRef);
		} catch (err) {
			if (controller.signal.aborted) throw err;
			// Offline or private mirror: a locally present helper image is enough.
			await docker.getImage(env.UPDATE_HELPER_IMAGE).inspect().catch(() => {
				throw err;
			});
			await note(id, `Could not refresh the helper image, using the local copy: ${err instanceof Error ? err.message : err}`);
		}

		const network = networkOf(self);
		const script = buildHelperScript({
			layout,
			oldImageId: self.Image,
			newImageId: target.Id,
			trackedRef: imageRef,
			network,
			port: env.PORT,
			composeSeconds: UPDATE_TIMEOUTS.composeSeconds,
			readinessSeconds: UPDATE_TIMEOUTS.readinessSeconds,
		});

		// ponytail: cancellation ends here. Once Compose has started recreating the
		// service, interrupting the helper could strand a half-replaced project.
		if (controller.signal.aborted) throw new Error("Update cancelled");
		controllers.delete(id);
		await startHelper(docker, id, layout, script, network);
		void monitorOperation(id);
		launching.delete(id);
	} catch (err) {
		controllers.delete(id);
		launching.delete(id);
		const cancelled = controller.signal.aborted;
		const message = err instanceof Error ? err.message : String(err);
		log.error({ err, operationId: id }, "Update operation failed before replacement");
		await finish(id, cancelled ? "cancelled" : "failed", { error: cancelled ? "Cancelled by an administrator" : message });
	}
}

async function startHelper(docker: Docker, id: string, layout: ComposeLayout, script: string, network: string): Promise<void> {
	const helper = await docker.createContainer({
		Image: env.UPDATE_HELPER_IMAGE,
		Cmd: ["sh", "-c", script],
		Tty: true, // single raw stream, no multiplexing to decode
		Labels: { "shsf.update.operation": id },
		HostConfig: {
			// Not AutoRemove: the exit code and output must outlive the helper.
			// The directory is mounted at the same path so relative paths and
			// bind mounts in the Compose files resolve identically on the host.
			Binds: [`${DOCKER_SOCKET}:${DOCKER_SOCKET}`, `${layout.projectDirectory}:${layout.projectDirectory}:ro`],
			// Same network as the app, so the helper can reach the replacement's port.
			NetworkMode: network,
		},
	});
	await patch(id, { helperContainerId: helper.id, phase: "replacement" });
	await note(id, `Starting helper container ${helper.id.slice(0, 12)}`);
	try {
		await helper.start();
	} catch (err) {
		await helper.remove({ force: true }).catch(() => undefined);
		throw err;
	}
}

// ------------------------------------------------------------------- monitor

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readHelper(docker: Docker, containerId: string) {
	const container = docker.getContainer(containerId);
	const info = await container.inspect();
	const raw = (await container.logs({ stdout: true, stderr: true, tail: 1000 })) as unknown;
	return { info, output: Buffer.from(raw as Buffer).toString("utf-8").slice(-OUTPUT_CAP) };
}

/**
 * Follows the helper until it exits, mirroring its phase into the database and
 * persisting the final outcome. Safe to run from any backend process: the
 * outcome only depends on the helper container and the row.
 */
export async function monitorOperation(id: string): Promise<void> {
	if (monitors.has(id)) return;
	monitors.add(id);
	try {
		const docker = new Docker();
		let deadline = Number.POSITIVE_INFINITY;
		for (;;) {
			try {
				const row = await getOperation(id);
				if (!row || isTerminal(row.status)) return;
				deadline = row.deadlineAt.getTime();
				if (!row.helperContainerId) {
					await finish(id, "failed", { error: "The backend restarted before the update helper was started" });
					return;
				}

				let helper: Awaited<ReturnType<typeof readHelper>>;
				try {
					helper = await readHelper(docker, row.helperContainerId);
				} catch (err) {
					// Only a definitive 404 means the helper is gone; anything else is a daemon hiccup.
					if ((err as { statusCode?: number }).statusCode !== 404) throw err;
					await finish(id, "failed", { error: `The update helper container is gone: ${err instanceof Error ? err.message : String(err)}` });
					return;
				}

				const progress = parseHelperOutput(helper.output);
				await patch(id, {
					helperOutput: helper.output,
					...(progress.phase && progress.phase !== row.phase ? { phase: progress.phase } : {}),
				});

				// "created" is a helper that has not been started yet, not a finished one.
				const status = helper.info.State.Status;
				if (!helper.info.State.Running && status !== "created") {
					await settle(id, row, helper.info.State.ExitCode, progress);
					void docker.getContainer(row.helperContainerId).remove({ force: true }).catch(() => undefined);
					return;
				}
			} catch (err) {
				log.warn({ err, operationId: id }, "Update monitor hit an error; retrying until the operation deadline");
			}
			if (Date.now() > deadline) {
				await finish(id, "failed", {
					error: `The update exceeded its ${UPDATE_TIMEOUTS.operationMs / 60000} minute limit; the helper container was left in place for inspection`,
				});
				return;
			}
			await sleep(UPDATE_TIMEOUTS.pollMs);
		}
	} catch (err) {
		log.error({ err, operationId: id }, "Update monitor crashed; will retry on next recovery");
	} finally {
		monitors.delete(id);
	}
}

async function settle(id: string, row: UpdateOperation, exitCode: number, progress: ReturnType<typeof parseHelperOutput>): Promise<void> {
	if (progress.result === "completed" && exitCode === 0) {
		await finish(id, "completed", { exitCode });
		if (row.toImageId) {
			await setUpdateLastCheck({
				checkedAt: new Date().toISOString(),
				updateAvailable: false,
				currentImageId: row.toImageId,
				newImageId: null,
			});
		}
		return;
	}
	const reason = progress.reason ?? `The update helper exited with code ${exitCode}`;
	if (exitCode === HELPER_EXIT_ROLLED_BACK && progress.result === "rolled_back") {
		await finish(id, "rolled_back", { exitCode, error: `The new version failed its checks and the previous version was restored: ${reason}` });
		return;
	}
	await finish(id, "failed", { exitCode, error: reason });
}

/**
 * Called at startup and before each new update. Resumes monitoring of
 * operations whose helper survived a restart and fails ones that cannot
 * finish (the backend died before the helper existed).
 */
export async function recoverOperations(): Promise<void> {
	const stale = await prisma.updateOperation.findMany({ where: { status: "running" } });
	for (const row of stale) {
		if (monitors.has(row.id) || controllers.has(row.id) || launching.has(row.id)) continue;
		if (row.helperContainerId) void monitorOperation(row.id);
		else await finish(row.id, "failed", { error: "Interrupted by a backend restart before the replacement started" });
	}
}

export async function cancelUpdate(id: string): Promise<void> {
	const controller = controllers.get(id);
	if (!controller) {
		const row = await getOperation(id);
		if (!row) throw new Error("Operation not found");
		throw new UpdateNotCancellableError(
			isTerminal(row.status) ? "The operation has already finished" : "The replacement has already started and can no longer be cancelled",
		);
	}
	controller.abort();
}

// ----------------------------------------------------------------- reconcile

export function updateWasApplied(
	lastCheck: { updateAvailable: boolean; currentImageId: string },
	runningImageId: string,
): boolean {
	return lastCheck.updateAvailable === true && runningImageId !== lastCheck.currentImageId;
}

/**
 * Startup hook. Resumes operations, then reconciles the stored check result
 * with the image that is actually running, e.g. after a manual `compose up`.
 */
export async function initUpdater(): Promise<void> {
	try {
		await recoverOperations();
		const lastCheck = await getUpdateLastCheck();
		if (!lastCheck) return;
		const self = await inspectSelf(new Docker());
		if (updateWasApplied(lastCheck, self.Image)) {
			await setUpdateLastCheck({
				checkedAt: new Date().toISOString(),
				updateAvailable: false,
				currentImageId: self.Image,
				newImageId: null,
			});
		}
	} catch (err) {
		// Startup must remain available if Docker introspection is unavailable.
		log.warn({ err }, "Could not recover or reconcile update state");
	}
}
