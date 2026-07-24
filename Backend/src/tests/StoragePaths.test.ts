import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
	getCacheDir,
	getFunctionAppDir,
	getFunctionBaseDir,
	getFunctionExecutionDir,
	getFunctionExecutionsDir,
	getGitRepoDir,
	getShsfDataRoot,
} from "../lib/StoragePaths";

const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");

function mockPlatform(platform: NodeJS.Platform) {
	Object.defineProperty(process, "platform", {
		value: platform,
	});
}

describe("StoragePaths", () => {
	afterEach(() => {
		if (originalPlatform) {
			Object.defineProperty(process, "platform", originalPlatform);
		}
	});

	it("uses /opt/shsf_data outside Windows", () => {
		mockPlatform("linux");

		expect(getShsfDataRoot()).toBe("/opt/shsf_data");
		expect(getFunctionBaseDir(18)).toBe(
			path.join("/opt/shsf_data", "functions", "18"),
		);
		expect(getFunctionAppDir(18)).toBe(
			path.join("/opt/shsf_data", "functions", "18", "app"),
		);
		expect(getFunctionExecutionsDir(18)).toBe(
			path.join("/opt/shsf_data", "functions", "18", "executions"),
		);
		expect(getFunctionExecutionDir(18, "exec-123")).toBe(
			path.join("/opt/shsf_data", "functions", "18", "executions", "exec-123"),
		);
		expect(getGitRepoDir(18)).toBe(
			path.join("/opt/shsf_data", "functions", "18", "git_repo"),
		);
		expect(getCacheDir("pip", "venv", "function-18")).toBe(
			path.join("/opt/shsf_data", "cache", "pip", "venv", "function-18"),
		);
	});

	it("uses Backend/shsf_data for Windows local development", () => {
		mockPlatform("win32");
		const expectedRoot = path.resolve(process.cwd(), "shsf_data");

		expect(getShsfDataRoot()).toBe(expectedRoot);
		expect(getFunctionBaseDir("18")).toBe(
			path.join(expectedRoot, "functions", "18"),
		);
		expect(getFunctionAppDir("18")).toBe(
			path.join(expectedRoot, "functions", "18", "app"),
		);
		expect(getFunctionExecutionsDir("18")).toBe(
			path.join(expectedRoot, "functions", "18", "executions"),
		);
		expect(getFunctionExecutionDir("18", "exec-123")).toBe(
			path.join(expectedRoot, "functions", "18", "executions", "exec-123"),
		);
		expect(getGitRepoDir("18")).toBe(
			path.join(expectedRoot, "functions", "18", "git_repo"),
		);
		expect(getCacheDir("pip")).toBe(path.join(expectedRoot, "cache", "pip"));
	});
});
