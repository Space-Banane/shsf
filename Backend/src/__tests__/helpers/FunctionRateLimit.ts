import { describe, expect, it, beforeEach } from "vitest";
import { env } from "process";
import {
	EXECUTION_RATELIMIT_MISSING_VALUE,
	ExecutionRateLimitIdentity,
	buildFunctionGlobalRateLimitKey,
	buildFunctionIdentityRateLimitKey,
	enforceFunctionRateLimit,
	extractExecutionIdentityValues,
	getExecutionRateLimitConfigFromData,
	getRateLimitConfigFromData,
	hasConfiguredRateLimitBuckets,
	normalizeFunctionRateLimitConfig,
	resetFunctionRateLimitState,
} from "../../lib/FunctionRateLimit";

const fallbackWindowMs = parseInt(env.RATELIMIT || "0", 10) || 0;

describe("FunctionRateLimit config parsing", () => {
	it("falls back to disabled config for empty or null input", async () => {
		expect(await getRateLimitConfigFromData(null)).toEqual({ enabled: false });
		expect(await getRateLimitConfigFromData("")).toEqual({ enabled: false });
	});

	it("preserves the legacy fallback throttle for execution when config is unset", async () => {
		expect(await getExecutionRateLimitConfigFromData(null)).toEqual(
			expect.objectContaining({
				enabled: true,
				global: {
					hits: 5,
					window_ms: fallbackWindowMs,
					penalty_ms: 400,
				},
			}),
		);
	});

	it("falls back safely for invalid JSON or invalid schema", async () => {
		expect(await getRateLimitConfigFromData("{nope")).toEqual({
			enabled: false,
		});
		expect(await getExecutionRateLimitConfigFromData("{nope")).toEqual(
			expect.objectContaining({
				enabled: true,
				global: {
					hits: 5,
					window_ms: fallbackWindowMs,
					penalty_ms: 400,
				},
			}),
		);
		expect(
			normalizeFunctionRateLimitConfig({
				enabled: true,
				global: { hits: 0, window_ms: 1000 },
			}),
		).toEqual({ enabled: false });
		expect(
			await getExecutionRateLimitConfigFromData(
				JSON.stringify({
					enabled: true,
					global: { hits: 0, window_ms: 1000 },
				}),
			),
		).toEqual(
			expect.objectContaining({
				enabled: true,
				global: {
					hits: 5,
					window_ms: fallbackWindowMs,
					penalty_ms: 400,
				},
			}),
		);
	});

	it("preserves valid identities and thresholds", async () => {
		const config = await getRateLimitConfigFromData(
			JSON.stringify({
				enabled: true,
				global: { hits: 3, window_ms: 1000, penalty_ms: 250 },
				identities: ["route", "ip", "route"],
				identity_limit: { hits: 2, window_ms: 5000 },
			}),
		);

		expect(config).toEqual({
			enabled: true,
			global: { hits: 3, window_ms: 1000, penalty_ms: 250 },
			identities: ["ip", "route"],
			identity_limit: { hits: 2, window_ms: 5000 },
		});
	});

	it("detects when an enabled config has no active buckets", () => {
		expect(
			hasConfiguredRateLimitBuckets(
				normalizeFunctionRateLimitConfig({
					enabled: true,
				}),
			),
		).toBe(false);
		expect(
			hasConfiguredRateLimitBuckets(
				normalizeFunctionRateLimitConfig({
					enabled: true,
					identities: ["ip"],
				}),
			),
		).toBe(false);
		expect(
			hasConfiguredRateLimitBuckets(
				normalizeFunctionRateLimitConfig({
					enabled: true,
					policies: [
						{
							scope: "global",
							enabled: false,
							rule: { hits: 1, window_ms: 1000 },
						},
					],
				}),
			),
		).toBe(false);
		expect(
			hasConfiguredRateLimitBuckets(
				normalizeFunctionRateLimitConfig({
					enabled: true,
					global: { hits: 2, window_ms: 1000 },
				}),
			),
		).toBe(true);
		expect(
			hasConfiguredRateLimitBuckets(
				normalizeFunctionRateLimitConfig({
					enabled: true,
					identities: ["ip"],
					identity_limit: { hits: 2, window_ms: 1000 },
				}),
			),
		).toBe(true);
		expect(
			hasConfiguredRateLimitBuckets(
				normalizeFunctionRateLimitConfig({
					enabled: true,
					policies: [
						{
							scope: "global",
							rule: { hits: 1, window_ms: 1000 },
						},
					],
				}),
			),
		).toBe(true);
	});
});

