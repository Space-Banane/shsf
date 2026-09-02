import { Function, FunctionFile } from "@prisma/client";
import Docker from "dockerode";
import { PassThrough } from "stream"; // Added PassThrough
import { prisma } from "..";
import { HttpRequestContext } from "rjweb-server";
import { DataContext } from "rjweb-server/lib/typings/types/internal";
import { UsableMiddleware } from "rjweb-server/lib/typings/classes/Middleware";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import { getLoggingConfigFromData, stripHeadersFromPayload } from "./FunctionLogging";
import { replaceApiBaseInContent } from "./FileHelpers";
import { createLogger } from "./logger";
import type { LoggedExecutionRateLimitData } from "./FunctionRateLimit";

const log = createLogger("Runner");

import {
	getCacheDir,
	getFunctionAppDir,
	getFunctionBaseDir,
	getFunctionExecutionDir,
	getFunctionExecutionsDir,
} from "./StoragePaths";

import type {
	TimingEntry,
	PersistedFunctionExecutionLogInput,
} from "./RunnerTypes";
export type { PersistedFunctionExecutionLogInput };
import {
	ServeOnlyFileNotFoundHTML,
} from "./RunnerTypes";

import {
	truncateDbField,
	getRuntimeType,
	isHtmlStartupFile,
	parseExecutionPayloadRoute,
	resolveServeOnlyHtmlFileName,
	findFileByNameIgnoreCase,
} from "./RunnerUtils";

import {
	DbComScriptPY,
	DbComScriptGO,
	DbComScriptJS,
	CallFuncScriptPY,
	CallFuncScriptGO,
	CallFuncScriptJS,
} from "./RunnerScripts";

import {
	getRunnerTransportPaths,
	prepareRunnerTransport,
	readRunnerResult,
	revokeLegacyFunctionDbTokens,
	startStorageRpcBridge,
	startCallFuncBridge,
} from "./RunnerTransport";

import {
	generateGoRunnerWrapperCode,
	generatePythonRunnerScript,
	generateGoRunnerShScript,
	generatePythonInitBody,
	generateGoInitBody,
	generateNodeJsRunnerScript,
	generateNodeJsRunnerShScript,
	generateNodeJsInitBody,
} from "./RunnerRuntimeScripts";
import {
	mergeEnvironmentVariables,
	parseStoredEnvironmentVariables,
	toDockerEnvironment,
} from "./EnvironmentVariables";
import { getRuntimeImageStatus } from "./RunnerImagePulls";

