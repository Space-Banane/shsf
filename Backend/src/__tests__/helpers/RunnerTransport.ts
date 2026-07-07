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
} from "../../lib/RunnerTransport";
import {
	FunctionStorageService,
	StorageServiceError,
} from "../../lib/FunctionStorageService";
import {
	DbComScriptCS,
	DbComScriptGO,
	DbComScriptPY,
	ShsfRuntimeScriptCS,
} from "../../lib/RunnerScripts";
import {
	generateDotnetRunnerScript,
	generateGoRunnerWrapperCode,
	generatePythonRunnerScript,
} from "../../lib/RunnerRuntimeScripts";

type TestStorageDb = NonNullable<
	ConstructorParameters<typeof FunctionStorageService>[0]
>;

vi.mock("../../index.js", () => ({
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
			generateDotnetRunnerScript("app.csproj"),
			ShsfRuntimeScriptCS,
		];

		for (const script of scripts) {
			expect(script).toContain("result");
			expect(script).not.toContain("SHSF_FUNCTION_RESULT_START");
			expect(script).not.toContain("SHSF_FUNCTION_RESULT_END");
		}
	});

	it("storage helpers use the filesystem bridge and do not embed API credentials", () => {
		for (const script of [DbComScriptPY, DbComScriptGO, DbComScriptCS]) {
			expect(script).toContain("SHSF_STORAGE_REQUEST_DIR");
			expect(script).toContain("SHSF_STORAGE_RESPONSE_DIR");
			expect(script).not.toContain("ACCESS_KEY");
			expect(script).not.toContain("{{AUTHKEY}}");
			expect(script).not.toContain("{{API}}");
		}
		expect(DbComScriptPY).not.toContain("import requests");
	});
});

describe("legacy function DB token cleanup", () => {
	it("deletes hidden legacy function DB tokens", async () => {
		const { prisma } = await import("../../index.js");
		await revokeLegacyFunctionDbTokens();
		expect(prisma.accessToken.deleteMany).toHaveBeenCalledWith({
			where: {
				name: "__function_db_access__",
				hidden: true,
			},
		});
	});
});
