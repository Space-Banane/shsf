import { describe, expect, it } from "vitest";
import {
	getFunctionRuntime,
	isDependencyFilename,
} from "../lib/FunctionDependencies";

describe("FunctionDependencies", () => {
	it("recognizes the supported runtime families", () => {
		expect(getFunctionRuntime("python:3.12")).toBe("python");
		expect(getFunctionRuntime("golang:1.23")).toBe("golang");
		expect(getFunctionRuntime("node:20")).toBe("node");
		expect(getFunctionRuntime("node:22")).toBe("node");
		expect(getFunctionRuntime("node:24")).toBe("node");
		expect(getFunctionRuntime("unknown:1.0")).toBe("unsupported");
	});

	it("recognizes dependency manifests for all supported runtimes", () => {
		expect(isDependencyFilename("requirements.txt")).toBe(true);
		expect(isDependencyFilename("go.mod")).toBe(true);
		expect(isDependencyFilename("go.sum")).toBe(true);
		expect(isDependencyFilename("package.json")).toBe(true);
		expect(isDependencyFilename("package-lock.json")).toBe(true);
		expect(isDependencyFilename("main.py")).toBe(false);
		expect(isDependencyFilename("index.js")).toBe(false);
	});
});
