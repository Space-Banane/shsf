import { describe, expect, it } from "vitest";
import { getDefaultStartupFile } from "../lib/LangOps";

describe("getDefaultStartupFile", () => {
	it("returns main.py for python images", () => {
		expect(getDefaultStartupFile("python:3.12")).toBe("main.py");
		expect(getDefaultStartupFile("python:3.13")).toBe("main.py");
	});

	it("returns main_user.go for golang images", () => {
		expect(getDefaultStartupFile("golang:1.23")).toBe("main_user.go");
		expect(getDefaultStartupFile("golang:1.22")).toBe("main_user.go");
	});

	it("returns index.js for node images", () => {
		expect(getDefaultStartupFile("node:20")).toBe("index.js");
		expect(getDefaultStartupFile("node:22")).toBe("index.js");
		expect(getDefaultStartupFile("node:24")).toBe("index.js");
	});

	it("returns empty string for unknown images", () => {
		expect(getDefaultStartupFile("unknown:1.0")).toBe("");
		expect(getDefaultStartupFile("")).toBe("");
	});
});
