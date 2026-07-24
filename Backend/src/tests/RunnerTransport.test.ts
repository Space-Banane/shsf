import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { describe, expect, it, vi } from "vitest";
import {
	getRunnerTransportPaths,
	handleStorageRpcRequest,
	prepareRunnerTransport,
	readRunnerResult,
	revokeLegacyFunctionDbTokens,
	startCallFuncBridge,
} from "../lib/RunnerTransport";
import {
	FunctionStorageService,
	StorageServiceError,
} from "../lib/FunctionStorageService";
import {
	DbComScriptGO,
	DbComScriptPY,
	DbComScriptJS,
	CallFuncScriptPY,
	CallFuncScriptGO,
	CallFuncScriptJS,
} from "../lib/RunnerScripts";
import {
	generateGoRunnerWrapperCode,
	generatePythonRunnerScript,
	generateNodeJsRunnerScript,
	generateNodeJsRunnerShScript,
	generateNodeJsInitBody,
} from "../lib/RunnerRuntimeScripts";

type TestStorageDb = NonNullable<
	ConstructorParameters<typeof FunctionStorageService>[0]
>;

vi.mock("../index.js", () => ({
	prisma: {
		accessToken: {
			deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
	},
}));

describe("RunnerTransport result files", () => {
	it("reads a valid result file", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shsf-transport-"));
		const paths = getRunnerTransportPaths(dir);
		await prepareRunnerTransport(paths);
		await fs.writeFile(paths.resultPath, JSON.stringify({ ok: true }));

		await expect(readRunnerResult(paths.resultPath)).resolves.toEqual({
			status: "ok",
			raw: JSON.stringify({ ok: true }),
			result: { ok: true },
		});
	});

	it("reports missing and malformed result files", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shsf-transport-"));
		const paths = getRunnerTransportPaths(dir);
		await prepareRunnerTransport(paths);

		await expect(readRunnerResult(paths.resultPath)).resolves.toEqual({
			status: "missing",
			raw: null,
			result: null,
		});

		await fs.writeFile(paths.resultPath, "{not json");
		const result = await readRunnerResult(paths.resultPath);
		expect(result.status).toBe("malformed");
		if (result.status === "malformed") {
			expect(result.raw).toBe("{not json");
			expect(result.error).toBeInstanceOf(Error);
		}
	});
});

describe("RunnerTransport storage RPC", () => {
	it("dispatches storage operations for the function owner", async () => {
		const service = {
			setStorageItem: vi.fn().mockResolvedValue({ key: "k", value: "v" }),
		} as unknown as FunctionStorageService;

		const response = await handleStorageRpcRequest({
			userId: 42,
			service,
			request: {
				operation: "set",
				args: { storageName: "s", key: "k", value: "v" },
			},
		});

		expect(service.setStorageItem).toHaveBeenCalledWith(42, "s", {
			key: "k",
			value: "v",
			expiresAt: undefined,
		});
		expect(response).toEqual({ status: "OK", data: { key: "k", value: "v" } });
	});

	it("returns structured errors for invalid storage operations", async () => {
		const service = {
			getStorageItem: vi
				.fn()
				.mockRejectedValue(new StorageServiceError(404, "Item not found")),
		} as unknown as FunctionStorageService;

		const response = await handleStorageRpcRequest({
			userId: 42,
			service,
			request: {
				operation: "get_item",
				args: { storageName: "s", key: "missing" },
			},
		});

		expect(response).toEqual({
			status: "FAILED",
			statusCode: 404,
			message: "Item not found",
		});
	});
});

