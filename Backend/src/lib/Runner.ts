import Docker from "dockerode";
import * as fs from "fs/promises";
import * as path from "path";
import { HttpRequestContext } from "rjweb-server";
import { DataContext } from "rjweb-server/lib/typings/types/internal";
import { UsableMiddleware } from "rjweb-server/lib/typings/classes/Middleware";
import { createLogger } from "./logger";
import { getFunctionAppDir } from "./StoragePaths";
import { generatePythonDependencyInstallScript } from "./RunnerRuntimeScripts";
import { getRuntimeEnvironment } from "./RunnerContainer";
export { executeFunction } from "./RunnerInvocation";
export { persistFunctionExecutionLog } from "./RunnerExecutionLog";
export type { PersistedFunctionExecutionLogInput } from "./RunnerTypes";
export { deleteContainerForFunction, cleanupFunctionContainer } from "./RunnerCleanup";
const log = createLogger("Runner");

/* eslint-disable @typescript-eslint/no-empty-object-type */
export async function buildPayloadFromGET(
	ctr: DataContext<
		"HttpRequest",
		"GET",
		HttpRequestContext<{}>,
		UsableMiddleware<{}>[]
	>
): Promise<{
	headers: Record<string, string>;
	queries: Record<string, string>;
	source_ip: string;
	route: string | "default";
	method: string;
}> {
	return {
		headers: Object.fromEntries(ctr.headers.entries()),
		queries: Object.fromEntries(ctr.queries.entries()),
		source_ip: ctr.client.ip.usual(),
		route: ctr.params.get("route") || "default",
		method: "GET",
	};
}

export async function buildPayloadFromPOST(
	ctr: DataContext<
		"HttpRequest",
		"POST",
		HttpRequestContext<{}>,
		UsableMiddleware<{}>[]
	>
): Promise<{
	headers: Record<string, string>;
	body: string;
	queries: Record<string, string>;
	source_ip: string;
	route: string | "default";
	raw_body: string;
	method: string;
}> {
	return {
		headers: Object.fromEntries(ctr.headers.entries()),
		queries: Object.fromEntries(ctr.queries.entries()),
		body: await ctr.rawBody("utf-8"),
		raw_body: await ctr.rawBody("binary"),
		source_ip: ctr.client.ip.usual(),
		route: ctr.params.get("route") || "default",
		method: "POST",
	};
}
/* eslint-enable @typescript-eslint/no-empty-object-type */

export async function installDependencies(
	functionId: number,
	functionData: any,
	files: any[]
): Promise<boolean | 404> {
	const docker = new Docker();
	const functionIdStr = String(functionId);
	const containerName = `shsf_func_${functionIdStr}`;

	try {
		const container = docker.getContainer(containerName);
		const requirementsFile = files.find(
			(file) => file.name === "requirements.txt",
		);

		// Function files are normally synced immediately before execution. The
		// explicit install action must do the same, otherwise it can silently
		// install the previous version of requirements.txt from /app.
		if (requirementsFile && !functionData.git_url) {
			const requirementsPath = path.join(
				getFunctionAppDir(functionId),
				requirementsFile.name,
			);
			await fs.mkdir(path.dirname(requirementsPath), { recursive: true });
			await fs.writeFile(requirementsPath, requirementsFile.content);
		}

		try {
			const inspectInfo = await container.inspect();
			if (!inspectInfo.State.Running) {
				await container.start();
			}
		} catch (error: any) {
			if (error.statusCode === 404) {
				return 404; // We cant run it, as we dont know what it does.
			} else {
				throw error;
			}
		}

		const execEnv = await getRuntimeEnvironment(functionData);

		log.info({ functionId }, "Starting dependency installation");

		const exec = await container.exec({
			Cmd: [
				"/bin/sh",
				"-c",
				generatePythonDependencyInstallScript(functionId),
			],
			Env: execEnv,
			AttachStdout: true,
			AttachStderr: true,
			Tty: false,
		});

		log.debug({ functionId }, "Exec command created for dependency installation");

		const execStream = await exec.start({ hijack: true, stdin: false });

		log.debug({ functionId }, "Exec stream started for dependency installation");

		// Consume the stream to completion (required for exec to finish)
		await new Promise<void>((resolve, reject) => {
			execStream.on("end", () => {
				resolve();
			});
			execStream.on("error", (error) => {
				reject(error);
			});
			// Drain the stream
			execStream.resume();
		});

		// Inspect the exec to get the exit code
		const inspect = await exec.inspect();
		log.debug({ functionId, exitCode: inspect.ExitCode }, "Exec inspection completed");

		if (inspect.ExitCode === 0) {
			log.info({ functionId }, "Dependency installation completed successfully");
			return true;
		} else {
			log.error({ functionId, exitCode: inspect.ExitCode }, "Dependency installation failed");
			return false;
		}
	} catch (error) {
		log.error({ err: error }, "Error installing dependencies");
		return false;
	}
}
