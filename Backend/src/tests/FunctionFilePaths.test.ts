import { describe, expect, it } from "vitest";
import {
	getFunctionFilePath,
	getParentFolderPaths,
	isValidFunctionFilePath,
} from "../lib/FunctionFilePaths";

describe("FunctionFilePaths", () => {
	it("accepts nested relative paths and derives their parent folders", () => {
		expect(isValidFunctionFilePath("handlers/http/index.ts")).toBe(true);
		expect(getParentFolderPaths("handlers/http/index.ts")).toEqual([
			"handlers",
			"handlers/http",
		]);
	});

	it("rejects traversal, absolute, empty, and Windows-style paths", () => {
		for (const invalidPath of [
			"../secret.txt",
			"/etc/passwd",
			"folder//file.ts",
			"folder/./file.ts",
			"folder\\file.ts",
		]) {
			expect(isValidFunctionFilePath(invalidPath)).toBe(false);
		}
	});

	it("resolves only inside the function application directory", () => {
		expect(getFunctionFilePath("/opt/shsf/function", "src/main.ts")).toBe(
			"/opt/shsf/function/src/main.ts",
		);
		expect(() => getFunctionFilePath("/opt/shsf/function", "../secret")).toThrow(
			"Invalid function file path",
		);
	});
});
