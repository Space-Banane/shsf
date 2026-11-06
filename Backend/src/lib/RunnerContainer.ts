import { Function } from "@prisma/client";
import Docker from "dockerode";
import { PassThrough } from "stream";
import * as fs from "fs/promises";
import { prisma } from "..";
import { createLogger } from "./logger";
import { getCacheDir, getFunctionAppDir, getFunctionExecutionsDir } from "./StoragePaths";
import { getRuntimeType } from "./RunnerUtils";
import { getRuntimeImageStatus } from "./RunnerImagePulls";
import { mergeEnvironmentVariables, parseStoredEnvironmentVariables, toDockerEnvironment } from "./EnvironmentVariables";

const log = createLogger("Runner");

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
	try {
		const inspectInfo = await container.inspect();
		if (!inspectInfo.State.Running) {
			await container.start();
			mark("Container start");
		} else {
			trace("Reusing running container");
		}

		// Python dependencies are kept in a per-function venv. Re-run init for
		// existing containers so a changed requirements.txt is detected by its hash.
		if (
			runtimeType === "python" ||
			runtimeType === "golang" ||
			runtimeType === "node"
		) {
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

			log.debug({ functionId: functionData.id }, `Init output: ${initOutput.stderr}`);
			mark(
				runtimeType === "python"
					? "Python init/install"
					: runtimeType === "golang"
						? "Go init/rebuild"
						: "Node.js init/install",
			);
		}
	} catch (error: any) {
		if (error.statusCode === 404) {
			trace("Container not found — creating");

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

	return { status: "ready" as const, container };
}