describe("FunctionRateLimit key building", () => {
	it("builds a single identity key", () => {
		const key = buildFunctionIdentityRateLimitKey(9, ["ip"], {
			ip: "1.2.3.4",
			method: "GET",
			route: "default",
			origin: EXECUTION_RATELIMIT_MISSING_VALUE,
			access_key: EXECUTION_RATELIMIT_MISSING_VALUE,
			secure_header: EXECUTION_RATELIMIT_MISSING_VALUE,
			guest_session: EXECUTION_RATELIMIT_MISSING_VALUE,
			execution_alias_or_id: "exec-id",
		});

		expect(key).toBe("function:9:identity:ip=1.2.3.4");
	});

	it("builds a composite key using stable ordering", () => {
		const key = buildFunctionIdentityRateLimitKey(5, ["route", "ip"], {
			ip: "1.2.3.4",
			method: "POST",
			route: "nested",
			origin: "https://example.com",
			access_key: "abc",
			secure_header: "secret",
			guest_session: "guest",
			execution_alias_or_id: "alias",
		});

		expect(key).toBe("function:5:identity:ip=1.2.3.4|route=nested");
	});

	it("uses deterministic placeholders for missing values", () => {
		const key = buildFunctionIdentityRateLimitKey(2, ["origin", "access_key"], {
			ip: "1.2.3.4",
			method: "GET",
			route: "default",
			origin: EXECUTION_RATELIMIT_MISSING_VALUE,
			access_key: EXECUTION_RATELIMIT_MISSING_VALUE,
			secure_header: "secret",
			guest_session: "guest",
			execution_alias_or_id: "alias",
		});

		expect(key).toBe(
			`function:2:identity:origin=${EXECUTION_RATELIMIT_MISSING_VALUE}|access_key=${EXECUTION_RATELIMIT_MISSING_VALUE}`,
		);
	});

	it("builds a global key that ignores caller identity", () => {
		expect(buildFunctionGlobalRateLimitKey(42)).toBe("function:42:global");
	});
});

describe("FunctionRateLimit identity extraction", () => {
	it("extracts execution identity values from the request context", () => {
		const values = extractExecutionIdentityValues({
			ctr: {
				client: { ip: { usual: () => "9.8.7.6" } },
				headers: {
					has: (name: string) =>
						["origin", "x-access-key", "x-secure-header"].includes(name),
					get: (name: string) =>
						({
							origin: "https://example.com",
							"x-access-key": "key_123",
							"x-secure-header": "secure_456",
						})[name] ?? null,
				},
				cookies: {
					get: (name: string) =>
						name === "shsf_guest_4_exec-123" ? "guest_hash" : null,
				},
			},
			namespaceId: 4,
			functionIdentifier: "exec-123",
			method: "post",
			route: "custom",
			executionAliasOrId: "alias-xyz",
		});

		expect(values).toEqual({
			ip: "9.8.7.6",
			method: "POST",
			route: "custom",
			origin: "https://example.com",
			access_key: "key_123",
			secure_header: "secure_456",
			guest_session: "guest_hash",
			execution_alias_or_id: "alias-xyz",
		});
	});

	it("normalizes missing values to deterministic placeholders", () => {
		const values = extractExecutionIdentityValues({
			ctr: {
				client: { ip: { usual: () => "" } },
				headers: {
					has: () => false,
					get: () => null,
				},
				cookies: {
					get: () => null,
				},
			},
			namespaceId: 2,
			functionIdentifier: "exec-1",
			method: "GET",
			route: "default",
			executionAliasOrId: "",
		});

		expect(values.origin).toBe(EXECUTION_RATELIMIT_MISSING_VALUE);
		expect(values.access_key).toBe(EXECUTION_RATELIMIT_MISSING_VALUE);
		expect(values.secure_header).toBe(EXECUTION_RATELIMIT_MISSING_VALUE);
		expect(values.guest_session).toBe(EXECUTION_RATELIMIT_MISSING_VALUE);
		expect(values.execution_alias_or_id).toBe(EXECUTION_RATELIMIT_MISSING_VALUE);
		expect(values.ip).toBe(EXECUTION_RATELIMIT_MISSING_VALUE);
	});
});

