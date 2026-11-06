import type { Function, FunctionFile } from "@prisma/client";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareRunnerSource } from "../lib/RunnerSource";
import { getRuntimeCommand } from "../lib/RunnerRuntimeAdapter";

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))); });

describe("runner source preparation", () => {
	it.each([
		["python", "_runner.py", "_call_func.py", "_db_com.py"],
		["golang", "_runner.sh", "callfunc/callfunc.go", "dbcom/dbcom.go"],
		["node", "_runner.sh", "_call_func.js", "_db_com.js"],
	])("writes source and helpers for %s", async (runtimeType, wrapper, callHelper, storageHelper) => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "runner-source-"));
		dirs.push(dir);
		const functionData = { id: 42, git_url: null, startup_file: "main", namespaceId: 1, executionId: "exec", ffmpeg_install: false, opencv_install: false } as Function;
		const files = [{ name: "main", content: "_db_com" }] as FunctionFile[];
		const mark = vi.fn();
		await prepareRunnerSource({ functionData, files, funcAppDir: dir, runtimeType, mark, trace: vi.fn() });
		expect(await fs.readFile(path.join(dir, "main"), "utf8")).toBe("_db_com");
		for (const file of [wrapper, callHelper, storageHelper, "init.sh"]) expect((await fs.stat(path.join(dir, file))).isFile()).toBe(true);
		expect(mark.mock.calls.map(([phase]) => phase)).toEqual(["Write user files (1)", "Generate scripts", "Storage helper script"]);
	});

	it("preserves git-managed files and an existing Go module", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "runner-git-"));
		dirs.push(dir);
		await fs.writeFile(path.join(dir, "main"), "git source");
		await fs.writeFile(path.join(dir, "go.mod"), "module existing\n");
		await prepareRunnerSource({ functionData: { id: 42, git_url: "repo", startup_file: "main" } as Function, files: [{ name: "main", content: "database source" }] as FunctionFile[], funcAppDir: dir, runtimeType: "golang", mark: vi.fn(), trace: vi.fn() });
		expect(await fs.readFile(path.join(dir, "main"), "utf8")).toBe("git source");
		expect(await fs.readFile(path.join(dir, "go.mod"), "utf8")).toBe("module existing\n");
	});
});

describe("runner runtime adapter", () => {
	it("selects each runtime wrapper and rejects unknown runtimes", () => {
		expect(getRuntimeCommand("python", "payload", "result")).toEqual(["/bin/sh", "/app/_runner.py", "payload", "result"]);
		for (const runtime of ["golang", "node"]) expect(getRuntimeCommand(runtime, "payload", "result")).toEqual(["/bin/sh", "/app/_runner.sh", "payload", "result"]);
		expect(() => getRuntimeCommand("other", "payload", "result")).toThrow("Unsupported runtime type for exec command: other");
	});
});
