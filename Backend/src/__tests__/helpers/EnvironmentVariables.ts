import { describe, expect, it } from "vitest";
import {
	mergeEnvironmentVariables,
	parseStoredEnvironmentVariables,
	serializeEnvironmentVariables,
	toDockerEnvironment,
} from "../../lib/EnvironmentVariables";

describe("EnvironmentVariables", () => {
	it("parses stored environment variables and ignores invalid entries", () => {
		expect(
			parseStoredEnvironmentVariables(
				JSON.stringify([
					{ name: " API_KEY ", value: "secret" },
					{ name: "", value: "ignored" },
					{ nope: true },
				]),
			),
		).toEqual([{ name: "API_KEY", value: "secret" }]);
	});

	it("serializes explicit empty lists for clearing stored variables", () => {
		expect(serializeEnvironmentVariables([])).toBe("[]");
	});

	it("lets function-level variables override account-wide variables", () => {
		const merged = mergeEnvironmentVariables(
			[
				{ name: "SHARED", value: "account" },
				{ name: "ACCOUNT_ONLY", value: "present" },
			],
			[
				{ name: "SHARED", value: "function" },
				{ name: "FUNCTION_ONLY", value: "present" },
			],
		);

		expect(toDockerEnvironment(merged)).toEqual([
			"SHARED=function",
			"ACCOUNT_ONLY=present",
			"FUNCTION_ONLY=present",
		]);
	});
});
