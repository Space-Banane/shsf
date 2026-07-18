import { describe, expect, it } from "vitest";
import {
	buildAccountFunctionAnalytics,
	buildSingleFunctionAnalytics,
	getAnalyticsRangeStart,
	normalizeAnalyticsRange,
	parseExecutionAnalyticsLog,
} from "../lib/FunctionAnalytics";

describe("FunctionAnalytics helpers", () => {
	it("normalizes unknown ranges to 7d", () => {
		expect(normalizeAnalyticsRange("today")).toBe("today");
		expect(normalizeAnalyticsRange("7d")).toBe("7d");
		expect(normalizeAnalyticsRange("30d")).toBe("30d");
		expect(normalizeAnalyticsRange("90d")).toBe("90d");
		expect(normalizeAnalyticsRange("weird")).toBe("7d");
	});

	it("computes inclusive range starts that match the preset labels", () => {
		const now = new Date("2026-04-30T12:34:56.000Z");

		expect(getAnalyticsRangeStart("today", now).toISOString()).toBe(
			"2026-04-30T00:00:00.000Z",
		);
		expect(getAnalyticsRangeStart("7d", now).toISOString()).toBe(
			"2026-04-24T00:00:00.000Z",
		);
		expect(getAnalyticsRangeStart("30d", now).toISOString()).toBe(
			"2026-04-01T00:00:00.000Z",
		);
	});

	it("parses execution analytics from trigger logs", () => {
		const log = {
			id: 10,
			functionId: 2,
			result: JSON.stringify({
				exit_code: 0,
				tooks: [
					{ description: "Write user files (2)", value: 0.111, timestamp: 1 },
					{ description: "Total", value: 1.234, timestamp: 2 },
				],
				payload: JSON.stringify({
					ran_by: "cron",
				}),
			}),
			logs: "ok",
			createdAt: new Date("2026-04-29T10:00:00.000Z"),
			updatedAt: new Date("2026-04-29T10:00:00.000Z"),
			function: {
				id: 2,
				name: "daily-report",
			},
		};

		expect(parseExecutionAnalyticsLog(log)).toEqual({
			executionId: 10,
			functionId: 2,
			functionName: "daily-report",
			createdAt: "2026-04-29T10:00:00.000Z",
			exitCode: 0,
			totalSeconds: 1.234,
			source: "cron",
			phaseTimings: [
				{ description: "Write user files (2)", seconds: 0.111 },
				{ description: "Total", seconds: 1.234 },
			],
			errorType: null,
			ratelimit: null,
		});
	});

	it("parses ratelimit and http-only failure metadata from trigger logs", () => {
		const log = {
			id: 11,
			functionId: 4,
			result: JSON.stringify({
				exit_code: 429,
				tooks: [{ description: "HTTP execution blocked before runtime", value: 0, timestamp: 1 }],
				payload: JSON.stringify({ ran_by: "exec" }),
				error_type: "rate_limit_blocked",
				ratelimit: {
					configured: true,
					blocked: true,
					scope: "identity",
					retry_after_ms: 1200,
					penalty_ms: 400,
					identities: ["ip", "route"],
				},
			}),
			logs: "blocked",
			createdAt: new Date("2026-04-29T10:05:00.000Z"),
			updatedAt: new Date("2026-04-29T10:05:00.000Z"),
			function: {
				id: 4,
				name: "http-fn",
			},
		};

		expect(parseExecutionAnalyticsLog(log)).toEqual({
			executionId: 11,
			functionId: 4,
			functionName: "http-fn",
			createdAt: "2026-04-29T10:05:00.000Z",
			exitCode: 429,
			totalSeconds: 0,
			source: "exec",
			phaseTimings: [{ description: "HTTP execution blocked before runtime", seconds: 0 }],
			errorType: "rate_limit_blocked",
			ratelimit: {
				configured: true,
				blocked: true,
				wouldBlock: true,
				scope: "identity",
				retryAfterMs: 1200,
				penaltyMs: 400,
				limit: null,
				remaining: null,
				resetAfterMs: null,
				policyId: null,
				policyName: null,
				mode: null,
				identities: ["ip", "route"],
				identityValues: {},
				applied: [],
			},
		});
	});

	it("skips malformed logs in account analytics", () => {
		const logs = [
			{
				id: 1,
				functionId: 11,
				result: JSON.stringify({
					exit_code: 0,
					tooks: [{ description: "Total", value: 0.5, timestamp: 1 }],
					payload: JSON.stringify({ ran_by: "user" }),
				}),
				logs: "",
				createdAt: new Date("2026-04-28T10:00:00.000Z"),
				updatedAt: new Date("2026-04-28T10:00:00.000Z"),
				function: { id: 11, name: "alpha" },
			},
			{
				id: 2,
				functionId: 11,
				result: "not-json",
				logs: "",
				createdAt: new Date("2026-04-28T11:00:00.000Z"),
				updatedAt: new Date("2026-04-28T11:00:00.000Z"),
				function: { id: 11, name: "alpha" },
			},
		];

		const result = buildAccountFunctionAnalytics(
			logs,
			"7d",
			new Date("2026-04-30T00:00:00.000Z"),
		);

		expect(result.summary.totalExecutions).toBe(1);
		expect(result.summary.rateLimitedExecutions).toBe(0);
		expect(result.summary.rateLimitBlockedExecutions).toBe(0);
		expect(result.summary.rateLimitWouldBlockExecutions).toBe(0);
		expect(result.summary.rateLimitBlockedByScope).toEqual({
			global: 0,
			identity: 0,
		});
		expect(result.functions).toHaveLength(1);
		expect(result.functions[0].functionName).toBe("alpha");
		expect(result.functions[0].phaseSummary).toEqual([]);
	});

	it("builds per-function aggregates and phase summaries", () => {
		const logs = [
			{
				id: 1,
				functionId: 7,
				result: JSON.stringify({
					exit_code: 0,
					tooks: [
						{ description: "Write user files (1)", value: 0.2, timestamp: 1 },
						{ description: "Run container", value: 0.4, timestamp: 2 },
						{ description: "Total", value: 1.0, timestamp: 3 },
					],
					payload: JSON.stringify({ ran_by: "exec" }),
					ratelimit: {
						configured: true,
						blocked: false,
						identities: ["ip"],
					},
				}),
				logs: "",
				createdAt: new Date("2026-04-29T10:00:00.000Z"),
				updatedAt: new Date("2026-04-29T10:00:00.000Z"),
				function: { id: 7, name: "beta" },
			},
			{
				id: 2,
				functionId: 7,
				result: JSON.stringify({
					exit_code: 1,
					tooks: [
						{ description: "Write user files (1)", value: 0.3, timestamp: 1 },
						{ description: "Run container", value: 0.6, timestamp: 2 },
						{ description: "Total", value: 1.5, timestamp: 3 },
					],
					payload: JSON.stringify({ ran_by: "cron" }),
					error_type: "rate_limit_blocked",
					ratelimit: {
						configured: true,
						blocked: true,
						scope: "global",
						retry_after_ms: 500,
						penalty_ms: 400,
					},
				}),
				logs: "",
				createdAt: new Date("2026-04-30T08:00:00.000Z"),
				updatedAt: new Date("2026-04-30T08:00:00.000Z"),
				function: { id: 7, name: "beta" },
			},
		];

		const result = buildSingleFunctionAnalytics(
			7,
			"beta",
			logs,
			"7d",
			new Date("2026-04-30T12:00:00.000Z"),
		);

		expect(result.totalRuns).toBe(2);
		expect(result.successRate).toBe(50);
		expect(result.avgSeconds).toBe(1.25);
		expect(result.p95Seconds).toBe(1.5);
		expect(result.lastRunAt).toBe("2026-04-30T08:00:00.000Z");
		expect(result.recentExecutions[0].source).toBe("cron");
		expect(result.recentExecutions[0].errorType).toBe("rate_limit_blocked");
		expect(result.rateLimitedExecutions).toBe(2);
		expect(result.rateLimitBlockedExecutions).toBe(1);
		expect(result.rateLimitWouldBlockExecutions).toBe(1);
		expect(result.rateLimitBlockedByScope).toEqual({
			global: 1,
			identity: 0,
		});
		expect(result.phaseSummary).toEqual([
			{ description: "Run container", avgSeconds: 0.5, maxSeconds: 0.6 },
			{ description: "Write user files (1)", avgSeconds: 0.25, maxSeconds: 0.3 },
		]);
	});
});
