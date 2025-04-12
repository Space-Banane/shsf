import { Function, FunctionFile } from "@prisma/client";
import Docker from "dockerode";
import { Readable } from "stream";
import { prisma } from "..";
import { HttpRequestContext } from "rjweb-server";
import { DataContext } from "rjweb-server/lib/typings/types/internal";
import { UsableMiddleware } from "rjweb-server/lib/typings/classes/Middleware";
import { env } from "process";
import * as fs from "fs/promises";
import path from "path";
import tar from "tar";

interface TimingEntry {
	timestamp: number;
	value: number;
	description: string;
}

// Helper function to check eject file without blocking
async function tryExtractEject(tempDir: string): Promise<any | null> {
	const ejectFilePath = path.join(tempDir, "eject.json");
	try {
		await fs.access(ejectFilePath);
		const ejectData = await fs.readFile(ejectFilePath, "utf-8");
		return JSON.parse(ejectData);
	} catch {
		return null;
	}
}

// Polling function to check for eject file every pollInterval ms up to maxDuration ms
async function pollForEject(
	tempDir: string,
	pollInterval = 8,
	maxDuration = 700
): Promise<any | null> {
	const start = Date.now();
	while (Date.now() - start < maxDuration) {
		const result = await tryExtractEject(tempDir);
		if (result !== null) {
			return result;
		}
		await new Promise((resolve) => setTimeout(resolve, pollInterval));
	}
	return null;
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

	if (runtimeType === "python") {
		initScript += `
if [ -f "requirements.txt" ]; then 
    echo "[SHSF] Using Python Cache for function ${functionData.id}"
    
    VENV_DIR="/pip-cache/function-${functionData.id}/venv"
    WHEELS_DIR="/pip-cache/function-${functionData.id}/wheels"
    HTTP_CACHE_DIR="/pip-cache/function-${functionData.id}/http-cache"
    HASH_FILE="/pip-cache/function-${functionData.id}/.hash"
    
    mkdir -p "$WHEELS_DIR" "$HTTP_CACHE_DIR"
    
    REQUIREMENTS_HASH=$(md5sum requirements.txt | awk '{print $1}')
    
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
    
    . "$VENV_DIR/bin/activate"
    
    if [ $NEEDS_UPDATE -eq 1 ]; then
        echo "Installing/updating packages in virtual environment"
        export PIP_CACHE_DIR="$HTTP_CACHE_DIR"
        pip install --upgrade pip > /dev/null 2>&1
        pip wheel --wheel-dir="$WHEELS_DIR" -r requirements.txt > /dev/null 2>&1
        pip install --no-index --find-links="$WHEELS_DIR" -r requirements.txt > /dev/null 2>&1
        echo "$REQUIREMENTS_HASH" > "$HASH_FILE"
        echo "Dependencies updated and cached in virtual environment"
    fi
    
    if ! python -c "import sys; sys.exit(0)" > /dev/null 2>&1; then
        echo "Warning: Virtual environment may be corrupted, creating fresh environment"
        rm -rf "$VENV_DIR"
        python -m venv "$VENV_DIR"
        . "$VENV_DIR/bin/activate"
        export PIP_CACHE_DIR="$HTTP_CACHE_DIR"
        pip install --upgrade pip > /dev/null 2>&1
        pip install --no-index --find-links="$WHEELS_DIR" -r requirements.txt || pip install -r requirements.txt
        echo "$REQUIREMENTS_HASH" > "$HASH_FILE"
    fi
    
    echo "Python environment ready with all dependencies"
fi
`;
		const wrapperPath = path.join(tempDir, "_runner.py");
		const wrapperContent = `
import json
import sys
import os
import traceback

sys.path.append('/app')
target_module_name = "${startupFile.replace(".py", "")}"

try:
	original_name = __name__
	__name__ = 'imported_module'
	target_module = __import__(target_module_name)
	
	run_data = os.environ.get('RUN_DATA')
	
	if hasattr(target_module, 'main') and callable(target_module.main):
		try:
			if run_data:
				result = target_module.main(json.loads(run_data))
			else:
				result = target_module.main()
			
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
		initScript += `
export NPM_CONFIG_CACHE="/npm-cache"

if [ -f "package.json" ]; then 
	echo "[SHSF] --> Using Node Cache for function ${functionData.id}"
	
	MODULES_CACHE="/pnpm-cache/function-${functionData.id}/node_modules"
	HASH_FILE="/pnpm-cache/function-${functionData.id}/.hash"
	
	mkdir -p "/pnpm-cache/function-${functionData.id}"
	
	PACKAGE_HASH=$(md5sum package.json | awk '{print $1}')
	
	if [ ! -d "$MODULES_CACHE" ] || [ ! -f "$HASH_FILE" ] || [ "$(cat $HASH_FILE 2>/dev/null)" != "$PACKAGE_HASH" ]; then
		echo "Package.json changed or first run, installing dependencies"
		rm -rf node_modules
		npm install --no-fund --no-audit --loglevel=error
		echo "Backing up node_modules for future runs"
		rm -rf "$MODULES_CACHE"
		cp -r node_modules "$MODULES_CACHE"
		echo "$PACKAGE_HASH" > "$HASH_FILE"
		echo "Dependencies installed and cached"
	else
		echo "Using cached node_modules"
		rm -rf node_modules
		cp -r "$MODULES_CACHE" node_modules
		echo "Cached node_modules restored in $(du -sh node_modules | cut -f1)"
	fi
	
	echo "Node environment ready with all dependencies"
fi
`;
		const wrapperPath = path.join(tempDir, "_runner.js");
		const wrapperContent = `
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

	let BINDS: string[] = [];
	BINDS.push(`${tempDir}:/app`);

	if (runtimeType === "python") {
		BINDS.push(`/tmp/shsf/.cache/pip:/pip-cache`);
	} else if (runtimeType === "node") {
		BINDS.push(`/tmp/shsf/.cache/pnpm:/pnpm-cache`);
		BINDS.push(`/tmp/shsf/.cache/npm:/npm-cache`);
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
			const ejectResult = await pollForEject(tempDir, 10, 500);
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
			const ejectResult = await pollForEject(tempDir, 10, 500);
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
		await Promise.all([fs.rm(tempDir, { recursive: true, force: true }), container.remove()]);
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
	}
}

export async function buildPayloadFromGET(
	ctr: DataContext<"HttpRequest", "GET", HttpRequestContext<{}>, UsableMiddleware<{}>[]>
): Promise<{ headers: Record<string, string>; queries: Record<string, string>; source_ip: string; }> {
	return {
		headers: Object.fromEntries(ctr.headers.entries()),
		queries: Object.fromEntries(ctr.queries.entries()),
		source_ip: ctr.client.ip.usual(),
	};
}

export async function buildPayloadFromPOST(
	ctr: DataContext<"HttpRequest", "POST", HttpRequestContext<{}>, UsableMiddleware<{}>[]>
): Promise<{ headers: Record<string, string>; body: string; queries: Record<string, string>; source_ip: string; }> {
	return {
		headers: Object.fromEntries(ctr.headers.entries()),
		queries: Object.fromEntries(ctr.queries.entries()),
		body: await ctr.rawBody("utf-8"),
		source_ip: ctr.client.ip.usual(),
	};
}
