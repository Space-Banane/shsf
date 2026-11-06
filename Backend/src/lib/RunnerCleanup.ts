import Docker from "dockerode";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import { getCacheDir, getFunctionBaseDir } from "./StoragePaths";
import { createLogger } from "./logger";
const log = createLogger("Runner");

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
