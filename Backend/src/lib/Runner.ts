import { Function, FunctionFile } from "@prisma/client";
import Docker from "dockerode";
import { PassThrough } from "stream"; // Added PassThrough
import { prisma } from "..";
import { HttpRequestContext } from "rjweb-server";
import { DataContext } from "rjweb-server/lib/typings/types/internal";
import { UsableMiddleware } from "rjweb-server/lib/typings/classes/Middleware";
import * as fs from "fs/promises";
import path from "path";

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

	// Define startupFile and initScript here as they are needed for script generation
	const startupFile = functionData.startup_file || (runtimeType === "python" ? "main.py" : "index.js");
	let initScript = "#!/bin/sh\nset -e\necho '[SHSF INIT] Starting environment setup...'\ncd /app\n";

	try {
		let container = docker.getContainer(containerName);
		let containerJustCreated = false;

		// Ensure function app directory exists
		await fs.mkdir(funcAppDir, { recursive: true });
		
		// Always update the user files regardless of container state
		recordTiming("Updating function files");
		await Promise.all(
			files.map(async (file) => {
				const filePath = path.join(funcAppDir, file.name);
				await fs.writeFile(filePath, file.content);
			})
		);
		recordTiming("User files written to host app directory");

		// Always generate/update the runner script
		if (runtimeType === "python") {
			const wrapperPath = path.join(funcAppDir, "_runner.py");
			const wrapperContent = `
#!/bin/sh
# Source environment variables if the file exists
if [ -f /app/.shsf_env ]; then
    . /app/.shsf_env
    echo "[SHSF RUNNER] Sourced environment from /app/.shsf_env" >&2
else
    echo "[SHSF RUNNER] Warning: No .shsf_env file found" >&2
fi

# Execute the actual Python runner
python3 - << 'PYTHON_SCRIPT_EOF'
import json
import sys
import os
import traceback

# Store original stdout, then redirect sys.stdout to sys.stderr for user code
original_stdout = sys.stdout
sys.stdout = sys.stderr

sys.path.append('/app')
target_module_name = "${startupFile.replace(".py", "")}"

# Read payload from file instead of environment variable
run_data = None
try:
    with open('/app/.shsf_payload.json', 'r') as f:
        payload_content = f.read()
        if payload_content.strip():
            run_data = json.loads(payload_content)
except FileNotFoundError:
    sys.stderr.write("Warning: No payload file found\\n")
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
			sys.stdout.write("SHSF_FUNCTION_RESULT_START\\n");
			sys.stdout.write(json.dumps(user_result));
			sys.stdout.write("\\nSHSF_FUNCTION_RESULT_END");
			sys.stdout.flush();
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
		} else if (runtimeType === "node") {
			const wrapperPath = path.join(funcAppDir, "_runner.js");
			const wrapperContent = `
#!/bin/sh
# Source environment variables if the file exists
if [ -f /app/.shsf_env ]; then
    . /app/.shsf_env
    echo "[SHSF RUNNER] Sourced environment from /app/.shsf_env" >&2
else
    echo "[SHSF RUNNER] Warning: No .shsf_env file found" >&2
fi

# Debug: Print environment variables
echo "[SHSF RUNNER] PATH=$PATH" >&2
echo "[SHSF RUNNER] NODE_PATH=$NODE_PATH" >&2
echo "[SHSF RUNNER] NPM_CONFIG_CACHE=$NPM_CONFIG_CACHE" >&2
echo "[SHSF RUNNER] PNPM_HOME=$PNPM_HOME" >&2

# Execute the actual Node runner
node - << 'NODE_SCRIPT_EOF'
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const stream = require('stream');

try {
	// Store the original stdout write function and create a proxy that redirects to stderr
	const originalStdoutWrite = process.stdout.write;
	// Redirect all stdout writes to stderr during user code execution
	process.stdout.write = function(...args) {
		return process.stderr.write.apply(process.stderr, args);
	};

	const fileContent = fs.readFileSync(path.join('/app', '${startupFile}'), 'utf8');
	const sandbox = {
		console: { // Route console.log/error to stderr for logs
			log: (...args) => process.stderr.write(args.map(String).join(' ') + '\\n'),
			error: (...args) => process.stderr.write(args.map(String).join(' ') + '\\n'),
			warn: (...args) => process.stderr.write(args.map(String).join(' ') + '\\n'),
			info: (...args) => process.stderr.write(args.map(String).join(' ') + '\\n'),
			debug: (...args) => process.stderr.write(args.map(String).join(' ') + '\\n'),
		},
		require, __dirname: '/app', __filename: path.join('/app', '${startupFile}'),
		module: { exports: {} }, exports: {}, process,
		setTimeout, clearTimeout, setInterval, clearInterval, Buffer, main: undefined
	};
	vm.runInNewContext(fileContent, sandbox);

	if (typeof sandbox.main === 'function') {
		// Read payload from file instead of environment variable
		let runData = undefined;
		try {
			const payloadContent = fs.readFileSync('/app/.shsf_payload.json', 'utf8');
			if (payloadContent.trim()) {
				runData = JSON.parse(payloadContent);
			}
		} catch (e) {
			if (e.code !== 'ENOENT') { // Ignore file not found, but report other errors
				process.stderr.write('Error reading payload file: ' + e.message + '\\n');
				process.exit(1);
			}
		}
		
		let result = runData !== undefined ? sandbox.main(runData) : sandbox.main();
		
		if (result instanceof Promise) {
			result.then(finalResult => {
					// Restore original stdout before writing the result
					process.stdout.write = originalStdoutWrite;
					
					// Wrap the output in markers for clear identification
					process.stdout.write("SHSF_FUNCTION_RESULT_START\\n");
					process.stdout.write(JSON.stringify(finalResult));
					process.stdout.write("\\nSHSF_FUNCTION_RESULT_END");
			}).catch(err => {
				process.stderr.write('Error in async main function: ' + (err.stack || err) + '\\n');
				process.exit(1);
			});
		} else {
				// Restore original stdout before writing the result
				process.stdout.write = originalStdoutWrite;
				
				// Wrap the output in markers for clear identification
				process.stdout.write("SHSF_FUNCTION_RESULT_START\\n");
				process.stdout.write(JSON.stringify(result));
				process.stdout.write("\\nSHSF_FUNCTION_RESULT_END");
		}
	} else {
		process.stderr.write("No 'main' function exported from " + '${startupFile}' + ".\\n");
		process.exit(1);
	}
} catch (e) {
	process.stderr.write('Error in runner script: ' + (e.stack || e) + '\\n');
	process.exit(1);
} finally {
	// Ensure we restore stdout.write if it exists and we've modified it
	if (typeof originalStdoutWrite === 'function') {
		process.stdout.write = originalStdoutWrite;
	}
}
NODE_SCRIPT_EOF
`;
			await fs.writeFile(wrapperPath, wrapperContent);
			await fs.chmod(wrapperPath, "755");
			recordTiming("Node.js runner script (_runner.js) written to host app directory");
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
	echo "export PATH=$VENV_DIR/bin:\$PATH" > /app/.shsf_env
	echo "export PYTHONPATH=/app:\$PYTHONPATH" >> /app/.shsf_env
	echo "export VIRTUAL_ENV=$VENV_DIR" >> /app/.shsf_env
fi
echo "[SHSF INIT] Python setup complete."
`;
		} else if (runtimeType === "node") {
			const aptArchivesCacheContainer = '/var/cache/apt/archives'; // Path inside container
			const aptListsCacheContainer = '/var/lib/apt/lists'; // Path inside container
			
			const pkgJsonFile = files.find((file) => file.name === "package.json");
			if (pkgJsonFile) {
				try {
					const pkg = JSON.parse(pkgJsonFile.content);
					if (pkg.shsf && pkg.shsf.apt_deps && Array.isArray(pkg.shsf.apt_deps) && pkg.shsf.apt_deps.length > 0) {
						initScript += `
echo "[SHSF INIT] Checking for apt dependencies..."
mkdir -p ${aptArchivesCacheContainer} ${aptListsCacheContainer}/partial
apt-get update -o Dir::Cache::archives="${aptArchivesCacheContainer}" -o Dir::State::lists="${aptListsCacheContainer}"
apt-get install -y ${pkg.shsf.apt_deps.join(' ')} -o Dir::Cache::archives="${aptArchivesCacheContainer}"
echo "[SHSF INIT] Apt dependencies installed."
`;
					}
				} catch (e) { console.error("Error parsing package.json for apt_deps in init script:", e); }
			}

			initScript += `
export NPM_CONFIG_CACHE="/npm-cache"
export PNPM_HOME="/pnpm-cache"
mkdir -p /pnpm-cache/store # Ensure pnpm store directory exists within the mount for pnpm
if [ -f "package.json" ]; then 
	echo "[SHSF INIT] Setting up Node.js environment for function ${functionData.id}"
	CACHE_BASE="/pnpm-cache/hashes/function-${functionData.id}"
	HASH_FILE="$CACHE_BASE/dep.hash"
	mkdir -p "$CACHE_BASE"
	CURRENT_HASH=""
	INSTALL_CMD=""
	LOCK_FILE_TYPE="none"
	if [ -f "pnpm-lock.yaml" ]; then CURRENT_HASH=$(md5sum pnpm-lock.yaml | awk '{print $1}'); INSTALL_CMD="pnpm install --store-dir /pnpm-cache/store --frozen-lockfile --prod"; LOCK_FILE_TYPE="pnpm";
	elif [ -f "package-lock.json" ]; then CURRENT_HASH=$(md5sum package-lock.json | awk '{print $1}'); INSTALL_CMD="npm ci --no-fund --no-audit --loglevel=error"; LOCK_FILE_TYPE="npm-lock";
	else CURRENT_HASH=$(md5sum package.json | awk '{print $1}'); INSTALL_CMD="npm install --no-fund --no-audit --loglevel=error"; LOCK_FILE_TYPE="npm-pkg"; fi
	
	if [ "$CURRENT_HASH" != "$(cat "$HASH_FILE" 2>/dev/null)" ]; then
		echo "[SHSF INIT] Node dependencies changed or first run ($LOCK_FILE_TYPE). Installing..."
		rm -rf node_modules
		if $INSTALL_CMD; then echo "$CURRENT_HASH" > "$HASH_FILE"; echo "[SHSF INIT] Node dependencies installed ($LOCK_FILE_TYPE).";
		else echo "[SHSF INIT] Error installing Node dependencies ($LOCK_FILE_TYPE)." >&2; exit 1; fi
	else echo "[SHSF INIT] Node dependencies up-to-date ($LOCK_FILE_TYPE)."; fi
	if [ "$LOCK_FILE_TYPE" = "pnpm" ] && [ ! -d "node_modules" ]; then 
		echo "[SHSF INIT] node_modules not found for pnpm, running install again..."
		pnpm install --store-dir /pnpm-cache/store --frozen-lockfile --prod --prefer-offline
	fi
	
	# Create a persistent environment file that can be sourced during execution
	echo "export NPM_CONFIG_CACHE='/npm-cache'" > /app/.shsf_env
	echo "export PNPM_HOME='/pnpm-cache'" >> /app/.shsf_env
	echo "export PATH=/app/node_modules/.bin:/usr/local/bin:/usr/bin:/bin:\$PATH" >> /app/.shsf_env
	echo "export NODE_PATH=/app/node_modules:/usr/local/lib/node_modules:\$NODE_PATH" >> /app/.shsf_env
fi
echo "[SHSF INIT] Node.js setup complete."
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
				const pnpmCacheHost = path.join(baseCacheDir, "pnpm");
				const npmCacheHost = path.join(baseCacheDir, "npm");
				const aptCacheBaseHost = path.join(baseCacheDir, "apt", `function-${functionIdStr}`);
				const puppeteerCacheHostDir = path.join(baseCacheDir, "puppeteer", `function-${functionIdStr}`);

				await Promise.all([
					fs.mkdir(pipCacheHost, { recursive: true }),
					fs.mkdir(pnpmCacheHost, { recursive: true }),
					fs.mkdir(npmCacheHost, { recursive: true }),
					fs.mkdir(path.join(aptCacheBaseHost, 'var/cache/apt/archives'), { recursive: true }),
					fs.mkdir(path.join(aptCacheBaseHost, 'var/lib/apt/lists'), { recursive: true }),
				]);
				recordTiming("Host cache directories ensured");
				
				let BINDS: string[] = [`${funcAppDir}:/app`];

				if (runtimeType === "python") {
					BINDS.push(`${pipCacheHost}:/pip-cache`); // Mount persistent pip cache
				} else if (runtimeType === "node") {
					BINDS.push(`${pnpmCacheHost}:/pnpm-cache`);
					BINDS.push(`${npmCacheHost}:/npm-cache`);

					const aptArchivesCacheContainer = '/var/cache/apt/archives';
					const aptListsCacheContainer = '/var/lib/apt/lists';
					BINDS.push(`${path.join(aptCacheBaseHost, 'var/cache/apt/archives')}:${aptArchivesCacheContainer}`);
					BINDS.push(`${path.join(aptCacheBaseHost, 'var/lib/apt/lists')}:${aptListsCacheContainer}`);
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

				// Add puppeteer cache bind if node and puppeteer is a dependency
				if (runtimeType === "node") {
					let hasPuppeteer = false;
					for (const file of files) {
						if (file.name === "package.json") {
							try {
								const pkg = JSON.parse(file.content);
								if ((pkg.dependencies && Object.keys(pkg.dependencies).some(dep => dep.toLowerCase().includes("puppeteer"))) ||
										(pkg.devDependencies && Object.keys(pkg.devDependencies).some(dep => dep.toLowerCase().includes("puppeteer")))) {
									hasPuppeteer = true; break;
								}
							} catch (e) { /* ignore parsing error */ }
						}
					}
					if (hasPuppeteer) {
						await fs.mkdir(puppeteerCacheHostDir, { recursive: true });
						BINDS.push(`${puppeteerCacheHostDir}:/root/.cache/puppeteer`);
						recordTiming("Puppeteer cache bind added");
					}
				}
				
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
					Cmd: ["/bin/sh", "-c", "/app/init.sh && echo '[SHSF] Container initialized and idling.' && tail -f /dev/null"],
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

		// Write payload to a file instead of passing as env var to avoid Docker size limits
		const payloadFilePath = path.join(funcAppDir, ".shsf_payload.json");
		await fs.writeFile(payloadFilePath, payload);
		recordTiming("Payload written to file");

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


		const execCmd = runtimeType === "python"
			? ["/bin/sh", "/app/_runner.py"]
			: ["/bin/sh", "/app/_runner.js"];

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

		const execTimeoutMs = (functionData.timeout || 15) * 1000; // Timeout for the exec itself

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
		console.log(",here;",func_result);
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
		raw_body: await ctr.$body().text(),
		source_ip: ctr.client.ip.usual(),
		route: ctr.params.get("route") || "default",
		method: "POST"
	};
}