async function getRuntimeEnvironment(functionData: Pick<Function, "env" | "userId">) {
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

export async function persistFunctionExecutionLog(
	input: PersistedFunctionExecutionLogInput,
) {
	const loggingConfig = await getLoggingConfigFromData(input.functionData.logging);
	if (!loggingConfig.enabled && !input.force) {
		return;
	}

	let disableResult = false;
	let disableResultReason = "";
	let payloadForDb = input.payload ?? JSON.stringify(null);
	const resultForDb =
		typeof input.output === "string" && input.output !== ""
			? input.output
			: JSON.stringify(null);
	const containsBase64TransportEnvelope =
		/"__shsf_transport"\s*:\s*"base64-bytes-v1"/.test(resultForDb);

	if (loggingConfig.enabled && loggingConfig.hide_payload_headers) {
		payloadForDb = await stripHeadersFromPayload(payloadForDb);
	}

	if (isHtmlStartupFile(input.functionData.startup_file)) {
		disableResult = true;
		disableResultReason = "HTML content detected in startup file";
	}

	if (resultForDb.includes("<!DOCTYPE html>") || resultForDb.includes("<html")) {
		disableResult = true;
		disableResultReason = "HTML content detected in result";
	}

	if (containsBase64TransportEnvelope) {
		disableResult = true;
		disableResultReason = "Base64 transport envelope detected in result";
	}

	await prisma.triggerLog.create({
		data: {
			functionId: input.functionId,
			logs: truncateDbField(input.logs),
			result: JSON.stringify({
				exit_code: input.exit_code,
				tooks: input.tooks ?? [],
				output: disableResult ? disableResultReason : truncateDbField(resultForDb),
				payload: truncateDbField(payloadForDb),
				...(input.ratelimit ? { ratelimit: input.ratelimit } : {}),
				...(input.error_type ? { error_type: input.error_type } : {}),
			}),
		},
	});
}

export async function executeFunction(
	id: number,
	functionData: Function,
	files: FunctionFile[],
	stream:
		| { enabled: true; onChunk: (data: string) => void }
		| { enabled: false },
	payload: string,
	options?: {
		ratelimit?: LoggedExecutionRateLimitData;
	},
) {
	const starting_time = Date.now();
	const tooks: TimingEntry[] = [];
	let func_result: string = "";
	let logs: string = "";

	// mark() — records a user-facing timing phase into tooks
	let _lastMark = starting_time;
	const mark = (description: string) => {
		const now = Date.now();
		const value = (now - _lastMark) / 1000;
		tooks.push({ timestamp: now, value, description });
		_lastMark = now;
		log.debug({ description, durationSeconds: value.toFixed(3) }, "Execution phase");
	};

	// trace() — internal trace, does NOT appear in tooks
	const trace = (msg: string) => log.trace(msg);

	// Serve Only HTML (serve-only)
	if (isHtmlStartupFile(functionData.startup_file)) {
		const requestedHtmlFileName = resolveServeOnlyHtmlFileName(
			functionData.startup_file,
			parseExecutionPayloadRoute(payload),
		);
		const requestedHtmlFile = requestedHtmlFileName
			? findFileByNameIgnoreCase(files, requestedHtmlFileName)
			: undefined;
		const rawHtml = requestedHtmlFile?.content || ServeOnlyFileNotFoundHTML;
		const replacedHtml =
			typeof rawHtml === "string"
				? (replaceApiBaseInContent(
						rawHtml,
						functionData.namespaceId,
						functionData.executionId,
					) as string)
			: rawHtml;
		const responseCode = requestedHtmlFile ? 200 : 404;
		const servedFile = requestedHtmlFileName ?? "invalid-route";

		return {
			logs: `Serve Only HTML function executed (${servedFile}).`,
			result: {
				_shsf: "v2",
				_headers: { "Content-Type": "text/html; charset=utf-8" },
				_code: responseCode,
				_res: replacedHtml,
			},
			tooks: [
				{
					description: `Serve Only HTML function executed (${servedFile}).`,
					value: 0,
					timestamp: starting_time,
				},
			] as TimingEntry[],
			exit_code: 0,
		};
	}

	const docker = new Docker();
	const functionIdStr = String(functionData.id);
	const containerName = `shsf_func_${functionIdStr}`;
	const funcAppDir = getFunctionAppDir(functionIdStr);
	const runtimeType = getRuntimeType(functionData.image);
	let exitCode = 0;

	// Generate a unique execution ID for this request to avoid race conditions
	// Use crypto.randomUUID() for better uniqueness if available, otherwise fallback
	const executionId =
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
			? crypto.randomUUID()
			: `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
	const executionDir = getFunctionExecutionDir(functionIdStr, executionId);
	const transportPaths = getRunnerTransportPaths(executionDir);

	// Define startupFile and initScript here as they are needed for script generation
	const startupFile = functionData.startup_file;

	let initScript =
		"#!/bin/sh\nset -e\necho '[SHSF INIT] Starting environment setup...'\ncd /app\n";
	let containerNotReady = false;

	try {
		let container = docker.getContainer(containerName);

		await fs.mkdir(funcAppDir, { recursive: true });
		await prepareRunnerTransport(transportPaths);
		await revokeLegacyFunctionDbTokens();

		// Skip writing User files when git version control is active (git_url is set)
		if (!functionData.git_url) {
			// Write files to disk
			await Promise.all(
				files.map(async (file) => {
					const filePath = path.join(funcAppDir, file.name);
					await fs.mkdir(path.dirname(filePath), { recursive: true });
					let content: string | Buffer = file.content as any;
					if (typeof content === "string") {
						content = replaceApiBaseInContent(content, functionData.namespaceId, functionData.executionId);
					}
					await fs.writeFile(filePath, content as any);
				})
			);
			mark(`Write user files (${files.length})`);
		} else {
			log.info({ functionId: functionData.id }, "[GIT] Git source active — skipping DB file writes");
			mark(`Skip DB file writes (git_url set)`);
		}

		// For Go runtime, generate the runner wrapper file and go.mod if needed
		if (runtimeType === "golang") {
			await fs.writeFile(path.join(funcAppDir, "shsf_runner.go"), generateGoRunnerWrapperCode());

			const goModPath = path.join(funcAppDir, "go.mod");
			if (!fsSync.existsSync(goModPath)) {
				await fs.writeFile(goModPath, `module shsf_function_${functionData.id}\n\ngo 1.23\n`);
			}
			trace("Go runner wrapper written");
		}

		// Always generate/update the runner script to accept payload file path as argument
		if (runtimeType === "python") {
			const wrapperPath = path.join(funcAppDir, "_runner.py");
			await fs.writeFile(wrapperPath, generatePythonRunnerScript(startupFile ?? "main"));
			await fs.chmod(wrapperPath, "755");
			trace("Python runner script written");
		} else if (runtimeType === "golang") {
			const wrapperPath = path.join(funcAppDir, "_runner.sh");
			await fs.writeFile(wrapperPath, generateGoRunnerShScript());
			await fs.chmod(wrapperPath, "755");
			trace("Go runner script written");  // intermediate — mark fires after init.sh below
		} else if (runtimeType === "node") {
			const jsRunnerPath = path.join(funcAppDir, "_shsf_runner.js");
			await fs.writeFile(jsRunnerPath, generateNodeJsRunnerScript(startupFile ?? "index.js"));
			const shWrapperPath = path.join(funcAppDir, "_runner.sh");
			await fs.writeFile(shWrapperPath, generateNodeJsRunnerShScript());
			await fs.chmod(shWrapperPath, "755");
			trace("Node.js runner scripts written");
		} else {
			log.warn({ runtimeType, functionId: functionData.id }, "Runner script generation skipped: unsupported runtime type");
		}

		// Always generate/update the init.sh script
		if (runtimeType === "python") {
			initScript += generatePythonInitBody(functionData.id, {
				ffmpeg_install: functionData.ffmpeg_install,
				opencv_install: functionData.opencv_install,
			});
		} else if (runtimeType === "golang") {
			initScript += generateGoInitBody(functionData.id, { ffmpeg_install: functionData.ffmpeg_install });
		} else if (runtimeType === "node") {
			initScript += generateNodeJsInitBody(functionData.id, { ffmpeg_install: functionData.ffmpeg_install });
		} else {
			// This was already checked for runner script, but as a safeguard for init.sh:
			log.warn({ runtimeType, functionId: functionData.id }, "init.sh script generation skipped: unsupported runtime type");
		}

		initScript +=
			"\necho '[SHSF INIT] Environment setup finished successfully.'\n";
		await fs.writeFile(path.join(funcAppDir, "init.sh"), initScript);
		await fs.chmod(path.join(funcAppDir, "init.sh"), "755");
		mark("Generate scripts"); // runner script(s) + init.sh

		const requiresDbCom = files.some((f) => f.content.includes("_db_com") || f.content.includes("dbcom"));
		if (requiresDbCom) {
			if (runtimeType === "python") {
				await fs.writeFile(path.join(funcAppDir, "_db_com.py"), DbComScriptPY);
				await fs.chmod(path.join(funcAppDir, "_db_com.py"), "755");
			} else if (runtimeType === "golang") {
				const dbComDir = path.join(funcAppDir, "dbcom");
				await fs.mkdir(dbComDir, { recursive: true });
				await fs.writeFile(path.join(dbComDir, "dbcom.go"), DbComScriptGO);
			} else if (runtimeType === "node") {
				await fs.writeFile(path.join(funcAppDir, "_db_com.js"), DbComScriptJS);
			}
			mark("Storage helper script");
		}

		// Always inject the callF helper so functions can call each other without
		// any conditional check — the scripts are small and immediately available.
		if (runtimeType === "python") {
			await fs.writeFile(path.join(funcAppDir, "_call_func.py"), CallFuncScriptPY);
			await fs.chmod(path.join(funcAppDir, "_call_func.py"), "755");
		} else if (runtimeType === "golang") {
			const callFuncDir = path.join(funcAppDir, "callfunc");
			await fs.mkdir(callFuncDir, { recursive: true });
			await fs.writeFile(path.join(callFuncDir, "callfunc.go"), CallFuncScriptGO);
		} else if (runtimeType === "node") {
			await fs.writeFile(path.join(funcAppDir, "_call_func.js"), CallFuncScriptJS);
		}

		try {
			const inspectInfo = await container.inspect();
			if (!inspectInfo.State.Running) {
				await container.start();
				mark("Container start");
			} else {
				trace("Reusing running container");
			}

			if (runtimeType === "golang" || runtimeType === "node") {
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
				mark(runtimeType === "golang" ? "Go init/rebuild" : "Node.js init/install");
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
					const message = `Runtime image ${functionData.image} is being prepared. Please retry in a few moments.`;
					containerNotReady = true;
					exitCode = -10;
					return {
						logs: message,
						result: { _shsf: "v2" as const, _code: 503, _res: message },
						tooks: [
							{
								description: "Runtime image is being prepared",
								value: (Date.now() - starting_time) / 1000,
								timestamp: Date.now(),
							},
						],
						exit_code: exitCode,
					};
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
						...((functionData as any).network_restricted && {
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
			containerNotReady = true;
			return {
				logs: "Function is not ready yet.",
				result: { _shsf: "v2" as const, _code: 503, _res: "Function is not ready yet." },
				tooks: [{ description: "Container not ready", value: (Date.now() - starting_time) / 1000, timestamp: Date.now() }],
				exit_code: -10,
			};
		}

		// At this point, container is running and ready (init completed)
		// Now, execute the function logic using docker exec

		await fs.writeFile(transportPaths.payloadPath, payload);
		const execEnv = await getRuntimeEnvironment(functionData);

		// Pass the unique payload file path as an argument to the runner script
		const containerPayloadPath = `/executions/${executionId}/payload.json`;
		const containerResultPath = `/executions/${executionId}/result.json`;
		let execCmd: string[];
		if (runtimeType === "python") {
			execCmd = ["/bin/sh", "/app/_runner.py", containerPayloadPath, containerResultPath];
		} else if (runtimeType === "golang") {
			execCmd = ["/bin/sh", "/app/_runner.sh", containerPayloadPath, containerResultPath];
		} else if (runtimeType === "node") {
			execCmd = ["/bin/sh", "/app/_runner.sh", containerPayloadPath, containerResultPath];
		} else {
			throw new Error(
				`Unsupported runtime type for exec command: ${runtimeType}`
			);
		}

		const exec = await container.exec({
			Cmd: execCmd,
			Env: [
				...execEnv,
				`SHSF_PAYLOAD_PATH=${containerPayloadPath}`,
				`SHSF_RESULT_PATH=${containerResultPath}`,
				`SHSF_TRANSPORT_DIR=/executions/${executionId}`,
				`SHSF_STORAGE_REQUEST_DIR=/executions/${executionId}/storage-requests`,
				`SHSF_STORAGE_RESPONSE_DIR=/executions/${executionId}/storage-responses`,
				`SHSF_CALLFUNC_REQUEST_DIR=/executions/${executionId}/callfunc-requests`,
				`SHSF_CALLFUNC_RESPONSE_DIR=/executions/${executionId}/callfunc-responses`,
			],
			AttachStdout: true,
			AttachStderr: true,
			Tty: false,
		});
		const execStream = await exec.start({ hijack: true, stdin: false });
		mark("Exec started");
		const storageBridge = startStorageRpcBridge({
			userId: functionData.userId,
			requestDir: transportPaths.storageRequestDir,
			responseDir: transportPaths.storageResponseDir,
		});
		const callFuncBridge = startCallFuncBridge({
			requestDir: transportPaths.callFuncRequestDir,
			responseDir: transportPaths.callFuncResponseDir,
			execute: async (functionName, args) => {
				const target = await prisma.function.findFirst({
					where: { name: functionName, userId: functionData.userId },
					include: { files: true },
				});
				if (!target) {
					throw new Error(`Function "${functionName}" not found`);
				}
				const callPayload = JSON.stringify({
					ran_by: `func_${functionData.id}`,
					body: args,
				});
				const result = await executeFunction(
					target.id,
					target,
					target.files,
					{ enabled: false },
					callPayload,
				);
				if (result && typeof result.exit_code === "number" && result.exit_code !== 0) {
					throw new Error(`Function "${functionName}" exited with code ${result.exit_code}`);
				}
				return result?.result ?? null;
			},
		});

		const execOutput = { stdout: "", stderr: "" };
		const MAX_OUTPUT_SIZE = 3 * 1024 * 1024; // 3MB limit to stay under Docker's 4MB limit
		let stdoutTruncated = false;
		let stderrTruncated = false;

		const stdoutMultiplex = new PassThrough();
		const stderrMultiplex = new PassThrough();

		stdoutMultiplex.on("data", (chunk) => {
			const text = chunk.toString("utf8");
			if (execOutput.stdout.length + text.length <= MAX_OUTPUT_SIZE) {
				execOutput.stdout += text;
			} else if (!stdoutTruncated) {
				const remaining = MAX_OUTPUT_SIZE - execOutput.stdout.length;
				if (remaining > 0) {
					execOutput.stdout += text.substring(0, remaining);
				}
				execOutput.stdout +=
					"\n[SHSF TRUNCATED] Output exceeded 3MB limit and was truncated";
				stdoutTruncated = true;
			}

			if (stream.enabled && !stdoutTruncated) {
				// eslint-disable-next-line no-control-regex
				const ansiRegex = /\x1B\[[0-9;]*[A-Za-z]/g;
				const nonPrintableRegex = /[^\x20-\x7E\n\r\t]/g;
				const cleanText = text
					.replace(ansiRegex, "")
					.replace(nonPrintableRegex, "");
				stream.onChunk(cleanText);
			}
		});

		stderrMultiplex.on("data", (chunk) => {
			const text = chunk.toString("utf8");
			if (execOutput.stderr.length + text.length <= MAX_OUTPUT_SIZE) {
				execOutput.stderr += text;
			} else if (!stderrTruncated) {
				const remaining = MAX_OUTPUT_SIZE - execOutput.stderr.length;
				if (remaining > 0) {
					execOutput.stderr += text.substring(0, remaining);
				}
				execOutput.stderr +=
					"\n[SHSF TRUNCATED] Logs exceeded 3MB limit and were truncated";
				stderrTruncated = true;
			}

			if (stream.enabled && !stderrTruncated) {
				// eslint-disable-next-line no-control-regex
				const ansiRegex = /\x1B\[[0-9;]*[A-Za-z]/g;
				const nonPrintableRegex = /[^\x20-\x7E\n\r\t]/g;
				const cleanText = text
					.replace(ansiRegex, "")
					.replace(nonPrintableRegex, "");
				stream.onChunk(cleanText);
			}
		});

		docker.modem.demuxStream(execStream, stdoutMultiplex, stderrMultiplex);

		const execTimeoutMs = (functionData.timeout || 15) * 1000; // functionData.timeout is in seconds

		const execPromise = new Promise<Docker.ExecInspectInfo>((resolve, reject) => {
			execStream.on("end", () => {
				exec.inspect().then(resolve).catch(reject);
			});
			execStream.on("error", reject);
		});

		const timeoutPromise = new Promise<Docker.ExecInspectInfo>((_, reject) =>
			setTimeout(
				() =>
					reject(new Error(`Execution timed out after ${execTimeoutMs / 1000}s`)),
				execTimeoutMs
			)
		);

		let execResultDetails: Docker.ExecInspectInfo;
		try {
			execResultDetails = await Promise.race([execPromise, timeoutPromise]);
			exitCode = execResultDetails.ExitCode ?? 1; // Default to 1 if null/undefined
			logs = [execOutput.stderr, execOutput.stdout].filter(Boolean).join("\n");
			if (exitCode === 0 && execOutput.stdout) {
				func_result = "";
			} else if (exitCode !== 0) {
				// Combine outputs but respect size limits
				const combinedOutput = `Exit Code: ${exitCode}\n${execOutput.stderr}\n${execOutput.stdout}`;
				logs =
					combinedOutput.length > MAX_OUTPUT_SIZE
						? combinedOutput.substring(0, MAX_OUTPUT_SIZE) +
							"\n[SHSF TRUNCATED] Combined output exceeded 3MB limit"
						: combinedOutput;
				log.error({ exitCode }, "Exec failed, logs truncated due to size");
			}
		} catch (execError: any) {
			log.error({ err: execError.message }, "Exec failed or timed out");
			logs = `${execOutput.stderr}\nExecution Error: ${execError.message}`;
			exitCode = -1;
			func_result = "";
		} finally {
			await storageBridge.stop();
			await callFuncBridge.stop();
		}
		mark("Exec finished");
		// Process result if successful
		let parsedResult: any = null;
		if (exitCode === 0) {
			const resultState = await readRunnerResult(transportPaths.resultPath);
			if (resultState.status === "ok") {
				func_result = resultState.raw;
				parsedResult = resultState.result;
			} else if (resultState.status === "malformed") {
				log.error({ err: resultState.error.message }, "Failed to parse JSON result file");
				logs += `\nError parsing result JSON file: ${resultState.error.message}`;
				func_result = resultState.raw;
				exitCode = -2;
			} else {
				func_result = JSON.stringify(null);
			}
		}

		tooks.push({
			timestamp: Date.now(),
			value: (Date.now() - starting_time) / 1000,
			description: "Total",
		});

		return {
			logs,
			result: parsedResult, // Return parsed object or null
			tooks,
			exit_code: exitCode,
		};
	} catch (error: any) {
		log.error({ err: error, functionId: id }, "Critical error in executeFunction");
		tooks.push({
			timestamp: Date.now(),
			value: (Date.now() - starting_time) / 1000,
			description: "Total execution time until error",
		});
		return {
			logs: `${logs}\nCritical Error: ${error.message}\n${error.stack}`,
			result: "Sorry, an error occurred during execution.",
			tooks,
			exit_code: error.statusCode || -3, // Custom code for unhandled errors
		};
	} finally {
		try {
			await fs.rm(executionDir, { recursive: true, force: true });
			mark("Cleanup");
		} catch (cleanupError: any) {
			if (cleanupError.code !== "ENOENT") {
				log.error({ err: cleanupError.message, code: cleanupError.code, executionDir }, "Cleanup failed");
			}
		}

		log.info({
			functionId: functionData.id,
			functionName: functionData.name,
			exitCode,
			totalSeconds: ((Date.now() - starting_time) / 1000).toFixed(3),
		}, "Function execution complete");

		if (!containerNotReady) {
			try {
				await prisma.function.update({
					where: { id },
					data: { lastRun: new Date() },
				});
			} catch (dbError) {
				log.error({ err: dbError }, "Error updating function lastRun");
			}

			try {
				await persistFunctionExecutionLog({
					functionId: id,
					functionData,
					logs,
					output:
						typeof func_result === "string" && func_result !== ""
							? func_result
							: JSON.stringify(null),
					payload,
					exit_code: exitCode,
					tooks,
					...(options?.ratelimit ? { ratelimit: options.ratelimit } : {}),
				});
			} catch (error) {
				log.error({ err: error }, "Error creating trigger log");
			}
		}
	}
}

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
	_files: any[]
): Promise<boolean | 404> {
	const docker = new Docker();
	const functionIdStr = String(functionId);
	const containerName = `shsf_func_${functionIdStr}`;

	try {
		const container = docker.getContainer(containerName);

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
				"cd /app && if [ -f requirements.txt ]; then pip install --user -r requirements.txt; else echo 'No requirements.txt found.'; fi",
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

// Helper function to clean up container when deleting a function
export async function deleteContainerForFunction(functionId: number) {
	const functionIdStr = String(functionId);
	const containerName = `shsf_func_${functionIdStr}`;

	try {
		const docker = new Docker();
		// Try to stop and remove the container if it exists
		try {
			const container = docker.getContainer(containerName);
			const containerInfo = await container.inspect();

			if (containerInfo.State.Running) {
				log.info({ functionId }, "Stopping container");
				await container.kill({ t: 10 }); // 10-second timeout
			}

			log.info({ functionId }, "Removing container");
			await container.remove();
		} catch (containerError: any) {
			if (containerError.statusCode !== 404) {
				log.error({ err: containerError, functionId }, "Error removing container");
			} else {
				log.debug({ functionId }, "Container not found, skipping removal");
			}
		}

		return true;
	} catch (error) {
		log.error({ err: error, functionId }, "Error during container deletion");
		return false;
	}
}

export async function cleanupFunctionContainer(functionId: number) {
	const functionIdStr = String(functionId);
	const containerName = `shsf_func_${functionIdStr}`;
	const funcAppDir = getFunctionBaseDir(functionIdStr);

	try {
		const docker = new Docker();
		// Try to stop and remove the container if it exists
		try {
			const container = docker.getContainer(containerName);
			const containerInfo = await container.inspect();

			if (containerInfo.State.Running) {
				log.info({ functionId }, "Stopping container for cleanup");
				await container.kill({ t: 10 }); // 10-second timeout
			}

			log.info({ functionId }, "Removing container for cleanup");
			await container.remove();
		} catch (containerError: any) {
			if (containerError.statusCode !== 404) {
				log.error({ err: containerError, functionId }, "Error removing container");
			} else {
				log.debug({ functionId }, "Container not found, skipping removal");
			}
		}

		// Remove the function directory
		try {
			log.info({ funcAppDir }, "Removing function directory");
			await fs.rm(funcAppDir, { recursive: true, force: true });
		} catch (dirError) {
			log.error({ err: dirError, funcAppDir }, "Error removing function directory");
		}

		// Clean up cache directories
		try {
			// Python venv
			const pipCacheDir = getCacheDir("pip", "venv", `function-${functionId}`);
			if (fsSync.existsSync(pipCacheDir)) {
				await fs.rm(pipCacheDir, { recursive: true, force: true });
			}

			// Pip hash
			const pipHashDir = getCacheDir("pip", "hashes", `function-${functionId}`);
			if (fsSync.existsSync(pipHashDir)) {
				await fs.rm(pipHashDir, { recursive: true, force: true });
			}

			// Node.js modules
			const nodeCacheDir = getCacheDir("node", "modules", `function-${functionId}`);
			if (fsSync.existsSync(nodeCacheDir)) {
				await fs.rm(nodeCacheDir, { recursive: true, force: true });
			}

			// Node.js hash
			const nodeHashDir = getCacheDir("node", "hashes", `function-${functionId}`);
			if (fsSync.existsSync(nodeHashDir)) {
				await fs.rm(nodeHashDir, { recursive: true, force: true });
			}
		} catch (cacheError) {
			log.error({ err: cacheError, functionId }, "Error cleaning up cache directories");
		}

		return true;
	} catch (error) {
		log.error({ err: error, functionId }, "Error during container cleanup");
		return false;
	}
}
