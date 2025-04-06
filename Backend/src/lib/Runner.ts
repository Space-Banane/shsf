import { Function, FunctionFile } from "@prisma/client";
import Docker from "dockerode";
import { Readable } from "stream";
import { prisma } from "..";
import { writeFileSync } from "fs";
import { HttpContext } from "rjweb-server/lib/typings/types/implementation/contexts/http";
import { HttpRequestContext } from "rjweb-server";
import { DataContext } from "rjweb-server/lib/typings/types/internal";
import { UsableMiddleware } from "rjweb-server/lib/typings/classes/Middleware";
const tar = require("tar");
const fs = require("fs");
const path = require("path");

export async function executeFunction(
	id: number,
	functionData: Function,
	files: FunctionFile[],
	stream:
		| { enabled: true; onChunk: (data: string) => void }
		| { enabled: false },
	payload: string
) {
	const docker = new Docker();
	const containerName = `code_runner_${functionData.id}_${Date.now()}`;
	const tempDir = `/tmp/shsf/${containerName}`;
	fs.mkdirSync(tempDir, { recursive: true });
	
	// Create permanent cache directories
	fs.mkdirSync("/tmp/shsf/.cache", { recursive: true });
	fs.mkdirSync("/tmp/shsf/.cache/pnpm", { recursive: true });
	fs.mkdirSync("/tmp/shsf/.cache/pip", { recursive: true });
	fs.mkdirSync("/tmp/shsf/.cache/pip/packages", { recursive: true });

	const runtimeType = functionData.image.startsWith("python")
		? "python"
		: "node";

	let defaultStartupFile = runtimeType === "python" ? "main.py" : "index.js";
	const startupFile = functionData.startup_file || defaultStartupFile;

	for (const file of files) {
		const filePath = path.join(tempDir, file.name);
		fs.writeFileSync(filePath, file.content);
	}

	// Create a wrapper script based on runtime type
	let initScript = "#!/bin/sh\ncd /app\n";

	// Create either Python or Node wrapper based on runtime
	if (runtimeType === "python") {
		initScript += `
if [ -f "requirements.txt" ]; then 
	echo "[SHSF] --> Using Python Cache"
	
	# Create and use a local package index
	mkdir -p /pip-cache/packages
	
	# Quietly download packages to our cache if they don't exist
	echo "Checking packages from cache..."
	pip download --quiet --dest /pip-cache/packages -r requirements.txt > /dev/null 2>&1
	
	# Then quietly install from our local cache
	echo "Installing packages from cache..."
	pip install --quiet --no-index --find-links /pip-cache/packages -r requirements.txt > /dev/null 2>&1
	echo "Dependencies installed."
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

		fs.writeFileSync(wrapperPath, wrapperContent);
		initScript += `python /app/_runner.py\n`;
		fs.writeFileSync(path.join(tempDir, "init.sh"), initScript);
		fs.chmodSync(path.join(tempDir, "init.sh"), "755");
	} else if (runtimeType === "node") {
		initScript += `
# Check if package.json exists
if [ -f "package.json" ]; then 
	echo "[SHSF] --> Using Node Cache"
	# Install pnpm if not already installed
	if ! command -v pnpm &> /dev/null
	then
		echo "pnpm could not be found, installing..."
		npm install -g pnpm
	fi
	echo "Installing dependencies with pnpm..."
	# Use a shared pnpm cache directory
	mkdir -p /tmp/shsf/.cache/pnpm/store
	pnpm install --store-dir /tmp/shsf/.cache/pnpm/store --prefer-offline
fi
`;
		// Create Node wrapper script that handles main function return values
		const wrapperPath = path.join(tempDir, "_runner.js");
		const wrapperContent = `
const fs = require('fs');
const path = require('path');
const vm = require('vm');

try {
    // First try to load the module
    const targetModule = require(path.join('/app', '${startupFile}'));
    const runData = process.env.RUN_DATA;
    let mainFunction;
    
    // Check if the module exports a main function directly
    if (typeof targetModule === 'function') {
        mainFunction = targetModule;
    } 
    // Check if the module has a main function as a property
    else if (targetModule && typeof targetModule.main === 'function') {
        mainFunction = targetModule.main;
    }
    // If no main function found in exports, try evaluating the file contents
    else {
        console.log("No exported main function found. Checking for global main function...");
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
        
        // Check if a main function was defined
        if (typeof sandbox.main === 'function') {
            mainFunction = sandbox.main;
            console.log("Found global main function");
        } else {
            console.log("No main function found in module or global scope");
        }
    }
    
    // Execute main function if found
    if (mainFunction) {
        try {
            // Call the main function with the run data if provided
            let result;
            if (runData) {
                result = mainFunction(JSON.parse(runData));
            } else {
                result = mainFunction();
            }
            
            // Handle Promise results
            if (result instanceof Promise) {
                result
                    .then(finalResult => {
                        fs.writeFileSync('eject.json', JSON.stringify(finalResult));
                    })
                    .catch(err => {
                        console.error("Error in async main function:", err);
                    });
            } else {
                // Handle synchronous results
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

		fs.writeFileSync(wrapperPath, wrapperContent);
		initScript += `node /app/_runner.js\n`;
		fs.writeFileSync(path.join(tempDir, "init.sh"), initScript);
		fs.chmodSync(path.join(tempDir, "init.sh"), "755");
	}

	const CMD = ["/bin/sh", "/app/init.sh"];

	try {
		await docker.getImage(functionData.image).inspect();
	} catch {
		const stream = await docker.pull(functionData.image);
		await new Promise((resolve, reject) => {
			docker.modem.followProgress(stream, (err) =>
				err ? reject(err) : resolve(null)
			);
		});
	}

	// Function.env is for example [{"name":"TEST","value":"TEST"}]
	let ENV = functionData.env ?JSON.parse(functionData.env).map((env:{name:string;value:any}) => {
		return `${env.name}=${env.value}`;
	}) : [];
	ENV.push("RUNNER=shsf");
	ENV.push(`RUN_DATA=${payload}`); // Add the payload to the environment variables

	const container = await docker.createContainer({
		Image: functionData.image,
		name: containerName,
		AttachStderr: true,
		AttachStdout: true,
		Tty: true,
		Cmd: CMD,
		Env: ENV,
		HostConfig: {
			Binds: [
				`${tempDir}:/app`,
				// Mount the pip cache directory as a volume
				`/tmp/shsf/.cache/pip:/pip-cache`
			],
			Memory: (functionData.max_ram || 128) * 1024 * 1024,
		},
	});

	const tarStream = tar.c(
		{
			gzip: true,
			cwd: tempDir,
		},
		fs.readdirSync(tempDir)
	); // Create a tar stream of the temp directory
	await container.putArchive(tarStream, { path: "/app" }); // Upload the tar stream to the container

	await container.start();
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

			logStream.on("data", (chunk) => {
				// Ensure proper conversion of binary data to string
				let text;
				if (Buffer.isBuffer(chunk)) {
					// Handle Buffer objects properly
					text = chunk.toString("utf-8");
				} else if (typeof chunk === "object") {
					// Handle other object types
					text = JSON.stringify(chunk);
				} else {
					// For string or other primitive types
					text = String(chunk);
				}

				// Clean ANSI codes and non-printable characters
				text = text
					.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "")
					.replace(/[^\x20-\x7E\n\r\t]/g, "");

				stream.onChunk(text);
				logs += text;
			});

			await container.wait();
			clearTimeout(killTimeout);

			// Check for eject.json even in streaming mode
			const ejectFilePath = path.join(tempDir, "eject.json");
			if (fs.existsSync(ejectFilePath)) {
				const ejectData = fs.readFileSync(ejectFilePath, "utf-8");
				try {
					const ejectResult = JSON.parse(ejectData);
					return {
						logs,
						result: ejectResult,
					};
				} catch (e) {
					console.error("Error parsing eject data:", e);
				}
			}

			return { logs };
		} else {
			const result = await Promise.race([
				container.wait(),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Timeout")), timeout * 1000)
				),
			]); // Wait for the container to finish or timeout

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
					return {
						exit_code: result.StatusCode,
						logs,
						result: ejectResult,
					};
				} catch (e) {
					console.error("Error parsing eject data:", e);
				}
			}

			return {
				exit_code: result.StatusCode,
				logs,
			};
		}
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
		await container.remove();

		await prisma.function.update({
			where: { id },
			data: {
				lastRun: new Date(),
			},
		});

		console.log(
			`[SHSF CRONS] Function ${functionData.id} (${functionData.name}) executed.`	
		);
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
