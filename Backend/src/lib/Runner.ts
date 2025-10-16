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
import { Readable } from "stream";

interface TimingEntry {
	timestamp: number;
	value: number;
	description: string;
}

export async function executeFunction(
	id: number,
	functionData: Function,
	files: FunctionFile[],
	stream:
		| { enabled: true; onChunk: (data: string) => void }
		| { enabled: false },
	payload: string
) {
	const starting_time = Date.now();
	const tooks: TimingEntry[] = [];
	let func_result: string = ""; // Stores the JSON string result from the function
	let logs: string = ""; // Stores logs from the function execution

	const recordTiming = (() => {
		let lastTimestamp = starting_time;
		return (description: string) => {
			const currentTimestamp = Date.now();
			const value = (currentTimestamp - lastTimestamp) / 1000;
			tooks.push({ timestamp: currentTimestamp, value, description });
			console.log(`[SHSF CRONS] ${description}: ${value.toFixed(3)} seconds`);
		};
	})();

	const docker = new Docker();
	const functionIdStr = String(functionData.id);
	const containerName = `shsf_func_${functionIdStr}`;
	// Persistent directory on the host for this function's app files
	const funcAppDir = path.join("/opt/shsf_data/functions", functionIdStr, "app");
	const runtimeType = functionData.image.split(":")[0];
	let exitCode = 0; // Default exit code

	// Generate a unique execution ID for this request to avoid race conditions
	// Use crypto.randomUUID() for better uniqueness if available, otherwise fallback
	const executionId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
		? crypto.randomUUID()
		: `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
	const executionDir = path.join("/opt/shsf_data/functions", functionIdStr, "executions", executionId);

	// Define startupFile and initScript here as they are needed for script generation
	const startupFile = functionData.startup_file || (runtimeType === "python" ? "main.py" : "index.js");
	let initScript = "#!/bin/sh\nset -e\necho '[SHSF INIT] Starting environment setup...'\ncd /app\n";

	try {
		let container = docker.getContainer(containerName);
		let containerJustCreated = false;

		// Ensure function app directory exists
		await fs.mkdir(funcAppDir, { recursive: true });
		
		// Create unique execution directory for this request
		await fs.mkdir(executionDir, { recursive: true });
		recordTiming("Created unique execution directory");
		
		// Always update the user files regardless of container state
		recordTiming("Updating function files");
		await Promise.all(
			files.map(async (file) => {
				const filePath = path.join(funcAppDir, file.name);
				await fs.writeFile(filePath, file.content);
			})
		);
		recordTiming("User files written to host app directory");

		// Always generate/update the runner script to accept payload file path as argument
		if (runtimeType === "python") {
			const wrapperPath = path.join(funcAppDir, "_runner.py");
			const wrapperContent = `#!/bin/sh
# Source environment variables if the file exists
if [ -f /function_data/app/.shsf_env ]; then
    . /function_data/app/.shsf_env
    echo "[SHSF RUNNER] Sourced environment from /function_data/app/.shsf_env" >&2
else
    echo "[SHSF RUNNER] Warning: No .shsf_env file found" >&2
fi

# Execute the actual Python runner with payload file path as argument
python3 - "$@" << 'PYTHON_SCRIPT_EOF'
import json
import sys
import os
import traceback

# Get payload file path from command line argument
if len(sys.argv) < 2:
    sys.stderr.write("Error: Payload file path not provided\\n")
    sys.exit(1)

payload_file_path = sys.argv[1]

# Store original stdout, then redirect sys.stdout to sys.stderr for user code
original_stdout = sys.stdout
sys.stdout = sys.stderr

sys.path.append('/function_data/app')
target_module_name = "${startupFile.replace(".py", "")}"

# Read payload from the specified file
run_data = None
try:
    with open(payload_file_path, 'r') as f:
        payload_content = f.read()
        if payload_content.strip():
            run_data = json.loads(payload_content)
except FileNotFoundError:
    sys.stderr.write(f"Warning: Payload file not found at {payload_file_path}\\n")
except json.JSONDecodeError as e:
    sys.stderr.write(f"Error decoding payload JSON: {str(e)}\\n")
    sys.exit(1)
except Exception as e:
    sys.stderr.write(f"Error reading payload file: {str(e)}\\n")
    sys.exit(1)

user_result = None
try:
    original_name_val = __name__
    __name__ = 'imported_module'
    target_module = __import__(target_module_name)
    __name__ = original_name_val # Restore __name__

    if hasattr(target_module, 'main') and callable(target_module.main):
        try:
            # User's main function is called. Its print() statements will go to current sys.stdout (which is sys.stderr).
            if run_data is not None:
                user_result = target_module.main(run_data)
            else:
                user_result = target_module.main()
            
            # Restore original stdout for printing the JSON result
            sys.stdout = original_stdout
            # Wrap the output in markers for clear identification on the *original* stdout
            sys.stdout.write("SHSF_FUNCTION_RESULT_START\\n")
            sys.stdout.write(json.dumps(user_result))
            sys.stdout.write("\\nSHSF_FUNCTION_RESULT_END")
            sys.stdout.flush()
        except Exception as e:
            # Error during main execution or result serialization.
            # Ensure output goes to stderr. If json.dumps failed, sys.stdout might be original_stdout.
            sys.stdout = sys.stderr
            sys.stderr.write(f"Error executing main function or serializing result: {str(e)}\\n")
            traceback.print_exc(file=sys.stderr)
            sys.stdout = original_stdout # Restore for finally block consistency
            sys.exit(1)
    else:
        # sys.stdout is already sys.stderr
        sys.stderr.write(f"No 'main' function found in {target_module_name}.py\\n")
        sys.exit(1)
except Exception as e:
    # Error during module import or other setup.
    # Ensure output goes to stderr.
    sys.stdout = sys.stderr
    sys.stderr.write(f"Error importing module {target_module_name} or during initial setup: {str(e)}\\n")
    traceback.print_exc(file=sys.stderr)
    sys.stdout = original_stdout # Restore for finally block consistency
    sys.exit(1)
finally:
    # Ensure sys.stdout is restored to its original state before exiting.
    # This is good practice, though effect might be minimal in docker exec.
    sys.stdout = original_stdout
PYTHON_SCRIPT_EOF
`;
			await fs.writeFile(wrapperPath, wrapperContent);
			await fs.chmod(wrapperPath, "755");
			recordTiming("Python runner script (_runner.py) written to host app directory");
		} else {
			console.warn(`[executeFunction] Runner script generation skipped: Unsupported runtime type '${runtimeType}' for function ${functionData.id}.`);
		}

		// Always generate/update the init.sh script
		if (runtimeType === "python") {
			initScript += `
if [ -f "requirements.txt" ]; then 
	echo "[SHSF INIT] Setting up Python environment for function ${functionData.id}"
	VENV_DIR="/pip-cache/venv/function-${functionData.id}" 
	HASH_FILE="/pip-cache/hashes/function-${functionData.id}/req.hash"
	PIP_PKG_CACHE_DIR="/pip-cache/pip_packages_cache"
	mkdir -p "$(dirname "$VENV_DIR")" "$(dirname "$HASH_FILE")" "$PIP_PKG_CACHE_DIR"
	REQUIREMENTS_HASH=$(md5sum requirements.txt | awk '{print $1}')
	NEEDS_UPDATE=0
	if [ ! -d "$VENV_DIR" ]; then NEEDS_UPDATE=1; echo "[SHSF INIT] No venv. Creating."; fi
	if [ ! -f "$HASH_FILE" ] || [ "$(cat "$HASH_FILE" 2>/dev/null)" != "$REQUIREMENTS_HASH" ]; then NEEDS_UPDATE=1; echo "[SHSF INIT] Hash mismatch. Updating."; fi
	
	if [ $NEEDS_UPDATE -eq 1 ]; then
		rm -rf "$VENV_DIR"
		python -m venv "$VENV_DIR"
		. "$VENV_DIR/bin/activate"
		pip install --upgrade pip
		if pip install --cache-dir "$PIP_PKG_CACHE_DIR" -r requirements.txt; then
			echo "$REQUIREMENTS_HASH" > "$HASH_FILE"
			echo "[SHSF INIT] Python dependencies installed."
		else
			echo "[SHSF INIT] Error installing Python dependencies." >&2
			exit 1
		fi
	else
		echo "[SHSF INIT] Python venv up-to-date."
	fi
	. "$VENV_DIR/bin/activate" # Ensure activated for subsequent exec
	
	# Create a persistent environment file that can be sourced during execution
	echo "export PATH=$VENV_DIR/bin:\$PATH" > /function_data/app/.shsf_env
	echo "export PYTHONPATH=/function_data/app:\$PYTHONPATH" >> /function_data/app/.shsf_env
	echo "export VIRTUAL_ENV=$VENV_DIR" >> /function_data/app/.shsf_env
fi
echo "[SHSF INIT] Python setup complete."
`;
		} else {
			// This was already checked for runner script, but as a safeguard for init.sh:
			console.warn(`[executeFunction] init.sh script generation skipped: Unsupported runtime type '${runtimeType}' for function ${functionData.id}.`);
			// Potentially throw an error if an unsupported runtime should halt execution.
			// throw new Error(`Unsupported runtime type for init script generation: ${runtimeType}`);
		}
		initScript += "\necho '[SHSF INIT] Environment setup finished successfully.'\n";
		await fs.writeFile(path.join(funcAppDir, "init.sh"), initScript);
		await fs.chmod(path.join(funcAppDir, "init.sh"), "755");
		recordTiming("init.sh script generated on host");

		try {
			const inspectInfo = await container.inspect();
			if (!inspectInfo.State.Running) {
				recordTiming("Starting existing stopped container");
				await container.start();
				recordTiming("Container started");
			} else {
				recordTiming("Found existing running container");
			}
		} catch (error: any) {
			if (error.statusCode === 404) { // Container not found, create it
				containerJustCreated = true;
				recordTiming("Container not found, preparing for creation");

				// Cache directories setup on host (ensure these base paths exist)
				const baseCacheDir = "/opt/shsf_data/cache"; // Centralized cache on host
				await fs.mkdir(baseCacheDir, { recursive: true });
				const pipCacheHost = path.join(baseCacheDir, "pip");

				await Promise.all([
					fs.mkdir(pipCacheHost, { recursive: true }),
				]);
				recordTiming("Host cache directories ensured");
				
				// Mount the base function directory which contains both app/ and executions/
				const funcBaseDir = path.join("/opt/shsf_data/functions", functionIdStr);
				let BINDS: string[] = [`${funcBaseDir}:/function_data`];

				if (runtimeType === "python") {
					BINDS.push(`${pipCacheHost}:/pip-cache`); // Mount persistent pip cache
				} else {
					throw new Error(`Unsupported runtime type for container BIND setup: ${runtimeType}`);
				}

				// Image pull logic (same as original)
				const imageStart = Date.now();
				let imagePulled = false;
				try {
					const imageExists = await docker.listImages({ filters: JSON.stringify({ reference: [functionData.image] }) });
					if (imageExists.length === 0) {
						imagePulled = true;
						recordTiming("Pulling image: " + functionData.image);
						const pullStream = await docker.pull(functionData.image);
						await new Promise((resolve, reject) => {
							docker.modem.followProgress(pullStream, (err) => err ? reject(err) : resolve(null));
						});
					}
				} catch (imgError) {
					console.error("Error checking or pulling image:", imgError);
					throw imgError;
				}
				recordTiming(imagePulled ? "Image pull complete" : "Image check complete");
				
				const initialEnv = functionData.env ? JSON.parse(functionData.env).map((env: { name: string; value: any }) => `${env.name}=${env.value}`) : [];

				container = await docker.createContainer({
					Image: functionData.image,
					name: containerName,
					Env: initialEnv,
					HostConfig: {
						Binds: BINDS,
						AutoRemove: false, // CRITICAL: Container is persistent
						Memory: (functionData.max_ram || 128) * 1024 * 1024,
					},
					// Run init.sh once, then keep container alive
					Cmd: ["/bin/sh", "-c", "/function_data/app/init.sh && echo '[SHSF] Container initialized and idling.' && tail -f /dev/null"],
					Tty: false, // No TTY needed for background container
				});
				recordTiming("Container created");
				await container.start();
				recordTiming("New container started after init");
			} else { // Some other error inspecting container
				throw error;
			}
		}

		// At this point, container is running (either existing or newly created and initialized)
		// Now, execute the function logic using docker exec

		// Write payload to a unique file for this execution to avoid race conditions
		const payloadFilePath = path.join(executionDir, "payload.json");
		await fs.writeFile(payloadFilePath, payload);
		recordTiming("Payload written to unique execution file");

		const execEnv: string[] = []; // Remove RUN_DATA from env
		// Add function-specific env vars to exec as well, in case they are needed by the runner script directly
		// and not just by the init.sh environment.
		if (functionData.env) {
			try {
				const parsedEnv = JSON.parse(functionData.env);
				if (Array.isArray(parsedEnv)) {
					parsedEnv.forEach((envVar: {name: string, value: any}) => execEnv.push(`${envVar.name}=${envVar.value}`));
				}
			} catch (e) {
				console.error("Failed to parse functionData.env for exec:", e);
			}
		}

		// Pass the unique payload file path as an argument to the runner script
		const containerPayloadPath = `/function_data/executions/${executionId}/payload.json`;
		const execCmd = runtimeType === "python"
			? ["/bin/sh", "/function_data/app/_runner.py", containerPayloadPath]
			: (() => { throw new Error(`Unsupported runtime type for exec command: ${runtimeType}`); })();

		const exec = await container.exec({
			Cmd: execCmd,
			Env: execEnv,
			AttachStdout: true,
			AttachStderr: true,
			Tty: false
		});
		recordTiming("Exec created");

		const execStream = await exec.start({ hijack: true, stdin: false });
		recordTiming("Exec started");

		const execOutput = { stdout: "", stderr: "" };
		const MAX_OUTPUT_SIZE = 3 * 1024 * 1024; // 3MB limit to stay under Docker's 4MB limit
		let stdoutTruncated = false;
		let stderrTruncated = false;
		
		const stdoutMultiplex = new PassThrough();
		const stderrMultiplex = new PassThrough();

		stdoutMultiplex.on('data', (chunk) => {
			const text = chunk.toString('utf8');
			if (execOutput.stdout.length + text.length <= MAX_OUTPUT_SIZE) {
				execOutput.stdout += text;
			} else if (!stdoutTruncated) {
				const remaining = MAX_OUTPUT_SIZE - execOutput.stdout.length;
				if (remaining > 0) {
					execOutput.stdout += text.substring(0, remaining);
				}
				execOutput.stdout += '\n[SHSF TRUNCATED] Output exceeded 3MB limit and was truncated';
				stdoutTruncated = true;
			}
		});
		
		stderrMultiplex.on('data', (chunk) => {
			const text = chunk.toString('utf8');
			if (execOutput.stderr.length + text.length <= MAX_OUTPUT_SIZE) {
				execOutput.stderr += text;
			} else if (!stderrTruncated) {
				const remaining = MAX_OUTPUT_SIZE - execOutput.stderr.length;
				if (remaining > 0) {
					execOutput.stderr += text.substring(0, remaining);
				}
				execOutput.stderr += '\n[SHSF TRUNCATED] Logs exceeded 3MB limit and were truncated';
				stderrTruncated = true;
			}
			
			if (stream.enabled && !stderrTruncated) {
				const ansiRegex = /\x1B\[[0-9;]*[A-Za-z]/g;
				const nonPrintableRegex = /[^\x20-\x7E\n\r\t]/g;
				const cleanText = text.replace(ansiRegex, "").replace(nonPrintableRegex, "");
				stream.onChunk(cleanText);
			}
		});

		docker.modem.demuxStream(execStream, stdoutMultiplex, stderrMultiplex);

		const execTimeoutMs = (functionData.timeout || 15) * 1000; // functionData.timeout is in seconds

		const execPromise = new Promise<Docker.ExecInspectInfo>((resolve, reject) => {
			execStream.on('end', () => {
				exec.inspect().then(resolve).catch(reject);
			});
			execStream.on('error', reject);
		});

		const timeoutPromise = new Promise<Docker.ExecInspectInfo>((_, reject) =>
			setTimeout(() => reject(new Error(`Execution timed out after ${execTimeoutMs / 1000}s`)), execTimeoutMs)
		);
		
		let execResultDetails: Docker.ExecInspectInfo;
		try {
			execResultDetails = await Promise.race([execPromise, timeoutPromise]);
			exitCode = execResultDetails.ExitCode ?? 1; // Default to 1 if null/undefined
			logs = execOutput.stderr;
			if (exitCode === 0 && execOutput.stdout) {
				func_result = execOutput.stdout.trim();
			} else if (exitCode !== 0) {
				// Combine outputs but respect size limits
				const combinedOutput = `Exit Code: ${exitCode}\n${execOutput.stderr}\n${execOutput.stdout}`;
				logs = combinedOutput.length > MAX_OUTPUT_SIZE 
					? combinedOutput.substring(0, MAX_OUTPUT_SIZE) + '\n[SHSF TRUNCATED] Combined output exceeded 3MB limit'
					: combinedOutput;
				console.error(`[executeFunction] Exec failed with code ${exitCode}. Logs truncated due to size.`);
			}
		} catch (execError: any) {
			console.error("[executeFunction] Exec failed or timed out:", execError.message);
			logs = `${execOutput.stderr}\nExecution Error: ${execError.message}`;
			exitCode = -1;
			func_result = "";
		}
		recordTiming("Container execution via exec finished");
		// Process result if successful
		let parsedResult: any = null;
		if (exitCode === 0 && func_result) {
			try {
				// Look for the function result markers
				const startMarker = "SHSF_FUNCTION_RESULT_START";
				const endMarker = "SHSF_FUNCTION_RESULT_END";
				const startIdx = func_result.indexOf(startMarker);
				const endIdx = func_result.lastIndexOf(endMarker);
				
				if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) { // Ensure markers are present and in correct order
					// Extract only the content between markers
					const actualResult = func_result.substring(
						startIdx + startMarker.length, 
						endIdx
					).trim();
					
					// Content before or after markers in stdout is now unexpected, but log it as a warning if it occurs.
					const prefix = func_result.substring(0, startIdx).trim();
					if (prefix) {
						logs += `\n[Runner Warning] Unexpected content before result marker in stdout: ${prefix}`;
					}
					
					const suffix = func_result.substring(endIdx + endMarker.length).trim();
					if (suffix) {
						logs += `\n[Runner Warning] Unexpected content after result marker in stdout: ${suffix}`;
					}
					
					parsedResult = JSON.parse(actualResult);
				} else {
						// If no markers are found, or they are in the wrong order,
						// treat the entire stdout as potential logging output.
						console.warn(`[executeFunction] Function result markers not found or in wrong order in stdout. Treating stdout as logs.`);
						if (func_result.trim()) {
							logs += `\nStdout content (no valid markers found):\n${func_result.trim()}`;
						}
						// No parsedResult, leave it as null
				}
			} catch (e: any) {
				console.error(`[executeFunction] Failed to parse JSON result from stdout: ${e.message}. Raw stdout content: ${func_result}`);
				logs += `\nError parsing result JSON from stdout: ${e.message}`;
				exitCode = -2; // Custom code for result parsing error
			}
		}
		
		tooks.push({
			timestamp: Date.now(),
			value: (Date.now() - starting_time) / 1000,
			description: "Total execution time (including potential setup)",
		});

		return {
			logs,
			result: parsedResult, // Return parsed object or null
			tooks,
			exit_code: exitCode,
		};

	} catch (error: any) {
		console.error(`[executeFunction] Critical error during execution of function ${id}:`, error);
		recordTiming("Critical error occurred");
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
		recordTiming("Finalizing execution log");
		
		// Clean up the unique execution directory
		try {
			await fs.rm(executionDir, { recursive: true, force: true });
			recordTiming("Cleaned up execution directory");
		} catch (cleanupError: any) {
			if (cleanupError.code === "EACCES") {
				console.error(`[executeFunction] Permission denied when cleaning up execution directory ${executionDir}:`, cleanupError);
			} else if (cleanupError.code === "EBUSY") {
				console.error(`[executeFunction] Directory in use, could not clean up execution directory ${executionDir}:`, cleanupError);
			} else {
				console.error(`[executeFunction] Error cleaning up execution directory ${executionDir}:`, cleanupError);
			}
		}
		
		// Container and funcAppDir are not removed here as they are persistent.
		// Cleanup of old/unused containers/directories would be a separate process/tool.

		console.log(
			`[SHSF CRONS] Function ${functionData.id} (${functionData.name}) processed. Resulting exit code: ${exitCode}. Total time: ${(Date.now() - starting_time) / 1000} seconds`
		);
		
		try {
			await prisma.function.update({ where: { id }, data: { lastRun: new Date() } });
		} catch (dbError) {
			console.error("Error updating function lastRun:", dbError);
		}

		try {
			// Ensure func_result is a string for the DB, even if it's an error message or empty
			const resultForDb = (typeof func_result === 'string' && func_result !== "") ? func_result : JSON.stringify(null);
			const DB_FIELD_LIMIT = 10000; // Reasonable DB field size limit

			await prisma.triggerLog.create({
				data: {
					functionId: id,
					logs: logs.length > DB_FIELD_LIMIT ? logs.substring(0, DB_FIELD_LIMIT) + "...[truncated for DB]" : logs,
					result: JSON.stringify({
						exit_code: exitCode,
						tooks: tooks,
						output: resultForDb.length > DB_FIELD_LIMIT ? resultForDb.substring(0, DB_FIELD_LIMIT) + "...[truncated for DB]" : resultForDb,
						payload: payload.length > DB_FIELD_LIMIT ? payload.substring(0, DB_FIELD_LIMIT) + "...[truncated for DB]" : payload,
					}),
				},
			});
		} catch (error) {
			console.error("Error creating trigger log:", error);
		}
	}
}

export async function buildPayloadFromGET(
	ctr: DataContext<"HttpRequest", "GET", HttpRequestContext<{}>, UsableMiddleware<{}>[]>
): Promise<{ headers: Record<string, string>; queries: Record<string, string>; source_ip: string; route: string|"default"; method: string }> {
	return {
		headers: Object.fromEntries(ctr.headers.entries()),
		queries: Object.fromEntries(ctr.queries.entries()),
		source_ip: ctr.client.ip.usual(),
		route: ctr.params.get("route") || "default",
		method: "GET"
	};
}

export async function buildPayloadFromPOST(
	ctr: DataContext<"HttpRequest", "POST", HttpRequestContext<{}>, UsableMiddleware<{}>[]>
): Promise<{ headers: Record<string, string>; body: string; queries: Record<string, string>; source_ip: string; route: string|"default"; raw_body: string; method: string }> {
	return {
		headers: Object.fromEntries(ctr.headers.entries()),
		queries: Object.fromEntries(ctr.queries.entries()),
		body: await ctr.rawBody("utf-8"),
		raw_body: await ctr.rawBody("binary"),
		source_ip: ctr.client.ip.usual(),
		route: ctr.params.get("route") || "default",
		method: "POST"
	};
}

export async function installDependencies(functionId: number, functionData: any, files: any[]): Promise<boolean|404> {
	const docker = new Docker();
	const functionIdStr = String(functionId);
	const containerName = `shsf_func_${functionIdStr}`;

	try {
		let container = docker.getContainer(containerName);

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

		const execEnv: string[] = functionData.env ? JSON.parse(functionData.env).map((env: { name: string; value: any }) => `${env.name}=${env.value}`) : [];

		const exec = await container.exec({
			Cmd: ["/bin/sh", "-c", "cd /app && if [ -f requirements.txt ]; then pip install --user -r requirements.txt; else echo 'No requirements.txt found.'; fi"],
			Env: execEnv,
			AttachStdout: true,
			AttachStderr: true,
			Tty: false
		});

		const execStream = await exec.start({ hijack: true, stdin: false });

		let foundSuccess = false;
		let noRequirementsFound = false;
		const successRegex = /Successfully installed/i;
		const noReqRegex = /No requirements\.txt found\./i;
		const alreadySatisfiedRegex = /Requirement already satisfied/i;

		execStream.on('data', (chunk: Buffer) => {
			const text = chunk.toString('utf8');
			console.log(text);
			if (successRegex.test(text) || alreadySatisfiedRegex.test(text)) {
				foundSuccess = true;
				execStream.destroy(); // Stop reading further
			}
			if (noReqRegex.test(text)) {
				noRequirementsFound = true;
				execStream.destroy();
			}
		});

		await new Promise<void>((resolve, reject) => {
			execStream.on('end', resolve);
			execStream.on('error', reject);
		});

		if (noRequirementsFound) return false;
		return foundSuccess;
	} catch (error) {
		console.error("Error installing dependencies:", error);
		return false;
	}
}

// Helper function to clean up container when deleting a function
export async function cleanupFunctionContainer(functionId: number) {
  const functionIdStr = String(functionId);
  const containerName = `shsf_func_${functionIdStr}`;
  const funcAppDir = path.join("/opt/shsf_data/functions", functionIdStr);

  try {
	const docker = new Docker();
	// Try to stop and remove the container if it exists
	try {
	  const container = docker.getContainer(containerName);
	  const containerInfo = await container.inspect();

	  if (containerInfo.State.Running) {
		console.log(`[SHSF] Stopping container for function ${functionId}`);
		await container.kill({ t: 10 }); // 10-second timeout
	  }

	  console.log(`[SHSF] Removing container for function ${functionId}`);
	  await container.remove();
	} catch (containerError: any) {
	  if (containerError.statusCode !== 404) {
		console.error(
		  `[SHSF] Error removing container for function ${functionId}:`,
		  containerError
		);
	  } else {
		console.log(
		  `[SHSF] Container for function ${functionId} not found, skipping removal`
		);
	  }
	}

	// Remove the function directory
	try {
	  console.log(`[SHSF] Removing function directory: ${funcAppDir}`);
	  await fs.rm(funcAppDir, { recursive: true, force: true });
	} catch (dirError) {
	  console.error(
		`[SHSF] Error removing function directory ${funcAppDir}:`,
		dirError
	  );
	}

	// Clean up cache directories
	try {
	  // Python venv
	  const pipCacheDir = `/opt/shsf_data/cache/pip/venv/function-${functionId}`;
	  if (fsSync.existsSync(pipCacheDir)) {
		await fs.rm(pipCacheDir, { recursive: true, force: true });
	  }

	  // Pip hash
	  const pipHashDir = `/opt/shsf_data/cache/pip/hashes/function-${functionId}`;
	  if (fsSync.existsSync(pipHashDir)) {
		await fs.rm(pipHashDir, { recursive: true, force: true });
	  }
	} catch (cacheError) {
	  console.error(
		`[SHSF] Error cleaning up cache directories for function ${functionId}:`,
		cacheError
	  );
	}

	return true;
  } catch (error) {
	console.error(
	  `[SHSF] Error during container cleanup for function ${functionId}:`,
	  error
	);
	return false;
  }
}