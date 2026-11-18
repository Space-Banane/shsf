import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { spawn } from "child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRuntimeCommand } from "../lib/RunnerRuntimeAdapter";
import {
	getRunnerTransportPaths,
	handleStorageRpcRequest,
	prepareRunnerTransport,
	readRunnerResult,
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
	generatePythonDependencyInstallScript,
	generatePythonInitBody,
	generateExecutionCommand,
	generateExecutionSupervisorScript,
} from "../lib/RunnerRuntimeScripts";

type TestStorageDb = NonNullable<
	ConstructorParameters<typeof FunctionStorageService>[0]
>;

const tempDirs: string[] = [];
const makeTempDir = async (prefix: string) => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
};

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("RunnerTransport result files", () => {
	it("reads a valid result file", async () => {
		const dir = await makeTempDir("shsf-transport-");
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
		const dir = await makeTempDir("shsf-transport-");
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

	it("filters expired items in the query and returns parsed paginated items", async () => {
		const valid = {
			id: 2,
			key: "new",
			value: JSON.stringify({ ok: true }),
			expiresAt: null,
		};
		const db = {
			functionStorage: {
				findFirst: vi.fn().mockResolvedValue({ id: 10, name: "s", user: 42 }),
			},
			functionStorageItem: {
				count: vi.fn().mockResolvedValue(1),
				findMany: vi.fn().mockResolvedValue([valid]),
				deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
			},
		} as unknown as TestStorageDb;
		const service = new FunctionStorageService(db);

		const result = await service.listStorageItems(42, "s", { skip: 0, take: 25 });

		expect(result).toEqual({ items: [{ ...valid, value: { ok: true } }], total: 1 });
		expect(db.functionStorageItem.deleteMany).toHaveBeenCalledWith({
			where: { storageId: 10, expiresAt: { lt: expect.any(Date) } },
		});
		expect(db.functionStorageItem.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					storageId: 10,
					OR: [{ expiresAt: null }, { expiresAt: { gte: expect.any(Date) } }],
				},
				skip: 0,
				take: 25,
				select: { id: true, key: true, value: true, expiresAt: true },
			}),
		);
	});
});

