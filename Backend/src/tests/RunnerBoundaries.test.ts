import type { Function, FunctionFile } from "@prisma/client";
import type Docker from "dockerode";
import { PassThrough } from "stream";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const appRoot = path.join(os.tmpdir(), `shsf-boundary-${process.pid}`);

vi.mock("../lib/StoragePaths", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../lib/StoragePaths")>();
	return {
		...actual,
		getFunctionAppDir: (id: number | string) => path.join(appRoot, String(id), "app"),
		getFunctionExecutionsDir: (id: number | string) => path.join(appRoot, String(id), "executions"),
	};
});

const mocks = vi.hoisted(() => ({ getContainer: vi.fn(), update: vi.fn(), findUnique: vi.fn() }));
vi.mock("../index", () => ({ prisma: { function: { update: mocks.update }, user: { findUnique: mocks.findUnique } } }));
vi.mock("dockerode", () => ({ default: class { getContainer = mocks.getContainer; } }));

import { prepareRunnerContainer } from "../lib/RunnerContainer";
import { deleteContainerForFunction } from "../lib/RunnerCleanup";
import { executeFunction } from "../lib/Runner";

beforeEach(async () => {
	vi.clearAllMocks();
	await fs.rm(appRoot, { recursive: true, force: true });
	await fs.mkdir(path.join(appRoot, "7", "app"), { recursive: true });
});

function createReusableContainer() {
	const stream = new PassThrough();
	const initExec = {
		start: vi.fn().mockResolvedValue(stream),
		inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
	};
	const container = {
		inspect: vi.fn().mockResolvedValue({ State: { Running: true, StartedAt: "2026-01-01T00:00:00Z" } }),
		logs: vi.fn().mockResolvedValue(Buffer.from("[SHSF] Container ready.")),
		exec: vi.fn().mockResolvedValue(initExec),
	};
	const docker = {
		getContainer: vi.fn().mockReturnValue(container),
		modem: { demuxStream: vi.fn(() => process.nextTick(() => stream.emit("end"))) },
	} as unknown as Docker;
	return { container, docker };
}

describe("container lifecycle", () => {
	it("reuses a ready container and reruns initialization", async () => {
		const { container, docker } = createReusableContainer();
		const mark = vi.fn();
		const result = await prepareRunnerContainer({ docker, functionData: { id: 7 } as Function, id: 7, functionIdStr: "7", containerName: "shsf_func_7", runtimeType: "python", mark, trace: vi.fn() });
		expect(result).toEqual({ status: "ready", container });
		expect(container.exec).toHaveBeenCalledWith({ Cmd: ["/bin/sh", "/app/init.sh"], AttachStdout: true, AttachStderr: true });
		expect(mark).toHaveBeenCalledWith("Python init/install");
	});

	it("skips initialization when its inputs are unchanged", async () => {
		const { container, docker } = createReusableContainer();
		const mark = vi.fn();
		const args = { docker, functionData: { id: 7 } as Function, id: 7, functionIdStr: "7", containerName: "shsf_func_7", runtimeType: "python" as const, mark, trace: vi.fn() };

		await prepareRunnerContainer(args);
		mark.mockClear();
		await prepareRunnerContainer(args);

		expect(container.exec).toHaveBeenCalledTimes(1);
		expect(mark).toHaveBeenCalledWith("Init skipped (unchanged)");
	});

	it("reruns initialization when its inputs change", async () => {
		const { container, docker } = createReusableContainer();
		const args = { docker, functionData: { id: 7 } as Function, id: 7, functionIdStr: "7", containerName: "shsf_func_7", runtimeType: "python" as const, mark: vi.fn(), trace: vi.fn() };

		await prepareRunnerContainer(args);
		await fs.writeFile(path.join(appRoot, "7", "app", "requirements.txt"), "requests==2.0.0\n");
		await prepareRunnerContainer(args);

		expect(container.exec).toHaveBeenCalledTimes(2);
	});

	it("blocks invocation until the ready marker appears", async () => {
		const container = { inspect: vi.fn().mockResolvedValue({ State: { Running: true, StartedAt: "2026-01-01T00:00:00Z" } }), logs: vi.fn().mockResolvedValue(Buffer.from("still starting")) };
		const docker = { getContainer: vi.fn().mockReturnValue(container) } as unknown as Docker;
		await expect(prepareRunnerContainer({ docker, functionData: { id: 7 } as Function, id: 7, functionIdStr: "7", containerName: "shsf_func_7", runtimeType: "unknown", mark: vi.fn(), trace: vi.fn() })).resolves.toEqual({ status: "not-ready" });
	});
});

describe("cleanup", () => {
	it("kills and removes a running function container", async () => {
		const container = { inspect: vi.fn().mockResolvedValue({ State: { Running: true } }), kill: vi.fn(), remove: vi.fn() };
		mocks.getContainer.mockReturnValue(container);
		await expect(deleteContainerForFunction(7)).resolves.toBe(true);
		expect(mocks.getContainer).toHaveBeenCalledWith("shsf_func_7");
		expect(container.kill).toHaveBeenCalledWith({ t: 10 });
		expect(container.remove).toHaveBeenCalledOnce();
	});
});

describe("public invocation", () => {
	it("serves HTML without starting a container", async () => {
		const functionData = { id: 7, startup_file: "index.html", namespaceId: 1, executionId: "exec" } as Function;
		const files = [{ name: "index.html", content: "<html>hello</html>" }] as FunctionFile[];
		const result = await executeFunction(7, functionData, files, { enabled: false }, "{}");
		expect(result.result).toEqual({ _shsf: "v2", _headers: { "Content-Type": "text/html; charset=utf-8" }, _code: 200, _res: "<html>hello</html>" });
		expect(result.exit_code).toBe(0);
		expect(mocks.getContainer).not.toHaveBeenCalled();
	});
});
