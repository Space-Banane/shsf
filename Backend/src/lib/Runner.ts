import { Function, FunctionFile } from "@prisma/client";
import Docker from "dockerode";
import { Readable } from "stream";
import { prisma } from "..";
import { HttpRequestContext } from "rjweb-server";
import { DataContext } from "rjweb-server/lib/typings/types/internal";
import { UsableMiddleware } from "rjweb-server/lib/typings/classes/Middleware";

const fs = require("fs");
const path = require("path");

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
	
	// Helper function to record timing information
	const recordTiming = (timestamp: number, description: string) => {
		const value = (timestamp - starting_time) / 1000; // Convert to seconds
		tooks.push({ timestamp, value, description });
	};
	
	const docker = new Docker();
	const containerName = `code_runner_${functionData.id}_${Date.now()}`;
	const tempDir = `/tmp/shsf/${containerName}`;
	const runtimeType = functionData.image.startsWith("python")
		? "python"
		: "node";
	await fs.promises.mkdir(tempDir, { recursive: true });

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

	await Promise.all(
		cacheDirs.map((dir) => fs.promises.mkdir(dir, { recursive: true }))
	);
	
	recordTiming(Date.now(), "Directory creation");

	let defaultStartupFile = runtimeType === "python" ? "main.py" : "index.js";
	const startupFile = functionData.startup_file || defaultStartupFile;

	// Write user files
	const fileWriteStart = Date.now();
	for (const file of files) {
		const filePath = path.join(tempDir, file.name);
		await fs.promises.writeFile(filePath, file.content);
	}
	recordTiming(Date.now(), "File writing");

	// Create script generation
	const scriptStart = Date.now();
	// Create a wrapper script based on runtime type
	let initScript = "#!/bin/sh\ncd /app\n";

	// Create either Python or Node wrapper based on runtime
	if (runtimeType === "python") {
		initScript += `
if [ -f "requirements.txt" ]; then 
    echo "[SHSF] Using Python Cache for function ${functionData.id}"
    
    # Define paths for our virtual environment and cache
    VENV_DIR="/pip-cache/function-${functionData.id}/venv"
    WHEELS_DIR="/pip-cache/function-${functionData.id}/wheels"
    HTTP_CACHE_DIR="/pip-cache/function-${functionData.id}/http-cache"
    HASH_FILE="/pip-cache/function-${functionData.id}/.hash"
    
    # Create directories if they don't exist
    mkdir -p "$WHEELS_DIR" "$HTTP_CACHE_DIR"
    
    # Generate a hash of requirements.txt to detect changes
    REQUIREMENTS_HASH=$(md5sum requirements.txt | awk '{print $1}')
    
    # Check if virtual environment exists and if requirements have changed
    NEEDS_UPDATE=0
    if [ ! -d "$VENV_DIR" ]; then
        echo "Creating new virtual environment for function ${functionData.id}"
        python -m venv "$VENV_DIR"
        NEEDS_UPDATE=1
    elif [ ! -f "$HASH_FILE" ] || [ "$(cat $HASH_FILE)" != "$REQUIREMENTS_HASH" ]; then
        echo "Requirements changed, updating virtual environment"
        NEEDS_UPDATE=1
    else
        echo "Requirements unchanged, using existing virtual environment"
    fi
    
    # Activate the virtual environment (always needed)
    . "$VENV_DIR/bin/activate"
    
    # Update packages if needed
    if [ $NEEDS_UPDATE -eq 1 ]; then
        echo "Installing/updating packages in virtual environment"
        
        # Configure pip to use our cache directories
        export PIP_CACHE_DIR="$HTTP_CACHE_DIR"
        
        # Ensure pip is up to date in the virtual environment
        pip install --upgrade pip > /dev/null 2>&1
        
        # First, download wheels to our cache location
        pip wheel --wheel-dir="$WHEELS_DIR" -r requirements.txt > /dev/null 2>&1
        
        # Install from the cached wheels into the virtual environment
        pip install --no-index --find-links="$WHEELS_DIR" -r requirements.txt > /dev/null 2>&1
        
        # Save the hash for future reference
        echo "$REQUIREMENTS_HASH" > "$HASH_FILE"
        echo "Dependencies updated and cached in virtual environment"
    fi
    
    # Verify the environment is usable
    if ! python -c "import sys; sys.exit(0)" > /dev/null 2>&1; then
        echo "Warning: Virtual environment may be corrupted, creating fresh environment"
        rm -rf "$VENV_DIR"
        python -m venv "$VENV_DIR"
        . "$VENV_DIR/bin/activate"
        
        # Install packages fresh
        export PIP_CACHE_DIR="$HTTP_CACHE_DIR"
        pip install --upgrade pip > /dev/null 2>&1
        pip install --no-index --find-links="$WHEELS_DIR" -r requirements.txt || pip install -r requirements.txt
        echo "$REQUIREMENTS_HASH" > "$HASH_FILE"
    fi
    
    echo "Python environment ready with all dependencies"
fi
`;
		// New wrapper script for Python that handles main function return values
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
	run_data = os.environ.get('RUN_DATA')
	
	# Look for a main function to execute
	if hasattr(target_module, 'main') and callable(target_module.main):
		try:
			# Call the main function with the run data if provided
			if run_data:
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

		await fs.promises.writeFile(wrapperPath, wrapperContent);
		initScript += `python /app/_runner.py\n`;
		await fs.promises.writeFile(path.join(tempDir, "init.sh"), initScript);
		fs.chmodSync(path.join(tempDir, "init.sh"), "755");
	} else if (runtimeType === "node") {
		initScript += `
# Set up global npm cache
export NPM_CONFIG_CACHE="/npm-cache"

# Check if package.json exists
if [ -f "package.json" ]; then 
	echo "[SHSF] --> Using Node Cache for function ${functionData.id}"
	
	# Define function-specific directories and files
	MODULES_CACHE="/pnpm-cache/function-${functionData.id}/node_modules"
	HASH_FILE="/pnpm-cache/function-${functionData.id}/.hash"
	
	# Create cache directory if it doesn't exist
	mkdir -p "/pnpm-cache/function-${functionData.id}"
	
	# Generate a hash of package.json to detect changes
	PACKAGE_HASH=$(md5sum package.json | awk '{print $1}')
	
	# Check if dependencies need to be updated
	if [ ! -d "$MODULES_CACHE" ] || [ ! -f "$HASH_FILE" ] || [ "$(cat $HASH_FILE 2>/dev/null)" != "$PACKAGE_HASH" ]; then
		echo "Package.json changed or first run, installing dependencies"
		
		# Remove any existing node_modules to prevent conflicts
		rm -rf node_modules
		
		# Install dependencies with npm (faster and more reliable than pnpm for this use case)
		npm install --no-fund --no-audit --loglevel=error
		
		# Back up the node_modules for future use
		echo "Backing up node_modules for future runs"
		rm -rf "$MODULES_CACHE"
		cp -r node_modules "$MODULES_CACHE"
		
		# Save the hash for future reference
		echo "$PACKAGE_HASH" > "$HASH_FILE"
		
		echo "Dependencies installed and cached"
	else
		echo "Using cached node_modules"
		
		# Remove any existing node_modules symlink or directory
		rm -rf node_modules
		
		# Copy the cached node_modules back
		cp -r "$MODULES_CACHE" node_modules
		
		echo "Cached node_modules restored in $(du -sh node_modules | cut -f1)"
	fi
	
	echo "Node environment ready with all dependencies"
fi
`;
		// Create Node wrapper script that handles main function return values
		const wrapperPath = path.join(tempDir, "_runner.js");
		const wrapperContent = `
const fs = require('fs');
const path = require('path');
const vm = require('vm');

try {
	console.log("Executing script...");
	const fileContent = fs.readFileSync(path.join('/app', '${startupFile}'), 'utf8');
	
	// Create a sandbox with global objects
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
	
	// Run the script in the sandbox
	vm.runInNewContext(fileContent, sandbox);
	
	// Check if a main function was defined and execute it
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

		await fs.promises.writeFile(wrapperPath, wrapperContent);
		initScript += `node /app/_runner.js\n`;
		await fs.promises.writeFile(path.join(tempDir, "init.sh"), initScript);
		await fs.promises.chmod(path.join(tempDir, "init.sh"), "755");
	}
	recordTiming(Date.now(), "Script generation");

	const CMD = ["/bin/sh", "/app/init.sh"];

	const imageStart = Date.now();
	let imagePulled = false;
	try {
		const imageExists = await docker.listImages({
			filters: JSON.stringify({ reference: [functionData.image] }),
		});
		if (imageExists.length === 0) {
			imagePulled = true;
			const stream = await docker.pull(functionData.image);
			await new Promise((resolve, reject) => {
				docker.modem.followProgress(stream, (err) =>
					err ? reject(err) : resolve(null)
				);
			});
		}
	} catch (error) {
		console.error("Error checking or pulling image:", error);
		throw error;
	}
	recordTiming(Date.now(), imagePulled ? "Image pull" : "Image check");

	// Function.env is for example [{"name":"TEST","value":"TEST"}]
	let ENV = functionData.env
		? JSON.parse(functionData.env).map((env: { name: string; value: any }) => {
				return `${env.name}=${env.value}`;
		  })
		: [];
	ENV.push(`RUN_DATA=${payload}`); // Add the payload to the environment variables

	let BINDS: string[] = [];
	BINDS.push(`${tempDir}:/app`);

	if (runtimeType === "python") {
		// Python-specific environment variables
		BINDS.push(`/tmp/shsf/.cache/pip:/pip-cache`);
	} else if (runtimeType === "node") {
		// Node-specific environment variables
		BINDS.push(`/tmp/shsf/.cache/pnpm:/pnpm-cache`);
		BINDS.push(`/tmp/shsf/.cache/npm:/npm-cache`);
	} else {
		return {
			logs: "Unsupported runtime type",
			exit_code: 1,
			tooks: [...tooks, { timestamp: Date.now(), value: (Date.now() - starting_time) / 1000, description: "Total execution time" }],
		}
	}

	const containerStart = Date.now();
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
			Memory: (functionData.max_ram || 128) * 1024 * 1024,
		},
	});

	await container.start();
	recordTiming(Date.now(), "Container creation and start");
	
	const timeout = functionData.timeout || 15;
	let logs = "";

	try {
		if (stream.enabled) {
			const logStream = await new Promise<Readable>((resolve, reject) => {
				container.attach(
					{ stream: true, stdout: true, stderr: true },
					(err, stream) =>
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

				// Clean logs using pre-compiled regex
				text = text.replace(ansiRegex, "").replace(nonPrintableRegex, "");

				stream.onChunk(text);
				logs += text;
			});

			await container.wait();
			const containerRunTime = Date.now();
			recordTiming(containerRunTime, "Container execution");
			clearTimeout(killTimeout);

			// Check for eject.json even in streaming mode
			const ejectFilePath = path.join(tempDir, "eject.json");
			if (fs.existsSync(ejectFilePath)) {
				const ejectData = fs.readFileSync(ejectFilePath, "utf-8");
				try {
					const ejectResult = JSON.parse(ejectData);
					const containerInspect = await container.inspect();
					recordTiming(Date.now(), "Total execution time");
					return {
						logs,
						result: ejectResult,
						tooks,
						exit_code: containerInspect.State.ExitCode,
					};
				} catch (e) {
					console.error("Error parsing eject data:", e);
				}
			}

			recordTiming(Date.now(), "Total execution time");
			return { 
				logs,
				tooks, 
				exit_code: 0, // We don't have the exit code in streaming mode, but we can assume success
			};
		} else {
			const result = await Promise.race([
				container.wait(),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Timeout")), timeout * 1000)
				),
			]); // Wait for the container to finish or timeout
			
			const containerRunTime = Date.now();
			recordTiming(containerRunTime, "Container execution");

			// Improve log collection for non-streaming mode
			const containerLogs = await container.logs({
				stdout: true,
				stderr: true,
				follow: false,
			});

			// Handle different types of log outputs
			if (Buffer.isBuffer(containerLogs)) {
				logs = containerLogs.toString("utf-8");
			} else if (typeof containerLogs === "object") {
				logs = JSON.stringify(containerLogs);
			} else {
				logs = String(containerLogs);
			}

			// Clean ANSI codes and non-printable characters
			logs = logs
				.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "")
				.replace(/[^\x20-\x7E\n\r\t]/g, "");

			// Checking if the container has an eject.json
			const ejectFilePath = path.join(tempDir, "eject.json");
			if (fs.existsSync(ejectFilePath)) {
				const ejectData = fs.readFileSync(ejectFilePath, "utf-8");
				try {
					const ejectResult = JSON.parse(ejectData);
					recordTiming(Date.now(), "Total execution time");
					return {
						exit_code: result.StatusCode,
						logs,
						result: ejectResult,
						tooks,
					};
				} catch (e) {
					console.error("Error parsing eject data:", e);
				}
			}

			recordTiming(Date.now(), "Total execution time");
			return {
				exit_code: result.StatusCode,
				logs,
				tooks,
			};
		}
	} finally {
		await Promise.all([
			fs.promises.rm(tempDir, { recursive: true, force: true }),
			container.remove(),
		]);

		console.log(
			`[SHSF CRONS] Function ${functionData.id} (${
				functionData.name
			}) executed in ${(Date.now() - starting_time) / 1000} seconds`
		);

		await prisma.function.update({
			where: { id },
			data: {
				lastRun: new Date(),
			},
		});
	}
}

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
}> {
	return {
		headers: Object.fromEntries(ctr.headers.entries()),
		queries: Object.fromEntries(ctr.queries.entries()),
		source_ip: ctr.client.ip.usual(),
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
}> {
	return {
		headers: Object.fromEntries(ctr.headers.entries()),
		queries: Object.fromEntries(ctr.queries.entries()),
		body: await ctr.rawBody("utf-8"),
		source_ip: ctr.client.ip.usual(),
	};
}
