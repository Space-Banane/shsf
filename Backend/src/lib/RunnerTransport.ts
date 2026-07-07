import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "..";
import {
	FunctionStorageService,
	StorageServiceError,
	functionStorageService,
} from "./FunctionStorageService";

export interface RunnerTransportPaths {
	executionDir: string;
	payloadPath: string;
	resultPath: string;
	storageRequestDir: string;
	storageResponseDir: string;
}

export type StorageRpcOperation =
	| "create_storage"
	| "list_storages"
	| "delete_storage"
	| "clear"
	| "set"
	| "get"
	| "get_item"
	| "list_items"
	| "delete_item"
	| "exists";

export interface StorageRpcRequest {
	id?: string;
	operation?: StorageRpcOperation;
	args?: Record<string, unknown>;
}

export function getRunnerTransportPaths(executionDir: string): RunnerTransportPaths {
	return {
		executionDir,
		payloadPath: path.join(executionDir, "payload.json"),
		resultPath: path.join(executionDir, "result.json"),
		storageRequestDir: path.join(executionDir, "storage-requests"),
		storageResponseDir: path.join(executionDir, "storage-responses"),
	};
}

export async function prepareRunnerTransport(paths: RunnerTransportPaths) {
	await Promise.all([
		fs.mkdir(paths.executionDir, { recursive: true }),
		fs.mkdir(paths.storageRequestDir, { recursive: true }),
		fs.mkdir(paths.storageResponseDir, { recursive: true }),
	]);
}

export async function readRunnerResult(resultPath: string): Promise<
	| { status: "missing"; raw: null; result: null }
	| { status: "ok"; raw: string; result: unknown }
	| { status: "malformed"; raw: string; error: Error }
> {
	let raw: string;
	try {
		raw = await fs.readFile(resultPath, "utf8");
	} catch (error: unknown) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			(error as { code?: string }).code === "ENOENT"
		) {
			return { status: "missing", raw: null, result: null };
		}
		throw error;
	}

	try {
		return { status: "ok", raw, result: JSON.parse(raw) };
	} catch (error) {
		return { status: "malformed", raw, error: error as Error };
	}
}

export async function revokeLegacyFunctionDbTokens() {
	await prisma.accessToken.deleteMany({
		where: {
			name: "__function_db_access__",
			hidden: true,
		},
	});
}

function getStringArg(args: Record<string, unknown>, name: string): string {
	const value = args[name];
	if (typeof value !== "string" || value.length === 0) {
		throw new StorageServiceError(400, `Missing or invalid ${name}`);
	}
	return value;
}

function getOptionalStringArg(args: Record<string, unknown>, name: string): string {
	const value = args[name];
	return typeof value === "string" ? value : "";
}

async function executeStorageRpc(
	service: FunctionStorageService,
	userId: number,
	request: StorageRpcRequest,
) {
	const operation = request.operation;
	const args = request.args ?? {};
	if (!operation) {
		throw new StorageServiceError(400, "Missing operation");
	}

	switch (operation) {
		case "create_storage":
			return service.createStorage(
				userId,
				getStringArg(args, "name"),
				getOptionalStringArg(args, "purpose"),
			);
		case "list_storages":
			return service.listStorages(userId);
		case "delete_storage":
			return service.deleteStorage(userId, getStringArg(args, "storageName"));
		case "clear":
			return service.clearStorageItems(userId, getStringArg(args, "storageName"));
		case "set":
			return service.setStorageItem(userId, getStringArg(args, "storageName"), {
				key: getStringArg(args, "key"),
				value: args.value,
				expiresAt:
					typeof args.expiresAt === "string" || typeof args.expiresAt === "number"
						? args.expiresAt
						: undefined,
			});
		case "get":
			return service.getStorageValue(
				userId,
				getStringArg(args, "storageName"),
				getStringArg(args, "key"),
			);
		case "get_item":
			return service.getStorageItem(
				userId,
				getStringArg(args, "storageName"),
				getStringArg(args, "key"),
			);
		case "list_items":
			return service.listStorageItems(userId, getStringArg(args, "storageName"));
		case "delete_item":
			return service.deleteStorageItem(
				userId,
				getStringArg(args, "storageName"),
				getStringArg(args, "key"),
			);
		case "exists":
			return service.storageItemExists(
				userId,
				getStringArg(args, "storageName"),
				getStringArg(args, "key"),
			);
		default:
			throw new StorageServiceError(400, `Unsupported operation ${operation}`);
	}
}

export async function handleStorageRpcRequest(
	input: {
		userId: number;
		request: StorageRpcRequest;
		service?: FunctionStorageService;
	},
) {
	try {
		const data = await executeStorageRpc(
			input.service ?? functionStorageService,
			input.userId,
			input.request,
		);
		return { status: "OK", data };
	} catch (error) {
		if (error instanceof StorageServiceError) {
			return {
				status: "FAILED",
				statusCode: error.statusCode,
				message: error.message,
			};
		}

		return {
			status: "FAILED",
			statusCode: 500,
			message: error instanceof Error ? error.message : "Unknown storage error",
		};
	}
}

async function writeJsonAtomic(filePath: string, value: unknown) {
	const tempPath = `${filePath}.tmp`;
	await fs.writeFile(tempPath, JSON.stringify(value));
	await fs.rename(tempPath, filePath);
}

async function processStorageRequestFile(
	userId: number,
	requestDir: string,
	responseDir: string,
	fileName: string,
) {
	const requestPath = path.join(requestDir, fileName);
	let raw: string;
	try {
		raw = await fs.readFile(requestPath, "utf8");
	} catch {
		return;
	}

	await fs.rm(requestPath, { force: true });

	let request: StorageRpcRequest;
	try {
		request = JSON.parse(raw);
	} catch {
		request = {};
	}

	const id = request.id || path.basename(fileName, ".json");
	const response = await handleStorageRpcRequest({ userId, request });
	await writeJsonAtomic(path.join(responseDir, `${id}.json`), response);
}

export function startStorageRpcBridge(input: {
	userId: number;
	requestDir: string;
	responseDir: string;
	pollIntervalMs?: number;
}) {
	let stopped = false;
	let running = false;
	let timer: NodeJS.Timeout | null = null;
	const pollIntervalMs = input.pollIntervalMs ?? 25;

	const tick = async () => {
		if (stopped || running) {
			return;
		}

		running = true;
		try {
			const files = await fs.readdir(input.requestDir);
			for (const fileName of files.filter((name) => name.endsWith(".json"))) {
				await processStorageRequestFile(
					input.userId,
					input.requestDir,
					input.responseDir,
					fileName,
				);
			}
		} finally {
			running = false;
		}
	};

	timer = setInterval(() => {
		tick().catch(() => undefined);
	}, pollIntervalMs);
	void tick();

	return {
		async stop() {
			stopped = true;
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
			while (running) {
				await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
			}
			await tick().catch(() => undefined);
		},
	};
}
