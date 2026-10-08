import { describe, expect, it } from "vitest";
import {
	DEFAULT_INSTANCE_SECRET,
	MIN_INSTANCE_SECRET_LENGTH,
	parseEnvironment,
} from "../lib/env";

const productionEnvironment = {
	NODE_ENV: "production",
	PORT: "3000",
	UI_URL: "https://shsf.example.com",
	REACT_APP_API_URL: "https://shsf.example.com",
	DOMAIN: "shsf.example.com",
	CORS_URLS: "https://shsf.example.com",
};

describe("parseEnvironment", () => {
	it("rejects a missing or default INSTANCE_SECRET in production", () => {
		expect(() => parseEnvironment(productionEnvironment)).toThrow(
			"INSTANCE_SECRET: must not use the default value in production",
		);
		expect(() => parseEnvironment({ ...productionEnvironment, INSTANCE_SECRET: DEFAULT_INSTANCE_SECRET })).toThrow(
			"INSTANCE_SECRET: must not use the default value in production",
		);
	});

	it("rejects short INSTANCE_SECRET values in production", () => {
		expect(() => parseEnvironment({ ...productionEnvironment, INSTANCE_SECRET: "too-short" })).toThrow(
			`INSTANCE_SECRET: must be at least ${MIN_INSTANCE_SECRET_LENGTH} characters in production`,
		);
	});

	it("accepts a configured production INSTANCE_SECRET", () => {
		const env = parseEnvironment({
			...productionEnvironment,
			INSTANCE_SECRET: "a".repeat(MIN_INSTANCE_SECRET_LENGTH),
		});

		expect(env.INSTANCE_SECRET).toHaveLength(MIN_INSTANCE_SECRET_LENGTH);
	});

	it("keeps default secrets usable in development and test", () => {
		expect(parseEnvironment({ ...productionEnvironment, NODE_ENV: "development" }).INSTANCE_SECRET).toBe(
			DEFAULT_INSTANCE_SECRET,
		);
		expect(parseEnvironment({ NODE_ENV: "test" }).INSTANCE_SECRET).toBe(DEFAULT_INSTANCE_SECRET);
	});
});
