import { Function } from "@prisma/client";
import Docker from "dockerode";
import { PassThrough } from "stream";
import { createHash } from "crypto";
import type { Dirent } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "..";
import { createLogger } from "./logger";
import { getCacheDir, getFunctionAppDir, getFunctionExecutionsDir } from "./StoragePaths";
import { getRuntimeType } from "./RunnerUtils";
import { getRuntimeImageStatus } from "./RunnerImagePulls";
import { mergeEnvironmentVariables, parseStoredEnvironmentVariables, toDockerEnvironment } from "./EnvironmentVariables";

const log = createLogger("Runner");
const INIT_FINGERPRINT_FILE = ".shsf_init_fingerprint";

async function pathExists(targetPath: string): Promise<boolean> {
	try {
		await fs.access(targetPath);
		return true;
	} catch {
		return false;
	}
}

async function addFingerprintFile(
	hash: ReturnType<typeof createHash>,
	root: string,
	relativePath: string,
): Promise<void> {
	hash.update(`file:${relativePath}\0`);
	try {
		hash.update(await fs.readFile(path.join(root, relativePath)));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		hash.update("<missing>");
	}
	hash.update("\0");
}

async function collectGoSourceFiles(root: string, relativeDir = ""): Promise<string[]> {
	let entries: Dirent[];
	try {
		entries = await fs.readdir(path.join(root, relativeDir), { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}

	const files: string[] = [];
	for (const entry of entries) {
		if (entry.isSymbolicLink()) continue;
		const relativePath = path.join(relativeDir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name === ".git") continue;
			files.push(...await collectGoSourceFiles(root, relativePath));
		} else if (entry.isFile() && entry.name.endsWith(".go")) {
			files.push(relativePath);
		}
	}
	return files.sort();
}

function getInitArtifactPaths(
	funcAppDir: string,
	functionIdStr: string,
	runtimeType: ReturnType<typeof getRuntimeType>,
): string[] {
	switch (runtimeType) {
		case "python":
			return [
				path.join(getCacheDir("pip", "venv"), `function-${functionIdStr}`),
				path.join(funcAppDir, ".shsf_env"),
			];
		case "node":
			return [
				path.join(getCacheDir("node", "modules"), `function-${functionIdStr}`, "node_modules"),
				path.join(funcAppDir, "node_modules"),
				path.join(funcAppDir, ".shsf_env"),
			];
		case "golang":
			return [
				path.join(getCacheDir("go", "bin"), `function-${functionIdStr}`, "_shsf_runner"),
				path.join(funcAppDir, "_shsf_runner"),
				path.join(funcAppDir, ".shsf_env"),
			];
		default:
			return [];
	}
}

/**
 * Fingerprints every host-visible input init.sh depends on. When it matches the
 * fingerprint recorded after the last successful init, running init again would
 * only repeat hash checks and installs, so the host can skip it entirely.
 */
export async function computeInitFingerprint(
	funcAppDir: string,
	functionIdStr: string,
	runtimeType: ReturnType<typeof getRuntimeType>,
): Promise<string> {
	const hash = createHash("sha256");
	hash.update(`runtime:${runtimeType}\0`);
	await addFingerprintFile(hash, funcAppDir, "init.sh");

	if (runtimeType === "python") {
		await addFingerprintFile(hash, funcAppDir, "requirements.txt");
	} else if (runtimeType === "node") {
		await addFingerprintFile(hash, funcAppDir, "package.json");
		await addFingerprintFile(hash, funcAppDir, "package-lock.json");
	} else if (runtimeType === "golang") {
		await addFingerprintFile(hash, funcAppDir, "go.mod");
		await addFingerprintFile(hash, funcAppDir, "go.sum");
		for (const relativePath of await collectGoSourceFiles(funcAppDir)) {
			await addFingerprintFile(hash, funcAppDir, relativePath);
		}
	}

	for (const artifactPath of getInitArtifactPaths(funcAppDir, functionIdStr, runtimeType)) {
		hash.update(`artifact:${artifactPath}:${await pathExists(artifactPath) ? "present" : "missing"}\0`);
	}

	return hash.digest("hex");
}

async function readInitFingerprint(funcAppDir: string): Promise<string | null> {
	try {
		return (await fs.readFile(path.join(funcAppDir, INIT_FINGERPRINT_FILE), "utf8")).trim();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

async function writeInitFingerprint(funcAppDir: string, fingerprint: string): Promise<void> {
	const markerPath = path.join(funcAppDir, INIT_FINGERPRINT_FILE);
	const tempPath = `${markerPath}.tmp`;
	await fs.mkdir(funcAppDir, { recursive: true });
	await fs.writeFile(tempPath, fingerprint);
	await fs.rename(tempPath, markerPath);
}

export async function getRuntimeEnvironment(functionData: Pick<Function, "env" | "userId">) {
	const accountData = await prisma.user.findUnique({
		where: { id: functionData.userId },
		select: { account_env: true },
	});

	return toDockerEnvironment(
		mergeEnvironmentVariables(
			parseStoredEnvironmentVariables(accountData?.account_env),
			parseStoredEnvironmentVariables(functionData.env),
		),
	);
}

async function isContainerReady(container: Docker.Container, since: number): Promise<boolean> {
	try {
		const output = await container.logs({
			stdout: true,
			stderr: false,
			follow: false,
			since,
		});
		const data = (output as unknown as Buffer).toString("utf8");
		return data.includes("[SHSF] Container ready.");
	} catch {
		return false;
	}
}

export async function prepareRunnerContainer({ docker, functionData, id, functionIdStr, containerName, runtimeType, mark, trace }: {
	docker: Docker; functionData: Function; id: number; functionIdStr: string; containerName: string;
	runtimeType: ReturnType<typeof getRuntimeType>; mark: (description: string) => void; trace: (message: string) => void;
}) {
	let container = docker.getContainer(containerName);
	let containerCreated = false;
	const funcAppDir = getFunctionAppDir(functionIdStr);
	try {
		const inspectInfo = await container.inspect();
		if (!inspectInfo.State.Running) {
			await container.start();
			mark("Container start");
		} else {
			trace("Reusing running container");
		}

		// Init is only needed when its inputs or runtime artifacts changed. The
		// container's start command already ran init successfully on creation. A
		// matching fingerprint means another run would only repeat hash checks.
		if (
			runtimeType === "python" ||
			runtimeType === "golang" ||
			runtimeType === "node"
		) {
			const fingerprint = await computeInitFingerprint(funcAppDir, functionIdStr, runtimeType);
			const appliedFingerprint = await readInitFingerprint(funcAppDir);

			if (appliedFingerprint === fingerprint) {
				trace("Init inputs unchanged — skipping init");
				mark("Init skipped (unchanged)");
			} else {
				const initExec = await container.exec({
					Cmd: ["/bin/sh", "/app/init.sh"],
					AttachStdout: true,
					AttachStderr: true,
				});
				const initStream = await initExec.start({ hijack: true, stdin: false });
				const initOutput = { stdout: "", stderr: "" };

				const initStdout = new PassThrough();
				const initStderr = new PassThrough();

				initStdout.on("data", (chunk) => {
					initOutput.stdout += chunk.toString("utf8");
				});
				initStderr.on("data", (chunk) => {
					initOutput.stderr += chunk.toString("utf8");
				});

				docker.modem.demuxStream(initStream, initStdout, initStderr);

				await new Promise<void>((resolve) => {
					initStream.on("end", resolve);
				});

				const initInspect = await initExec.inspect();
				log.debug({ functionId: functionData.id }, `Init output: ${initOutput.stderr}`);
				if ((initInspect.ExitCode ?? 0) === 0) {
					// Recompute after init: Go's `go mod tidy` can update go.mod/go.sum.
					await writeInitFingerprint(
						funcAppDir,
						await computeInitFingerprint(funcAppDir, functionIdStr, runtimeType),
					);
				} else {
					log.warn({ functionId: functionData.id, exitCode: initInspect.ExitCode }, "Init script failed; init will run again on the next invocation");
				}
				mark(
					runtimeType === "python"
						? "Python init/install"
						: runtimeType === "golang"
							? "Go init/rebuild"
							: "Node.js init/install",
				);
			}
		}
	} catch (error: any) {
		if (error.statusCode === 404) {
			trace("Container not found — creating");
			containerCreated = true;

			const pipCacheHost = getCacheDir("pip");
			const goCacheHost = getCacheDir("go");
			const nodeCacheHost = getCacheDir("node");
			await Promise.all([
				fs.mkdir(pipCacheHost, { recursive: true }),
				fs.mkdir(goCacheHost, { recursive: true }),
				fs.mkdir(nodeCacheHost, { recursive: true }),
			]);

			// Mount /app and /executions separately instead of the old /function_data
			const BINDS: string[] = [
				`${getFunctionAppDir(functionIdStr)}:/app`,
				`${getFunctionExecutionsDir(functionIdStr)}:/executions`,
			];

			if (functionData.docker_mount) {
				BINDS.push("/var/run/docker.sock:/var/run/docker.sock"); // Mount Docker socket
			}

			if (runtimeType === "python") {
				BINDS.push(`${pipCacheHost}:/pip-cache`);
			} else if (runtimeType === "golang") {
				BINDS.push(`${goCacheHost}:/go-cache`);
			} else if (runtimeType === "node") {
				BINDS.push(`${nodeCacheHost}:/node-cache`);
			} else {
				throw new Error(
					`Unsupported runtime type for container BIND setup: ${runtimeType}`
				);
			}

			const imageStatus = await getRuntimeImageStatus(functionData.image, {
				listImages: (image) =>
					docker.listImages({
						filters: JSON.stringify({ reference: [image] }),
					}),
				pullImage: async (image) => {
					const pullStream = await docker.pull(image);
					await new Promise<void>((resolve, reject) => {
						docker.modem.followProgress(pullStream, (err) =>
							err ? reject(err) : resolve(),
						);
					});
				},
			});
			if (imageStatus === "pulling") {
				return { status: "pulling" as const };
			}

			const runtimeEnv = await getRuntimeEnvironment(functionData);

			container = await docker.createContainer({
				Image: functionData.image,
				name: containerName,
				Env: runtimeEnv,
				HostConfig: {
					Binds: BINDS,
					AutoRemove: false,
					Memory: (functionData.max_ram || 128) * 1024 * 1024,
					...(functionData.network_restricted && {
						NetworkMode: "none",
					}),
				},
				Cmd: [
					"/bin/sh",
					"-c",
					"/app/init.sh && echo '[SHSF] Container ready.' && tail -f /dev/null",
				],
				Tty: false,
			});
			await container.start();
			mark("Container start + init");
		} else {
			// Some other error inspecting container
			throw error;
		}
	}

	// Block execution if the container has not yet finished initializing (init.sh still running)
	const containerInspect = await container.inspect();
	const containerStartedAt = new Date(containerInspect.State.StartedAt).getTime() / 1000;
	if (!await isContainerReady(container, containerStartedAt)) {
		log.warn({ functionId: id }, "Container not ready — blocking execution");
		return { status: "not-ready" as const };
	}

	// A newly created container ran init as part of its start command. The ready
	// marker proves it succeeded, so record the post-init inputs.
	if (containerCreated) {
		await writeInitFingerprint(
			funcAppDir,
			await computeInitFingerprint(funcAppDir, functionIdStr, runtimeType),
		);
	}

	return { status: "ready" as const, container };
}
