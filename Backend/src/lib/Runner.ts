import { Function, FunctionFile } from "@prisma/client";
import Docker from "dockerode";
import { Readable } from "stream";
const tar = require("tar");
const fs = require("fs");
const path = require("path");

export async function executeFunction(
	id: number,
	functionData: Function,
	files: FunctionFile[],
	stream:
		| { enabled: true; onChunk: (data: string) => void }
		| { enabled: false }
) {
	const docker = new Docker();
	const containerName = `code_runner_${functionData.id}_${Date.now()}`;
	const tempDir = `/tmp/shsf/${containerName}`;
	fs.mkdirSync(tempDir, { recursive: true });

	const runtimeType = functionData.image.startsWith("python")
		? "python"
		: "node";

	let defaultStartupFile = runtimeType === "python" ? "main.py" : "index.js";
	const startupFile = functionData.startup_file || defaultStartupFile;

	for (const file of files) {
		const filePath = path.join(tempDir, file.name);
		fs.writeFileSync(filePath, file.content);
	}

	let initScript = "#!/bin/sh\ncd /app\n";

	if (runtimeType === "python") {
		initScript += `
if [ -f "requirements.txt" ]; then 
	echo "Installing dependencies with pip..."
	pip install -r requirements.txt
fi
python /app/${startupFile}
`;
		fs.writeFileSync(path.join(tempDir, "init.sh"), initScript);
		fs.chmodSync(path.join(tempDir, "init.sh"), "755");
	} else if (runtimeType === "node") {
		initScript += `
# Install pnpm if not already installed
if ! command -v pnpm &> /dev/null
then
	echo "pnpm could not be found, installing..."
	npm install -g pnpm
fi
# Check if package.json exists
if [ -f "package.json" ]; then 
	echo "Installing dependencies with pnpm..."
	pnpm install
	pnpm start
fi
node /app/${startupFile}
`;
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

	const container = await docker.createContainer({
		Image: functionData.image,
		name: containerName,
		AttachStderr: true,
		AttachStdout: true,
		Tty: true,
		Cmd: CMD,
		HostConfig: {
			AutoRemove: true,
			Binds: [`${tempDir}:/app`],
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
				const text = Buffer.from(chunk, "binary")
					.toString("utf-8") // Ensure UTF-8 encoding
						.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "") // Remove ANSI escape codes
					.replace(/[^\x20-\x7E\n\r\t]/g, "") // Remove non-printable characters
				stream.onChunk(text);
			});

			await container.wait();
			clearTimeout(killTimeout);
		} else {
			const result = await Promise.race([
				container.wait(),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Timeout")), timeout * 1000)
				),
			]);

			const logs = await container.logs({
				stdout: true,
				stderr: true,
			});

			return logs
				.toString("utf-8") // Ensure UTF-8 encoding
				.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "") // Remove ANSI escape codes
				.replace(/[^\x20-\x7E\n\r\t]/g, "") // Remove non-printable characters
				.trim();
		}
	} finally {
		// Remove the temporary directory after execution
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
}