describe("FunctionRateLimit enforcement", () => {
	beforeEach(() => {
		resetFunctionRateLimitState();
	});

	it("enforces a shared global bucket per function", () => {
		const identityValues = {
			ip: "1.2.3.4",
			method: "GET",
			route: "default",
			origin: EXECUTION_RATELIMIT_MISSING_VALUE,
			access_key: EXECUTION_RATELIMIT_MISSING_VALUE,
			secure_header: EXECUTION_RATELIMIT_MISSING_VALUE,
			guest_session: EXECUTION_RATELIMIT_MISSING_VALUE,
			execution_alias_or_id: "exec-a",
		};

		expect(
			enforceFunctionRateLimit(
				7,
				{ enabled: true, global: { hits: 1, window_ms: 1000 } },
				identityValues,
				100,
			),
		).toMatchObject({
			allowed: true,
			applied: expect.any(Array),
		});
		expect(
			enforceFunctionRateLimit(
				7,
				{ enabled: true, global: { hits: 1, window_ms: 1000 } },
				{ ...identityValues, ip: "5.6.7.8" },
				200,
			),
		).toMatchObject({
			allowed: false,
			scope: "global",
		});
	});

	it("enforces an identity bucket with penalty timing", () => {
		const config = {
			enabled: true as const,
			identities: ["ip", "route"] as ExecutionRateLimitIdentity[],
			identity_limit: { hits: 1, window_ms: 1000, penalty_ms: 500 },
		};
		const values = {
			ip: "1.2.3.4",
			method: "GET",
			route: "default",
			origin: EXECUTION_RATELIMIT_MISSING_VALUE,
			access_key: EXECUTION_RATELIMIT_MISSING_VALUE,
			secure_header: EXECUTION_RATELIMIT_MISSING_VALUE,
			guest_session: EXECUTION_RATELIMIT_MISSING_VALUE,
			execution_alias_or_id: "exec-a",
		};

		expect(enforceFunctionRateLimit(11, config, values, 100)).toMatchObject({
			allowed: true,
			applied: expect.any(Array),
		});
		expect(enforceFunctionRateLimit(11, config, values, 150)).toMatchObject({
			allowed: false,
			scope: "identity",
			retry_after_ms: 1450,
			penalty_ms: 500,
			applied: expect.any(Array),
		});
		expect(enforceFunctionRateLimit(11, config, values, 300)).toMatchObject({
			allowed: false,
			scope: "identity",
			retry_after_ms: 1300,
			penalty_ms: 500,
			applied: expect.any(Array),
		});
	});

	it("evicts expired identity buckets so old callers do not accumulate forever", () => {
		const config = {
			enabled: true as const,
			identities: ["ip"] as ExecutionRateLimitIdentity[],
			identity_limit: { hits: 1, window_ms: 1000 },
		};
		const firstValues = {
			ip: "1.1.1.1",
			method: "GET",
			route: "default",
			origin: EXECUTION_RATELIMIT_MISSING_VALUE,
			access_key: EXECUTION_RATELIMIT_MISSING_VALUE,
			secure_header: EXECUTION_RATELIMIT_MISSING_VALUE,
			guest_session: EXECUTION_RATELIMIT_MISSING_VALUE,
			execution_alias_or_id: "exec-a",
		};
		const secondValues = {
			...firstValues,
			ip: "2.2.2.2",
		};

		const store = new Map();

		expect(enforceFunctionRateLimit(31, config, firstValues, 100, store)).toMatchObject({
			allowed: true,
		});
		expect(store.size).toBe(1);

		expect(enforceFunctionRateLimit(31, config, secondValues, 70_200, store)).toMatchObject({
			allowed: true,
		});
		expect(store.size).toBe(1);
	});
});
