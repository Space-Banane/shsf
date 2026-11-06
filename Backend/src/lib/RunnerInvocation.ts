import { Function, FunctionFile } from "@prisma/client";
import Docker from "dockerode";
import { PassThrough } from "stream";
import * as fs from "fs/promises";
import { prisma } from "..";
import { replaceApiBaseInContent } from "./FileHelpers";
import { createLogger } from "./logger";
import type { LoggedExecutionRateLimitData } from "./FunctionRateLimit";
import { getFunctionAppDir, getFunctionExecutionDir } from "./StoragePaths";
import { ServeOnlyFileNotFoundHTML } from "./RunnerTypes";
import type { FunctionExecutionErrorType, TimingEntry } from "./RunnerTypes";
import { getRuntimeType, isHtmlStartupFile, parseExecutionPayloadRoute, resolveServeOnlyHtmlFileName, findFileByNameIgnoreCase } from "./RunnerUtils";
import { getRunnerTransportPaths, prepareRunnerTransport, readRunnerResult, revokeLegacyFunctionDbTokens, startStorageRpcBridge, startCallFuncBridge } from "./RunnerTransport";
import { getRuntimeCommand } from "./RunnerRuntimeAdapter";
import { generateExecutionCommand } from "./RunnerRuntimeScripts";
import { prepareRunnerSource } from "./RunnerSource";
import { getRuntimeEnvironment, prepareRunnerContainer } from "./RunnerContainer";
import { persistFunctionExecutionLog } from "./RunnerExecutionLog";
const log = createLogger("Runner");

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
		signal?: AbortSignal;
	},
) {
	const starting_time = Date.now();
	const tooks: TimingEntry[] = [];
	let func_result: string = "";
	let logs: string = "";
	let executionErrorType: FunctionExecutionErrorType | undefined;

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

	let containerNotReady = false;

	try {
		await fs.mkdir(funcAppDir, { recursive: true });
		await prepareRunnerTransport(transportPaths);
		await revokeLegacyFunctionDbTokens();

		await prepareRunnerSource({ functionData, files, funcAppDir, runtimeType, mark, trace });

		const containerState = await prepareRunnerContainer({ docker, functionData, id, functionIdStr, containerName, runtimeType, mark, trace });
		if (containerState.status !== "ready") {
			containerNotReady = true;
			if (containerState.status === "pulling") {
				const message = `Runtime image ${functionData.image} is being prepared. Please retry in a few moments.`;
				exitCode = -10;
				return { logs: message, result: { _shsf: "v2" as const, _code: 503, _res: message }, tooks: [{ description: "Runtime image is being prepared", value: (Date.now() - starting_time) / 1000, timestamp: Date.now() }], exit_code: exitCode };
			}
			return { logs: "Function is not ready yet.", result: { _shsf: "v2" as const, _code: 503, _res: "Function is not ready yet." }, tooks: [{ description: "Container not ready", value: (Date.now() - starting_time) / 1000, timestamp: Date.now() }], exit_code: -10 };
		}
		const container = containerState.container;

		// At this point, container is running and ready (init completed)
		// Now, execute the function logic using docker exec

		await fs.writeFile(transportPaths.payloadPath, payload);
		const execEnv = await getRuntimeEnvironment(functionData);

		// Pass the unique payload file path as an argument to the runner script
		const containerPayloadPath = `/executions/${executionId}/payload.json`;
		const containerResultPath = `/executions/${executionId}/result.json`;
		const runnerCmd = getRuntimeCommand(runtimeType, containerPayloadPath, containerResultPath);
		const execTimeoutSeconds = functionData.timeout || 15;
		const execTimeoutMs = execTimeoutSeconds * 1000;
		const execCmd = generateExecutionCommand(
			runnerCmd,
			execTimeoutSeconds,
			Boolean(options?.signal),
			`/executions/${executionId}`,
		);

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

		const execPromise = new Promise<Docker.ExecInspectInfo>((resolve, reject) => {
			execStream.on("end", () => {
				exec.inspect().then(resolve).catch(reject);
			});
			execStream.on("error", reject);
		});

		let cancellationReason: "client" | undefined;
		const requestCancellation = async (reason: "client") => {
			if (cancellationReason) return;
			cancellationReason = reason;
			await fs.writeFile(transportPaths.cancellationPath, reason);
			log.warn({ functionId: id, reason }, "Cancelling active function exec");
		};
		const onAbort = () => void requestCancellation("client").catch((error) =>
			log.error({ err: error, functionId: id }, "Failed to cancel active function exec"),
		);
		options?.signal?.addEventListener("abort", onAbort, { once: true });
		if (options?.signal?.aborted) onAbort();

		let execResultDetails: Docker.ExecInspectInfo;
		try {
			execResultDetails = await execPromise;
			exitCode = execResultDetails.ExitCode ?? 1; // Default to 1 if null/undefined
			logs = [execOutput.stderr, execOutput.stdout].filter(Boolean).join("\n");
			if (exitCode === 124) {
				executionErrorType = "function_timeout";
				exitCode = -1;
				logs = `${logs}\nExecution timed out after ${execTimeoutMs / 1000}s; the invocation process was terminated.`;
				log.warn({ functionId: id, timeoutSeconds: execTimeoutMs / 1000 }, "Function execution timed out and was terminated");
			} else if (exitCode === 0 && execOutput.stdout) {
				func_result = "";
			} else if (exitCode !== 0) {
				executionErrorType = "execution_failed";
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
			log.error({ err: execError.message }, "Exec failed");
			logs = `${execOutput.stderr}\nExecution Error: ${execError.message}`;
			executionErrorType = "execution_failed";
			exitCode = -1;
			func_result = "";
		} finally {
			options?.signal?.removeEventListener("abort", onAbort);
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
				executionErrorType = "execution_failed";
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
			...(executionErrorType ? { error_type: executionErrorType } : {}),
		};
	} catch (error: any) {
		executionErrorType = "internal_error";
		exitCode = error.statusCode || -3;
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
			exit_code: exitCode, // Custom code for unhandled errors
			error_type: executionErrorType,
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
					...(executionErrorType ? { error_type: executionErrorType } : {}),
					...(options?.ratelimit ? { ratelimit: options.ratelimit } : {}),
				});
			} catch (error) {
				log.error({ err: error }, "Error creating trigger log");
			}
		}
	}
}
