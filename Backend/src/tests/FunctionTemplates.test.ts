import { describe, expect, it } from "vitest";
import { FUNCTION_TEMPLATES, getTemplatesForRuntime } from "../lib/FunctionTemplates";

describe("Function templates", () => {
	it("keeps every starter available for each supported runtime", () => {
		expect(getTemplatesForRuntime("python:3.13")).toHaveLength(3);
		expect(getTemplatesForRuntime("golang:1.23")).toHaveLength(3);
		expect(getTemplatesForRuntime("node:24")).toHaveLength(3);
	});

	it("declares runnable metadata for every catalog entry", () => {
		expect(FUNCTION_TEMPLATES).toHaveLength(10);
		for (const template of FUNCTION_TEMPLATES) {
			expect(template.fileName).toBeTruthy();
			expect(template.description).toBeTruthy();
			expect(template.setup).toBeTruthy();
			expect(template.samplePayload).toBeDefined();
		}
	});
});