describe("generated transport scripts", () => {
	it("supervises each execution with a private cancellation FIFO and timeout", () => {
		const script = generateExecutionSupervisorScript();
		expect(script).toContain("setsid");
		expect(script).toContain("cancel_path");
		expect(script).toContain("mkfifo");
		expect(script).toContain("timeout --signal=TERM --kill-after=1s");
		expect(script).toContain("kill -KILL");
	});

	it("uses native timeout for non-streaming executions", () => {
		expect(generateExecutionCommand(["/app/_runner.py"], 15, false)).toEqual([
			"timeout",
			"--signal=TERM",
			"--kill-after=1s",
			"15",
			"/app/_runner.py",
		]);
	});

	it("keeps the isolated supervisor for cancellable executions", () => {
		expect(generateExecutionCommand(["/app/_runner.py"], 15, true)).toEqual([
			"/bin/sh",
			"-c",
			generateExecutionSupervisorScript(),
			"--",
			"/executions/$SHSF_EXECUTION_ID/cancel",
			"15",
			"/app/_runner.py",
		]);
	});

	it("terminates a timed-out process while a completion before the deadline succeeds", async () => {
		const dir = await makeTempDir("shsf-supervisor-");
		const paths = getRunnerTransportPaths(dir);
		const run = (timeoutSeconds: string, command: string[]) =>
			new Promise<number | null>((resolve, reject) => {
				const child = spawn("/bin/sh", [
					"-c",
					generateExecutionSupervisorScript(),
					"--",
					paths.cancellationPath,
					timeoutSeconds,
					...command,
				]);
				child.on("error", reject);
				child.on("exit", resolve);
			});

		await expect(run("1", ["/bin/sh", "-c", "sleep 0.02"])).resolves.toBe(0);
		await expect(run("0.1", ["/bin/sh", "-c", "sleep 5"])).resolves.toBe(124);
		await fs.rm(dir, { recursive: true, force: true });
		await expect(fs.access(dir)).rejects.toThrow();
	});

	it("cancels only the execution with the cancellation marker", async () => {
		const dir = await makeTempDir("shsf-supervisor-");
		const first = getRunnerTransportPaths(path.join(dir, "first"));
		const second = getRunnerTransportPaths(path.join(dir, "second"));
		await Promise.all([prepareRunnerTransport(first), prepareRunnerTransport(second)]);
		const run = (paths: ReturnType<typeof getRunnerTransportPaths>, command: string) =>
			new Promise<number | null>((resolve, reject) => {
				const child = spawn("/bin/sh", [
					"-c", generateExecutionSupervisorScript(), "--", paths.cancellationPath,
					"5", "/bin/sh", "-c", command,
				]);
				child.on("error", reject);
				child.on("exit", resolve);
			});
		const waitForFifo = async (fifoPath: string) => {
				const deadline = Date.now() + 1000;
				while (Date.now() < deadline) {
					try {
						if ((await fs.stat(fifoPath)).isFIFO()) return;
					} catch {
						// The supervisor has not created its cancellation FIFO yet.
					}
					await new Promise((resolve) => setTimeout(resolve, 5));
				}
				throw new Error(`Timed out waiting for cancellation FIFO: ${fifoPath}`);
			};

		const cancelled = run(first, "sleep 5");
		const completed = run(second, "sleep 0.02");
		await waitForFifo(first.cancellationPath);
		await fs.writeFile(first.cancellationPath, "client");
		await expect(cancelled).resolves.not.toBe(0);
		await expect(completed).resolves.toBe(0);
		await fs.rm(dir, { recursive: true, force: true });
	});

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

type WrapperRuntime = "python" | "node";

function runWrapper(command: string[], cwd: string) {
	return new Promise<{ status: number | null; stdout: string; stderr: string }>(
		(resolve, reject) => {
			const child = spawn(command[0], command.slice(1), { cwd });
			let stdout = "";
			let stderr = "";
			child.stdout.on("data", (chunk) => (stdout += chunk));
			child.stderr.on("data", (chunk) => (stderr += chunk));
			child.on("error", reject);
			child.on("close", (status) => resolve({ status, stdout, stderr }));
		},
	);
}

/**
 * Runs the real generated wrapper outside a container. The wrapper lives in the
 * temp app directory instead of `/app`, but the command shape, payload and
 * result paths come from the same command builder and transport layout that
 * `RunnerInvocation` uses in production. The process starts from a sibling
 * working directory so the app directory has to be resolved from the wrapper's
 * own location.
 */
async function runGeneratedWrapper(
	runtime: WrapperRuntime,
	source: string,
	payload: unknown,
	envFile?: string,
) {
	const appDir = await makeTempDir(`shsf-${runtime}-wrapper-`);
	const startupFile = runtime === "python" ? "main.py" : "index.js";
	await fs.writeFile(path.join(appDir, startupFile), source);
	if (envFile) {
		await fs.writeFile(path.join(appDir, ".shsf_env"), envFile);
	}

	const paths = getRunnerTransportPaths(path.join(appDir, "execution"));
	await prepareRunnerTransport(paths);
	await fs.writeFile(paths.payloadPath, JSON.stringify(payload));

	const runnerPath = path.join(
		appDir,
		runtime === "python" ? "_runner.py" : "_runner.sh",
	);
	await fs.writeFile(
		runnerPath,
		runtime === "python"
			? generatePythonRunnerScript(startupFile)
			: generateNodeJsRunnerShScript(),
	);
	if (runtime === "node") {
		await fs.writeFile(
			path.join(appDir, "_shsf_runner.js"),
			generateNodeJsRunnerScript(startupFile),
		);
	}

	const workDir = path.join(appDir, "work");
	await fs.mkdir(workDir);
	const [, , payloadPath, resultPath] = getRuntimeCommand(
		runtime,
		paths.payloadPath,
		paths.resultPath,
	);
	const outcome = await runWrapper(
		["/bin/sh", runnerPath, payloadPath, resultPath],
		workDir,
	);

	return { paths, outcome };
}

describe("generated runner wrappers", () => {
	it.each([
		[
			"python",
			'def main(data):\n\treturn {"echo": data, "answer": 42}\n',
			'{"echo": {"question": "life"}, "answer": 42}',
		],
		[
			"node",
			"exports.main = async (data) => ({ echo: data, answer: 42 });\n",
			'{"echo":{"question":"life"},"answer":42}',
		],
	] as const)(
		"executes the %s wrapper and writes the exact result file RunnerInvocation reads",
		async (runtime, source, expectedRaw) => {
			const { paths, outcome } = await runGeneratedWrapper(runtime, source, {
				question: "life",
			});

			expect(outcome.status).toBe(0);
			await expect(readRunnerResult(paths.resultPath)).resolves.toEqual({
				status: "ok",
				raw: expectedRaw,
				result: { echo: { question: "life" }, answer: 42 },
			});
		},
	);

	it.each([
		[
			"python",
			'import os\n\ndef main(_data):\n\treturn {"marker": os.environ.get("SHSF_TEST_MARKER")}\n',
			'{"marker": "from_wrapper_app_dir"}',
		],
		[
			"node",
			"exports.main = async () => ({ marker: process.env.SHSF_TEST_MARKER });\n",
			'{"marker":"from_wrapper_app_dir"}',
		],
	] as const)(
		"loads the %s entrypoint and environment from the wrapper's app directory",
		async (runtime, source, expectedRaw) => {
			const { paths, outcome } = await runGeneratedWrapper(
				runtime,
				source,
				{},
				"export SHSF_TEST_MARKER=from_wrapper_app_dir\n",
			);

			expect(outcome.status).toBe(0);
			await expect(readRunnerResult(paths.resultPath)).resolves.toEqual({
				status: "ok",
				raw: expectedRaw,
				result: { marker: "from_wrapper_app_dir" },
			});
		},
	);

	it.each([
		[
			"python",
			'def main(_data):\n\traise RuntimeError("boom")\n',
			/Error executing main function or serializing result: boom/,
		],
		[
			"node",
			'exports.main = async () => { throw new Error("boom"); };\n',
			/Error in main: boom/,
		],
	] as const)(
		"reports a failing %s entrypoint as a non-zero exit without a result file",
		async (runtime, source, expectedError) => {
			const { paths, outcome } = await runGeneratedWrapper(runtime, source, {});

			expect(outcome.status).not.toBe(0);
			expect(outcome.stderr).toMatch(expectedError);
			await expect(readRunnerResult(paths.resultPath)).resolves.toEqual({
				status: "missing",
				raw: null,
				result: null,
			});
		},
	);

	it.each([
		[
			"python",
			'def main(_data):\n\tvalue = {}\n\tvalue["self"] = value\n\treturn value\n',
			/Error executing main function or serializing result: Circular reference detected/,
		],
		[
			"node",
			"exports.main = async () => ({ big: 1n });\n",
			/Error in main: Do not know how to serialize a BigInt/,
		],
	] as const)(
		"refuses to persist a non-JSON %s result and exits non-zero",
		async (runtime, source, expectedError) => {
			const { paths, outcome } = await runGeneratedWrapper(runtime, source, {});

			expect(outcome.status).not.toBe(0);
			expect(outcome.stderr).toMatch(expectedError);
			await expect(readRunnerResult(paths.resultPath)).resolves.toEqual({
				status: "missing",
				raw: null,
				result: null,
			});
		},
	);

	it("keeps Go wrapper execution out of scope", () => {
		// Decision: the Go wrapper is not executed here. CI runs in
		// node:24-bookworm, which has no Go toolchain, and adding one solely for
		// this check is not worth the image cost. The Go wrapper keeps structural
		// assertions and shares the argv/result-file contract exercised above.
		const wrapper = generateGoRunnerWrapperCode();
		expect(wrapper).toContain("resultPath := os.Args[2]");
		expect(wrapper).toContain("os.Rename(tempPath, resultPath)");
	});
});

describe("Node.js runtime scripts", () => {
	it("runner script embeds the startup file", () => {
		const script = generateNodeJsRunnerScript("handler.js");
		expect(script).toContain("const appDir = __dirname;");
		expect(script).toContain("require(path.join(appDir, 'handler.js'))");
	});

	it("runner script handles binary transport normalization", () => {
		const script = generateNodeJsRunnerScript("index.js");
		expect(script).toContain("base64-bytes-v1");
		expect(script).toContain("normalizeForTransport");
		expect(script).toContain("Buffer.isBuffer");
	});

	it("shell wrapper sources the env file and delegates to node", () => {
		const sh = generateNodeJsRunnerShScript();
		expect(sh).toContain('app_dir="$(cd "$(dirname "$0")" && pwd)"');
		expect(sh).toContain(".shsf_env");
		expect(sh).toContain('exec node "$app_dir/_shsf_runner.js" "$@"');
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

describe("Python runtime scripts", () => {
	it("installs requirements in the function virtual environment", () => {
		const body = generatePythonInitBody(42, {
			ffmpeg_install: false,
			opencv_install: false,
		});
		expect(body).toContain('VENV_DIR="/pip-cache/venv/function-42"');
		expect(body).toContain("pip install --no-cache-dir -r requirements.txt");
		expect(body).toContain("req.hash");
	});

	it("manual install recreates the runner's virtual environment", () => {
		const script = generatePythonDependencyInstallScript(42);
		expect(script).toContain('VENV_DIR="/pip-cache/venv/function-42"');
		expect(script).toContain('rm -rf "$VENV_DIR"');
		expect(script).toContain('"$VENV_DIR/bin/python" -m pip install --no-cache-dir -r requirements.txt');
		expect(script).toContain("req.hash");
		expect(script).toContain(".shsf_env");
	});
});

describe("callF transport paths", () => {
	it("includes callfunc request and response dirs", async () => {
		const dir = await makeTempDir("shsf-callfunc-");
		const paths = getRunnerTransportPaths(dir);
		expect(paths.callFuncRequestDir).toBe(path.join(dir, "callfunc-requests"));
		expect(paths.callFuncResponseDir).toBe(path.join(dir, "callfunc-responses"));
		expect(paths.cancellationPath).toBe(path.join(dir, "cancel"));
	});

	it("prepareRunnerTransport creates callfunc dirs", async () => {
		const dir = await makeTempDir("shsf-callfunc-");
		const paths = getRunnerTransportPaths(dir);
		await prepareRunnerTransport(paths);
		await expect(fs.access(paths.callFuncRequestDir)).resolves.toBeUndefined();
		await expect(fs.access(paths.callFuncResponseDir)).resolves.toBeUndefined();
	});
});

describe("callF bridge", () => {
	it("dispatches a callF request to the executor and writes the response", async () => {
		const dir = await makeTempDir("shsf-callfunc-");
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
		const dir = await makeTempDir("shsf-callfunc-fail-");
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
		const dir = await makeTempDir("shsf-callfunc-noname-");
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
