import { Function, FunctionFile } from "@prisma/client";
import Docker from "dockerode";
import { Readable } from "stream";
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

/**
 * Optimized polling function to check for the existence and content of eject.json.
 * It polls frequently for a short duration to detect the file as soon as possible
 * after the container likely writes it.
 *
 * @param tempDir The directory where eject.json is expected.
 * @param pollInterval Milliseconds between checks. Lower values increase CPU load but decrease detection latency. Defaults to 1ms.
 * @param maxDuration Maximum milliseconds to poll before giving up. Defaults to 500ms.
 * @returns The parsed content of eject.json, or null if not found/parsed within the duration.
 */
async function pollForEject(
	tempDir: string,
	pollInterval = 1, // Poll very frequently for minimum latency
	maxDuration = 500 // Reasonably short duration, assuming file appears quickly post-execution
): Promise<any | null> {
	const start = Date.now();
	let attempts = 0;

	while (Date.now() - start < maxDuration) {
		attempts++;
		try {
			// Directly attempt to read and parse. This avoids the extra fs.access call.
			// If the file doesn't exist or isn't readable yet, readFile will throw.
			const ejectFilePath = path.join(tempDir, "eject.json");
			const ejectData = await fs.readFile(ejectFilePath, "utf-8");

			// If readFile succeeds, try parsing immediately.
			try {
				const result = JSON.parse(ejectData);
				// console.log(`[pollForEject] Found after ${Date.now() - start}ms and ${attempts} attempts.`); // Optional debug log
				return result; // Success!
			} catch (parseError) {
				// File exists but content is invalid/incomplete. Log and treat as not found yet.
				console.error(`[pollForEject] Error parsing eject.json (attempt ${attempts}): ${parseError}`);
				// Continue polling, maybe the file write wasn't atomic.
			}
		} catch (err: any) {
			// Most common error will be ENOENT (file not found). Ignore it and continue polling.
			if (err.code !== 'ENOENT') {
				// Log unexpected errors (permissions, etc.) but still continue polling.
				console.error(`[pollForEject] Error reading eject.json (attempt ${attempts}): ${err}`);
			}
			// File not found or other read error, continue polling.
		}

		// Wait before the next attempt.
		await new Promise((resolve) => setTimeout(resolve, pollInterval));
	}

	// console.log(`[pollForEject] Not found after ${maxDuration}ms and ${attempts} attempts.`); // Optional debug log
	// Timeout reached, file was not found or successfully parsed.
	// Perform one final check in case it appeared exactly at the timeout boundary.
	try {
		const ejectFilePath = path.join(tempDir, "eject.json");
		const ejectData = await fs.readFile(ejectFilePath, "utf-8");
		return JSON.parse(ejectData);
	} catch {
		return null; // Really not found or parsable.
	}
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
	let func_result: string = "";

	// Updated recordTiming function
	const recordTiming = (() => {
		let lastTimestamp = starting_time;
		return (description: string) => {
			const currentTimestamp = Date.now();
			const value = (currentTimestamp - lastTimestamp) / 1000;
			tooks.push({ timestamp: currentTimestamp, value, description });
			lastTimestamp = currentTimestamp;
			console.log(`[SHSF CRONS] ${description}: ${value.toFixed(3)} seconds`);
		};
	})();

	const docker = new Docker();
	const containerName = `code_runner_${functionData.id}_${Date.now()}`;
	const tempDir = `/tmp/shsf/${containerName}`;
	const runtimeType = functionData.image.split(":")[0];
	await fs.mkdir(tempDir, { recursive: true });

	const cacheDirs = [
		"/tmp/shsf/.cache",
		"/tmp/shsf/.cache/pnpm",
		"/tmp/shsf/.cache/pip",
		"/tmp/shsf/.cache/npm",
	];

	if (runtimeType === "python") {
		cacheDirs.push(
			`/tmp/shsf/.cache/pip/function-${functionData.id}`,
			`/tmp/shsf/.cache/pip/function-${functionData.id}/http-cache`,
			`/tmp/shsf/.cache/pip/function-${functionData.id}/wheels`,
			`/tmp/shsf/.cache/pip/function-${functionData.id}/packages`
		);
	} else if (runtimeType === "node") {
		cacheDirs.push(`/tmp/shsf/.cache/pnpm/function-${functionData.id}/store`);
	}

	await Promise.all(cacheDirs.map((dir) => fs.mkdir(dir, { recursive: true })));
	recordTiming("Directory creation");

	let defaultStartupFile = runtimeType === "python" ? "main.py" : "index.js";
	const startupFile = functionData.startup_file || defaultStartupFile;

	// Write user files concurrently for speed
	await Promise.all(
		files.map(async (file) => {
			const filePath = path.join(tempDir, file.name);
			await fs.writeFile(filePath, file.content);
		})
	);
	recordTiming("File writing");

	// Generate the wrapper script and init.sh
	let initScript = "#!/bin/sh\ncd /app\n";

	// NEW: Declare BINDS early to allow usage in runtime branches.
	let BINDS: string[] = [];

	if (runtimeType === "python") {
		initScript += `
if [ -f "requirements.txt" ]; then 
	echo "[SHSF] Setting up Python environment for function ${functionData.id}"
	
	# Define paths for virtual environment and cache
	VENV_DIR="/pip-cache/function-${functionData.id}/venv"
	# PIP_CACHE_DIR is automatically used by pip when the volume is mounted
	HASH_FILE="/pip-cache/function-${functionData.id}/.reqhash"
	
	# Create base directory for venv and hash
	mkdir -p "$(dirname "$VENV_DIR")"
	
	# Generate a hash of requirements.txt
	REQUIREMENTS_HASH=$(md5sum requirements.txt | awk '{print $1}')
	
	NEEDS_UPDATE=0
	# Check if venv exists and if requirements hash matches
	if [ ! -d "$VENV_DIR" ]; then
		echo "[SHSF] No existing virtual environment found. Creating..."
		NEEDS_UPDATE=1
	elif [ ! -f "$HASH_FILE" ] || [ "$(cat "$HASH_FILE")" != "$REQUIREMENTS_HASH" ]; then
		echo "[SHSF] Requirements changed (new hash: $REQUIREMENTS_HASH). Updating virtual environment..."
		NEEDS_UPDATE=1
	else
		echo "[SHSF] Requirements unchanged (hash: $REQUIREMENTS_HASH). Using existing virtual environment."
	fi
	
	# Create or update the virtual environment if needed
	if [ $NEEDS_UPDATE -eq 1 ]; then
		# Remove old venv if it exists to ensure clean state
		rm -rf "$VENV_DIR"
		echo "[SHSF] Creating virtual environment in $VENV_DIR"
		python -m venv "$VENV_DIR"
		
		# Activate the new environment
		. "$VENV_DIR/bin/activate"
		
		echo "[SHSF] Upgrading pip..."
		pip install --upgrade pip
		
		echo "[SHSF] Installing dependencies from requirements.txt using pip cache..."
		# Pip will automatically use the mounted /pip-cache volume
		if pip install -r requirements.txt; then
			# Save the hash on successful installation
			echo "$REQUIREMENTS_HASH" > "$HASH_FILE"
			echo "[SHSF] Dependencies installed and hash saved."
		else
			echo "[SHSF] Error installing dependencies. Environment might be incomplete."
			# Optionally exit here: exit 1
		fi
	else
		# Activate the existing environment
		. "$VENV_DIR/bin/activate"
	fi
	
	# Verify the environment is usable (optional but recommended)
	if ! python -c "import sys; sys.exit(0)"; then
		echo "[SHSF] Warning: Python environment activation failed or is corrupted. Attempting recovery..."
		# Attempt a full reinstall as recovery
		rm -rf "$VENV_DIR" "$HASH_FILE"
		python -m venv "$VENV_DIR"
		. "$VENV_DIR/bin/activate"
		pip install --upgrade pip
		pip install -r requirements.txt && echo "$REQUIREMENTS_HASH" > "$HASH_FILE"
	fi
	
	echo "[SHSF] Python environment ready."
fi
`;
		const wrapperPath = path.join(tempDir, "_runner.py");
		const wrapperContent = `
import json
import sys
import os
import traceback

# Import the target module
sys.path.append('/app')
target_module_name = "${startupFile.replace(".py", "")}"

try:
	# First try to load the module with a direct import, but protect against immediate execution
	# Save the original __name__ variable to prevent immediate script execution on import
	original_name = __name__
	__name__ = 'imported_module'  # This prevents code in the global scope from running if guarded by if __name__ == "__main__"
	
	# Import the module - this should prevent automatic execution of global code
	target_module = __import__(target_module_name)
	
	# Check if RUN data was provided via environment variable
	run_data = os.getenv('RUN_DATA')
	
	# Look for a main function to execute
	if hasattr(target_module, 'main') and callable(target_module.main):
		try:
			# Call the main function with the run data if provided
			if (run_data):
				result = target_module.main(json.loads(run_data))
			else:
				result = target_module.main()
				
			# Write result to eject file
			with open('eject.json', 'w') as f:
				json.dump(result, f)
		except Exception as e:
			print(f"Error executing main function: {str(e)}")
			traceback.print_exc()
except Exception as e:
	print(f"Error importing module {target_module_name}: {str(e)}")
	traceback.print_exc()
`;

		await fs.writeFile(wrapperPath, wrapperContent);
		initScript += `python /app/_runner.py\n`;
		await fs.writeFile(path.join(tempDir, "init.sh"), initScript);
		await fs.chmod(path.join(tempDir, "init.sh"), "755");
	} else if (runtimeType === "node") {
				// Define host paths for standard apt cache directories
				const aptCacheBase = `/tmp/shsf/.cache/apt/function-${functionData.id}`;
				const aptArchivesCacheHost = path.join(aptCacheBase, 'var/cache/apt/archives');
				const aptListsCacheHost = path.join(aptCacheBase, 'var/lib/apt/lists');

				// Create these directories on the host
				await fs.mkdir(aptArchivesCacheHost, { recursive: true });
				await fs.mkdir(aptListsCacheHost, { recursive: true });

				// Add binds for the standard apt cache locations
				BINDS.push(`${aptArchivesCacheHost}:/var/cache/apt/archives`);
				BINDS.push(`${aptListsCacheHost}:/var/lib/apt/lists`);

				// Check if there is a shsf.apt_deps in package.json
				const aptDepsFile = files.find((file) => file.name === "package.json");
				if (aptDepsFile) {
					try {
						const pkg = JSON.parse(aptDepsFile.content);
						if (pkg.shsf && pkg.shsf.apt_deps) {
								// Update and install using default (mounted) cache locations
								initScript += `
# Ensure apt directories exist inside container (might be needed on first run)
mkdir -p /var/cache/apt/archives /var/lib/apt/lists/partial

# Update package lists (should hit the mounted cache)
echo "[SHSF] Updating apt lists using mounted cache..."
apt-get update
`;
								const aptDeps = pkg.shsf.apt_deps;
								if (Array.isArray(aptDeps) && aptDeps.length > 0) {
									initScript += `echo "[SHSF] Installing apt dependencies using mounted cache: ${aptDeps.join(' ')}..."\n`;
									// Install dependencies (should use cached .deb files)
									const installCmd = `apt-get install -y ${aptDeps.join(' ')}`;
									initScript += `${installCmd}\n`;
								} else {
									initScript += `echo "[SHSF] No apt dependencies listed."\n`;
								}
						}
					} catch (e) {
						console.error("Error parsing package.json for apt_deps:", e);
					}
				}
				initScript += `
# Set cache directories for npm and pnpm (volumes mounted by host)
export NPM_CONFIG_CACHE="/npm-cache"
export PNPM_HOME="/pnpm-cache" # pnpm uses this for its store

if [ -f "package.json" ]; then 
	echo "[SHSF] Setting up Node.js environment for function ${functionData.id}"
	
	# Define cache base and hash file location
	CACHE_BASE="/pnpm-cache/function-${functionData.id}" # Using pnpm-cache dir for consistency
	HASH_FILE="$CACHE_BASE/.depshash"
	mkdir -p "$CACHE_BASE"

	CURRENT_HASH=""
	INSTALL_CMD=""
	LOCK_FILE_TYPE="none"

	# 1. Check for pnpm lock file
	if [ -f "pnpm-lock.yaml" ]; then
		echo "[SHSF] Found pnpm-lock.yaml"
		CURRENT_HASH=$(md5sum pnpm-lock.yaml | awk '{print $1}')
		INSTALL_CMD="pnpm install --frozen-lockfile --prod" # Use --prod or adjust as needed
		LOCK_FILE_TYPE="pnpm"
	# 2. Check for npm lock file
	elif [ -f "package-lock.json" ]; then
		echo "[SHSF] Found package-lock.json"
		CURRENT_HASH=$(md5sum package-lock.json | awk '{print $1}')
		INSTALL_CMD="npm ci --no-fund --no-audit --loglevel=error"
		LOCK_FILE_TYPE="npm-lock"
	# 3. Fallback to package.json
	else
		echo "[SHSF] No lock file found. Using package.json"
		# Hashing package.json is less reliable for cache invalidation
		# Consider generating a lock file in the build step if possible
		CURRENT_HASH=$(md5sum package.json | awk '{print $1}')
		INSTALL_CMD="npm install --no-fund --no-audit --loglevel=error"
		LOCK_FILE_TYPE="npm-pkg"
	fi

	echo "[SHSF] Current dependency hash ($LOCK_FILE_TYPE): $CURRENT_HASH"
	STORED_HASH=$(cat "$HASH_FILE" 2>/dev/null)
	echo "[SHSF] Stored dependency hash: $STORED_HASH"

	# Check if installation is needed
	if [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
		echo "[SHSF] Dependencies changed or first run. Installing using '$INSTALL_CMD'..."
		rm -rf node_modules 
		
		# Execute the determined install command
		if $INSTALL_CMD; then
			echo "[SHSF] Dependencies installed successfully."
			# Save the new hash
			echo "$CURRENT_HASH" > "$HASH_FILE"
			echo "[SHSF] Updated dependency hash stored."
		else
			echo "[SHSF] Error during dependency installation. Environment might be incomplete."
			# Optionally exit: exit 1
		fi
	else
		echo "[SHSF] Dependencies hash matches. Skipping installation."
		# Ensure node_modules exists if using pnpm (it creates links)
		if [ "$LOCK_FILE_TYPE" = "pnpm" ] && [ ! -d "node_modules" ]; then
			echo "[SHSF] pnpm detected, ensuring node_modules links exist..."
			pnpm install --frozen-lockfile --prod --prefer-offline
		elif [ ! -d "node_modules" ]; then
			# This case might happen if node_modules was manually deleted or if 
			# the previous run failed after deleting node_modules but before install finished.
			# Re-running install is safer.
			echo "[SHSF] node_modules directory not found despite matching hash. Re-running install..."
			if $INSTALL_CMD; then
				echo "[SHSF] Dependencies installed successfully."
				echo "$CURRENT_HASH" > "$HASH_FILE" # Re-save hash just in case
			else
				echo "[SHSF] Error during dependency installation recovery."
			fi
		fi
	fi
	
	echo "[SHSF] Node.js environment ready."
fi
`;
		const wrapperPath = path.join(tempDir, "_runner.js");
		const wrapperContent = `
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

try {
	console.log("Executing script...");
	const fileContent = fs.readFileSync(path.join('/app', '${startupFile}'), 'utf8');
	const sandbox = {
		console,
		require,
		__dirname: '/app',
		__filename: path.join('/app', '${startupFile}'),
		module: { exports: {} },
		exports: {},
		process,
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		Buffer,
		main: undefined
	};
	vm.runInNewContext(fileContent, sandbox);
	if (typeof sandbox.main === 'function') {
		const runData = process.env.RUN_DATA;
		try {
			let result;
			if (runData) {
				result = sandbox.main(JSON.parse(runData));
			} else {
				result = sandbox.main();
			}
			
			if (result instanceof Promise) {
				result
					.then(finalResult => {
						fs.writeFileSync('eject.json', JSON.stringify(finalResult));
					})
					.catch(err => {
						console.error("Error in async main function:", err);
					});
			} else {
				fs.writeFileSync('eject.json', JSON.stringify(result));
			}
		} catch(e) {
			console.error("Error executing main function:", e);
		}
	}
} catch (e) {
	console.error("Error in runner script:", e);
}
`;
		await fs.writeFile(wrapperPath, wrapperContent);
		// Lets check if there is a shsf_startup script in package.json
		const startupScript = files.find((file) => file.name === "package.json");
		if (startupScript) {
			try {
				const pkg = JSON.parse(startupScript.content);
				if (pkg.shsf && pkg.shsf.startup) {
					initScript += `${pkg.shsf.startup}\n`;
				}
			} catch (e) {
				console.error("Error parsing package.json:", e);
			}
		}
		initScript += `node /app/_runner.js\n`;
		await fs.writeFile(path.join(tempDir, "init.sh"), initScript);
		await fs.chmod(path.join(tempDir, "init.sh"), "755");
	}
	recordTiming("Script generation");

	const CMD = ["/bin/sh", "/app/init.sh"];

	const imageStart = Date.now();
	let imagePulled = false;
	try {
		const imageExists = await docker.listImages({
			filters: JSON.stringify({ reference: [functionData.image] }),
		});
		if (imageExists.length === 0) {
			imagePulled = true;
			const streamPull = await docker.pull(functionData.image);
			await new Promise((resolve, reject) => {
				docker.modem.followProgress(streamPull, (err) =>
					err ? reject(err) : resolve(null)
				);
			});
		}
	} catch (error) {
		console.error("Error checking or pulling image:", error);
		throw error;
	}
	recordTiming(imagePulled ? "Image pull" : "Image check");

	let ENV = functionData.env
		? JSON.parse(functionData.env).map((env: { name: string; value: any }) => `${env.name}=${env.value}`)
		: [];
	ENV.push(`RUN_DATA=${payload}`);

	BINDS.push(`${tempDir}:/app`);

	if (runtimeType === "python") {
		// Mount the persistent pip cache directory
		BINDS.push(`/tmp/shsf/.cache/pip:/pip-cache`);
	} else if (runtimeType === "node") {
		// Mount persistent caches for pnpm and npm
		BINDS.push(`/tmp/shsf/.cache/pnpm:/pnpm-cache`);
		BINDS.push(`/tmp/shsf/.cache/npm:/npm-cache`);
		
		// Check for puppeteer in package.json dependencies
		let hasPuppeteer = false;
		for (const file of files) {
			if (file.name === "package.json") {
				try {
					const pkg = JSON.parse(file.content);
					if (
						(pkg.dependencies && Object.keys(pkg.dependencies).some(dep => dep.toLowerCase().includes("puppeteer"))) ||
						(pkg.devDependencies && Object.keys(pkg.devDependencies).some(dep => dep.toLowerCase().includes("puppeteer")))
					) {
						hasPuppeteer = true;
						break;
					}
				} catch (e) { }
			}
		}
		if (hasPuppeteer) {
			const puppeteerCacheHost = `/tmp/shsf/.cache/puppeteer/function-${functionData.id}`;
			await fs.mkdir(puppeteerCacheHost, { recursive: true });
			BINDS.push(`${puppeteerCacheHost}:/root/.cache/puppeteer`);
		}
	} else {
		return {
			logs: "Unsupported runtime type",
			exit_code: 1,
			tooks: [
				...tooks,
				{ timestamp: Date.now(), value: (Date.now() - starting_time) / 1000, description: "Total execution time" },
			],
		};
	}

	const container = await docker.createContainer({
		Image: functionData.image,
		name: containerName,
		AttachStderr: true,
		AttachStdout: true,
		Tty: true,
		Cmd: CMD,
		Env: ENV,
		HostConfig: {
			Binds: BINDS,
			AutoRemove: true,
			Memory: (functionData.max_ram || 128) * 1024 * 1024,
		},
	});

	await container.start();
	recordTiming("Container start");

	const timeout = functionData.timeout || 15;
	let logs = "";

	try {
		if (stream.enabled) {
			const logStream = await new Promise<Readable>((resolve, reject) => {
				container.attach({ stream: true, stdout: true, stderr: true }, (err, stream) =>
					err ? reject(err) : resolve(stream as unknown as Readable)
				);
			});

			const killTimeout = setTimeout(() => {
				container.kill().catch(console.error);
			}, timeout * 1000);

			const ansiRegex = /\x1B\[[0-9;]*[A-Za-z]/g;
			const nonPrintableRegex = /[^\x20-\x7E\n\r\t]/g;

			logStream.on("data", (chunk) => {
				let text = Buffer.isBuffer(chunk)
					? chunk.toString("utf-8")
					: typeof chunk === "object"
					? JSON.stringify(chunk)
					: String(chunk);

				text = text.replace(ansiRegex, "").replace(nonPrintableRegex, "");
				stream.onChunk(text);
				logs += text;
			});

			await container.wait();
			recordTiming("Container execution");
			clearTimeout(killTimeout);

			// Poll for the eject file every few ms to ensure we grab it ASAP
			const ejectResult = await pollForEject(tempDir, 5, 500);
			if (ejectResult !== null) {
				func_result = JSON.stringify(ejectResult);
				const containerInspect = await container.inspect();
				recordTiming("Container cleanup");
				tooks.push({
					timestamp: Date.now(),
					value: (Date.now() - starting_time) / 1000,
					description: "Total execution time",
				});
				return {
					logs,
					result: ejectResult,
					tooks,
					exit_code: containerInspect.State.ExitCode,
				};
			}

			recordTiming("Container cleanup");
			tooks.push({
				timestamp: Date.now(),
				value: (Date.now() - starting_time) / 1000,
				description: "Total execution time",
			});
			return { logs, tooks, exit_code: 0 };
		} else {
			const result = await Promise.race([
				container.wait(),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Timeout")), timeout * 1000)
				),
			]);
			recordTiming("Container execution");

			let containerLogs = await container.logs({ stdout: true, stderr: true, follow: false });
			if (Buffer.isBuffer(containerLogs)) {
				logs = containerLogs.toString("utf-8");
			} else if (typeof containerLogs === "object") {
				logs = JSON.stringify(containerLogs);
			} else {
				logs = String(containerLogs);
			}

			logs = logs.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "").replace(/[^\x20-\x7E\n\r\t]/g, "");

			// Again, poll for the eject file at high frequency
			const ejectResult = await pollForEject(tempDir, 5, 500);
			if (ejectResult !== null) {
				func_result = JSON.stringify(ejectResult);
				recordTiming("Container cleanup");
				tooks.push({
					timestamp: Date.now(),
					value: (Date.now() - starting_time) / 1000,
					description: "Total execution time",
				});
				return { exit_code: result.StatusCode, logs, result: ejectResult, tooks };
			}

			recordTiming("Container cleanup");
			tooks.push({
				timestamp: Date.now(),
				value: (Date.now() - starting_time) / 1000,
				description: "Total execution time",
			});
			return { exit_code: result.StatusCode, logs, tooks };
		}
	} finally {
		const cleanupStart = Date.now();
		await Promise.all([fs.rm(tempDir, { recursive: true, force: true })]);
		recordTiming("Container cleanup");
		tooks.push({
			timestamp: Date.now(),
			value: (Date.now() - starting_time) / 1000,
			description: "Total execution time",
		});
		console.log(
			`[SHSF CRONS] Function ${functionData.id} (${functionData.name}) executed in ${(Date.now() - starting_time) / 1000} seconds`
		);
		await prisma.function.update({ where: { id }, data: { lastRun: new Date() } });
		try {
			await prisma.triggerLog.create({
				data: {
					functionId: id,
					logs: logs,
					result: JSON.stringify({
						payload: payload,
						exit_code: 0,
						tooks,
						output: func_result,
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