describe("FunctionStorageService", () => {
	it("scopes storage lookup by owner", async () => {
		const db = {
			functionStorage: {
				findFirst: vi.fn().mockResolvedValue(null),
				create: vi.fn().mockResolvedValue({ id: 1, name: "s", user: 42 }),
			},
			functionStorageItem: {},
		} as unknown as TestStorageDb;
		const service = new FunctionStorageService(db);

		await service.createStorage(42, "s", "purpose");

		expect(db.functionStorage.findFirst).toHaveBeenCalledWith({
			where: { name: "s", user: 42 },
		});
		expect(db.functionStorage.create).toHaveBeenCalledWith({
			data: { name: "s", purpose: "purpose", user: 42 },
		});
	});

	it("removes expired items and returns parsed valid items", async () => {
		const expired = {
			id: 1,
			key: "old",
			value: "old",
			storageId: 10,
			expiresAt: new Date(Date.now() - 1000),
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		const valid = {
			id: 2,
			key: "new",
			value: JSON.stringify({ ok: true }),
			storageId: 10,
			expiresAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		const db = {
			functionStorage: {
				findFirst: vi.fn().mockResolvedValue({ id: 10, name: "s", user: 42 }),
			},
			functionStorageItem: {
				findMany: vi.fn().mockResolvedValue([expired, valid]),
				deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
			},
		} as unknown as TestStorageDb;
		const service = new FunctionStorageService(db);

		const result = await service.listStorageItems(42, "s");

		expect(result).toEqual([{ ...valid, value: { ok: true } }]);
		expect(db.functionStorageItem.deleteMany).toHaveBeenCalledWith({
			where: { id: { in: [1] } },
		});
	});
});

describe("generated transport scripts", () => {
	it("use result files instead of stdout result markers", () => {
		const scripts = [
			generatePythonRunnerScript("main.py"),
			generateGoRunnerWrapperCode(),
			generateNodeJsRunnerScript("index.js"),
		];

		for (const script of scripts) {
			expect(script).toContain("result");
			expect(script).not.toContain("SHSF_FUNCTION_RESULT_START");
			expect(script).not.toContain("SHSF_FUNCTION_RESULT_END");
		}
	});

	it("storage helpers use the filesystem bridge and do not embed API credentials", () => {
		for (const script of [DbComScriptPY, DbComScriptGO, DbComScriptJS]) {
			expect(script).toContain("SHSF_STORAGE_REQUEST_DIR");
			expect(script).toContain("SHSF_STORAGE_RESPONSE_DIR");
			expect(script).not.toContain("ACCESS_KEY");
			expect(script).not.toContain("{{AUTHKEY}}");
			expect(script).not.toContain("{{API}}");
		}
		expect(DbComScriptPY).not.toContain("import requests");
		expect(DbComScriptJS).not.toContain("require('http')");
	});
});

describe("Node.js runtime scripts", () => {
	it("runner script embeds the startup file", () => {
		const script = generateNodeJsRunnerScript("handler.js");
		expect(script).toContain("handler.js");
		expect(script).toContain("require('/app/handler.js')");
	});

	it("runner script handles binary transport normalization", () => {
		const script = generateNodeJsRunnerScript("index.js");
		expect(script).toContain("base64-bytes-v1");
		expect(script).toContain("normalizeForTransport");
		expect(script).toContain("Buffer.isBuffer");
	});

	it("shell wrapper sources the env file and delegates to node", () => {
		const sh = generateNodeJsRunnerShScript();
		expect(sh).toContain(".shsf_env");
		expect(sh).toContain("node /app/_shsf_runner.js");
	});

	it("init body installs npm packages and creates node_modules symlink", () => {
		const body = generateNodeJsInitBody(42);
		expect(body).toContain("npm install");
		expect(body).toContain("function-42");
		expect(body).toContain("node_modules");
		expect(body).toContain("package.json");
	});

	it("init body includes ffmpeg installation when requested", () => {
		const body = generateNodeJsInitBody(1, { ffmpeg_install: true });
		expect(body).toContain("ffmpeg");
	});

	it("init body skips ffmpeg installation when not requested", () => {
		const body = generateNodeJsInitBody(1, { ffmpeg_install: false });
		expect(body).not.toContain("ffmpeg");
	});
});

describe("legacy function DB token cleanup", () => {
	it("deletes hidden legacy function DB tokens", async () => {
		const { prisma } = await import("../index.js");
		await revokeLegacyFunctionDbTokens();
		expect(prisma.accessToken.deleteMany).toHaveBeenCalledWith({
			where: {
				name: "__function_db_access__",
				hidden: true,
			},
		});
	});
});

describe("callF transport paths", () => {
	it("includes callfunc request and response dirs", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shsf-callfunc-"));
		const paths = getRunnerTransportPaths(dir);
		expect(paths.callFuncRequestDir).toBe(path.join(dir, "callfunc-requests"));
		expect(paths.callFuncResponseDir).toBe(path.join(dir, "callfunc-responses"));
	});

	it("prepareRunnerTransport creates callfunc dirs", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shsf-callfunc-"));
		const paths = getRunnerTransportPaths(dir);
		await prepareRunnerTransport(paths);
		await expect(fs.access(paths.callFuncRequestDir)).resolves.toBeUndefined();
		await expect(fs.access(paths.callFuncResponseDir)).resolves.toBeUndefined();
	});
});

