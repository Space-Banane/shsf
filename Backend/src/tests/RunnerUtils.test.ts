import type { FunctionFile } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
	appendLogOutput,
	findFileByNameIgnoreCase,
	getRuntimeType,
	isHtmlStartupFile,
	parseExecutionPayloadRoute,
	resolveServeOnlyHtmlFileName,
	truncateDbField,
} from "../lib/RunnerUtils";
import { DB_FIELD_LIMIT } from "../lib/RunnerTypes";

describe("truncateDbField", () => {
	it("returns short values unchanged", () => {
		expect(truncateDbField("hello")).toBe("hello");
	});

	it("truncates values over the DB field limit and appends a marker", () => {
		const long = "x".repeat(DB_FIELD_LIMIT + 100);
		const result = truncateDbField(long);
		expect(result.length).toBe(DB_FIELD_LIMIT + "...[truncated for DB]".length);
		expect(result.endsWith("...[truncated for DB]")).toBe(true);
	});
});

describe("appendLogOutput", () => {
	it("ignores whitespace-only additions", () => {
		expect(appendLogOutput("existing", "   \n ")).toBe("existing");
	});

	it("returns trimmed next when existing is empty", () => {
		expect(appendLogOutput("", "  new line \n")).toBe("new line");
	});

	it("joins existing and next with a single newline", () => {
		expect(appendLogOutput("first\n", " second ")).toBe("first\nsecond");
	});
});

describe("getRuntimeType", () => {
	it("maps images to runtime types", () => {
		expect(getRuntimeType("python:3.12")).toBe("python");
		expect(getRuntimeType("golang:1.22")).toBe("golang");
		expect(getRuntimeType("node:20")).toBe("node");
		expect(getRuntimeType("node:22")).toBe("node");
		expect(getRuntimeType("node:24")).toBe("node");
	});
});

describe("isHtmlStartupFile", () => {
	it("matches .html files case-insensitively", () => {
		expect(isHtmlStartupFile("index.html")).toBe(true);
		expect(isHtmlStartupFile("INDEX.HTML")).toBe(true);
	});

	it("rejects non-html and empty startup files", () => {
		expect(isHtmlStartupFile("main.py")).toBe(false);
		expect(isHtmlStartupFile(null)).toBe(false);
		expect(isHtmlStartupFile(undefined)).toBe(false);
	});
});

describe("parseExecutionPayloadRoute", () => {
	it("extracts a string route from a JSON payload", () => {
		expect(parseExecutionPayloadRoute('{"route":"/about"}')).toBe("/about");
	});

	it("returns null for non-string routes or invalid JSON", () => {
		expect(parseExecutionPayloadRoute('{"route":42}')).toBe(null);
		expect(parseExecutionPayloadRoute("not json")).toBe(null);
	});
});

describe("resolveServeOnlyHtmlFileName", () => {
	it("falls back to the startup file for empty/default/root routes", () => {
		expect(resolveServeOnlyHtmlFileName("index.html", null)).toBe("index.html");
		expect(resolveServeOnlyHtmlFileName("index.html", "default")).toBe("index.html");
		expect(resolveServeOnlyHtmlFileName("index.html", "/")).toBe("index.html");
		expect(resolveServeOnlyHtmlFileName("index.html", "  ")).toBe("index.html");
	});

	it("strips query strings, fragments and leading slashes", () => {
		expect(resolveServeOnlyHtmlFileName("index.html", "/about?x=1#top")).toBe(
			"about.html",
		);
	});

	it("appends .html when the route has no extension", () => {
		expect(resolveServeOnlyHtmlFileName("index.html", "docs/intro")).toBe(
			"docs/intro.html",
		);
	});

	it("rejects path traversal attempts", () => {
		expect(resolveServeOnlyHtmlFileName("index.html", "../secret")).toBe(null);
		expect(resolveServeOnlyHtmlFileName("index.html", "a\\b")).toBe(null);
	});
});

describe("findFileByNameIgnoreCase", () => {
	const file = (name: string) => ({ name }) as FunctionFile;

	it("prefers an exact-case match over a case-insensitive one", () => {
		const files = [file("INDEX.HTML"), file("index.html")];
		expect(findFileByNameIgnoreCase(files, "index.html")?.name).toBe("index.html");
	});

	it("falls back to a case-insensitive match", () => {
		const files = [file("Index.Html")];
		expect(findFileByNameIgnoreCase(files, "index.html")?.name).toBe("Index.Html");
	});

	it("returns undefined when nothing matches", () => {
		expect(findFileByNameIgnoreCase([file("main.py")], "index.html")).toBe(
			undefined,
		);
	});
});