describe("callF bridge", () => {
	it("dispatches a callF request to the executor and writes the response", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shsf-callfunc-"));
		const reqDir = path.join(dir, "callfunc-requests");
		const respDir = path.join(dir, "callfunc-responses");
		await fs.mkdir(reqDir, { recursive: true });
		await fs.mkdir(respDir, { recursive: true });

		const executor = vi.fn().mockResolvedValue({ hello: "world" });
		const bridge = startCallFuncBridge({
			requestDir: reqDir,
			responseDir: respDir,
			execute: executor,
			pollIntervalMs: 10,
		});

		const requestId = "test-request-123";
		const requestPath = path.join(reqDir, `${requestId}.json`);
		const responsePath = path.join(respDir, `${requestId}.json`);
		await fs.writeFile(
			requestPath,
			JSON.stringify({ id: requestId, functionName: "myFunc", args: { key: "val" } }),
		);

		// Wait for the bridge to process the request
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			try {
				await fs.access(responsePath);
				break;
			} catch {
				await new Promise((r) => setTimeout(r, 20));
			}
		}

		await bridge.stop();

		const raw = await fs.readFile(responsePath, "utf8");
		const response = JSON.parse(raw);
		expect(response.status).toBe("OK");
		expect(response.data).toEqual({ hello: "world" });
		expect(executor).toHaveBeenCalledWith("myFunc", { key: "val" });
	});

	it("writes a FAILED response when the executor throws", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shsf-callfunc-fail-"));
		const reqDir = path.join(dir, "callfunc-requests");
		const respDir = path.join(dir, "callfunc-responses");
		await fs.mkdir(reqDir, { recursive: true });
		await fs.mkdir(respDir, { recursive: true });

		const executor = vi.fn().mockRejectedValue(new Error("Function not found"));
		const bridge = startCallFuncBridge({
			requestDir: reqDir,
			responseDir: respDir,
			execute: executor,
			pollIntervalMs: 10,
		});

		const requestId = "fail-request-456";
		const requestPath = path.join(reqDir, `${requestId}.json`);
		const responsePath = path.join(respDir, `${requestId}.json`);
		await fs.writeFile(
			requestPath,
			JSON.stringify({ id: requestId, functionName: "missing", args: {} }),
		);

		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			try {
				await fs.access(responsePath);
				break;
			} catch {
				await new Promise((r) => setTimeout(r, 20));
			}
		}

		await bridge.stop();

		const raw = await fs.readFile(responsePath, "utf8");
		const response = JSON.parse(raw);
		expect(response.status).toBe("FAILED");
		expect(response.message).toBe("Function not found");
	});

	it("writes a FAILED response for a request missing functionName", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shsf-callfunc-noname-"));
		const reqDir = path.join(dir, "callfunc-requests");
		const respDir = path.join(dir, "callfunc-responses");
		await fs.mkdir(reqDir, { recursive: true });
		await fs.mkdir(respDir, { recursive: true });

		const executor = vi.fn();
		const bridge = startCallFuncBridge({
			requestDir: reqDir,
			responseDir: respDir,
			execute: executor,
			pollIntervalMs: 10,
		});

		const requestId = "noname-request-789";
		await fs.writeFile(
			path.join(reqDir, `${requestId}.json`),
			JSON.stringify({ id: requestId, args: {} }),
		);

		const responsePath = path.join(respDir, `${requestId}.json`);
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			try {
				await fs.access(responsePath);
				break;
			} catch {
				await new Promise((r) => setTimeout(r, 20));
			}
		}

		await bridge.stop();

		const raw = await fs.readFile(responsePath, "utf8");
		const response = JSON.parse(raw);
		expect(response.status).toBe("FAILED");
		expect(executor).not.toHaveBeenCalled();
	});
});

describe("callF client scripts", () => {
	it("Python script uses SHSF_CALLFUNC env vars for RPC dirs", () => {
		expect(CallFuncScriptPY).toContain("SHSF_CALLFUNC_REQUEST_DIR");
		expect(CallFuncScriptPY).toContain("SHSF_CALLFUNC_RESPONSE_DIR");
		expect(CallFuncScriptPY).toContain("callF");
		expect(CallFuncScriptPY).toContain("functionName");
	});

	it("Go script uses SHSF_CALLFUNC env vars for RPC dirs", () => {
		expect(CallFuncScriptGO).toContain("SHSF_CALLFUNC_REQUEST_DIR");
		expect(CallFuncScriptGO).toContain("SHSF_CALLFUNC_RESPONSE_DIR");
		expect(CallFuncScriptGO).toContain("CallF");
		expect(CallFuncScriptGO).toContain("FunctionName");
	});

	it("Node.js script uses SHSF_CALLFUNC env vars for RPC dirs", () => {
		expect(CallFuncScriptJS).toContain("SHSF_CALLFUNC_REQUEST_DIR");
		expect(CallFuncScriptJS).toContain("SHSF_CALLFUNC_RESPONSE_DIR");
		expect(CallFuncScriptJS).toContain("callF");
		expect(CallFuncScriptJS).toContain("functionName");
	});

	it("client scripts do not embed credentials or API base URLs", () => {
		for (const script of [CallFuncScriptPY, CallFuncScriptGO, CallFuncScriptJS]) {
			expect(script).not.toContain("ACCESS_KEY");
			expect(script).not.toContain("{{AUTHKEY}}");
			expect(script).not.toContain("{{API}}");
		}
	});

	it("client scripts write atomic requests using tmp+rename", () => {
		expect(CallFuncScriptPY).toContain(".tmp");
		expect(CallFuncScriptGO).toContain(".tmp");
		expect(CallFuncScriptJS).toContain(".tmp");
	});
});
