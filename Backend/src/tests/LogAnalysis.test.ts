import { describe, expect, it, vi } from "vitest";
import {
	buildDecisionsRequest,
	enqueueLogAnalysis,
	extractAnalysisInput,
	FAILURE_THRESHOLD,
	functionAnalysisEnabled,
	getLogAnalysisAvailability,
	MAX_ATTEMPTS,
	MAX_LOG_CHARS,
	normalizeDecision,
	processLogAnalysisQueue,
	sanitizeLogText,
	truncateLogText,
} from "../lib/LogAnalysis";
import { createDecision, DecisionsError, mapDecisionsStatus, OPENROUTER_DECISIONS_URL } from "../lib/OpenRouterDecisions";
import { buildLogAnalysisSummary, parseExecutionAnalyticsLog } from "../lib/FunctionAnalytics";
import { encryptSecret } from "../lib/GitOps";

const SECRET = "test-instance-secret-0123456789abcdef";

const okBody = (noul = 0.9, score = 7.2, confidence = 0.8) => ({
	id: "gen-dec-1",
	model: "vendor/decider-1",
	provider: "Vendor",
	answers: {
		failure: { type: "noul", noul },
		attention: { type: "score", score, confidence, probabilities: { "7": confidence } },
	},
	usage: { input_tokens: 400, output_tokens: 40, cost: 0.00002 },
});

const jsonResponse = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("sanitizeLogText", () => {
	it("masks bearer tokens, key=value secrets, JSON secrets, cookies, JWTs, provider keys, URL credentials, emails and configured secrets", () => {
		const input = [
			"Authorization: Bearer abcdefghijklmnop123",
			"password=hunter22 user=bob",
			'{"api_key": "abc123xyz", "ok": true}',
			"Cookie: session=deadbeefcafe",
			"jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N",
			"key " + ["sk", "or", "v1", "0123456789abcdef0123"].join("-"),
			"aws AKIAABCDEFGHIJKLMNOP",
			"db mysql://root:s3cret@db:3306/x",
			"mail alice@example.com",
			"custom my-configured-secret-value",
			'req={\\"password\\":\\"escapedpw99\\",\\"ok\\":1}',
			"redis redis://:redispw77@cache:6379/0",
			"Cookie: _ga=GA1; connect.sid=s%3Asessionabc123; theme=dark",
		].join("\n");
		const out = sanitizeLogText(input, ["my-configured-secret-value"]);
		for (const leaked of ["abcdefghijklmnop123", "hunter22", "abc123xyz", "deadbeefcafe", "eyJhbGci", "sk-or-v1", "AKIAABCD", "s3cret", "alice@example.com", "my-configured-secret-value", "escapedpw99", "redispw77", "sessionabc123"]) {
			expect(out).not.toContain(leaked);
		}
		expect(out).toContain("user=bob");
		expect(out).toContain('"ok": true');
	});

	it("stays fast on long base64-like logs", () => {
		const start = performance.now();
		sanitizeLogText("A".repeat(10_000) + "@" + "b".repeat(5_000));
		expect(performance.now() - start).toBeLessThan(50);
	});

	it("masks short configured values as standalone tokens only", () => {
		expect(sanitizeLogText("value=abcde ok", ["abcde"])).toBe("value=[REDACTED_SECRET] ok");
		expect(sanitizeLogText("code 1 at line 12", ["1"])).toBe("code [REDACTED_SECRET] at line 12");
		expect(sanitizeLogText("a.b+c(d) x", ["a.b+c(d)"])).toBe("[REDACTED_SECRET] x");
	});
});

describe("truncateLogText", () => {
	it("keeps head and tail within the limit", () => {
		const text = "HEAD" + "x".repeat(20_000) + "TAIL-ERROR";
		const out = truncateLogText(text);
		expect(out.length).toBeLessThan(MAX_LOG_CHARS + 60);
		expect(out.startsWith("HEAD")).toBe(true);
		expect(out.endsWith("TAIL-ERROR")).toBe(true);
		expect(out).toContain("chars truncated");
	});

	it("leaves short logs untouched", () => {
		expect(truncateLogText("short")).toBe("short");
	});
});

describe("buildDecisionsRequest", () => {
	it("sends only sanitized logs and bounded execution metadata with a configurable model", () => {
		const input = extractAnalysisInput(
			"boom token=abcdef123456",
			JSON.stringify({ exit_code: 1, error_type: "timeout", tooks: [{ description: "Total", value: 1.23456 }], payload: '{"secret":"x"}', output: "private" }),
		);
		const request = buildDecisionsRequest("any/model", input, []);
		expect(request.model).toBe("any/model");
		expect(request.state).toEqual({ logs: "boom token=[REDACTED]", exit_code: 1, error_type: "timeout", duration_seconds: 1.235 });
		expect(JSON.stringify(request)).not.toContain("private");
		expect(request.questions.failure.type).toBe("noul");
		expect(request.questions.attention).toMatchObject({ type: "score" });
		expect((request.questions.attention as { criteria: unknown[] }).criteria).toHaveLength(10);
	});

	it("handles non-JSON results", () => {
		expect(extractAnalysisInput("", "CORS_DENIED")).toEqual({ logs: "", exitCode: null, errorType: "cors_denied", durationSeconds: null });
	});
});

describe("normalizeDecision", () => {
	it("maps the noul probability through the documented threshold and the score index to 1-10", () => {
		const response = { ...okBody(FAILURE_THRESHOLD, 0), answers: okBody(FAILURE_THRESHOLD, 0).answers } as never;
		expect(normalizeDecision(response)).toEqual({ failureProbability: 0.5, failureDetected: true, attentionPriority: 1, attentionConfidence: 0.8 });
		const low = normalizeDecision(okBody(0.49, 9.4) as never);
		expect(low.failureDetected).toBe(false);
		expect(low.attentionPriority).toBe(10);
		expect(normalizeDecision(okBody(0.1, 42) as never).attentionPriority).toBe(10);
	});

	it("keeps a low-confidence completed result instead of dropping it", () => {
		expect(normalizeDecision(okBody(0.2, 3, 0.05) as never).attentionConfidence).toBe(0.05);
	});

	it("rejects answers for the wrong question types", () => {
		const bad = { ...okBody(), answers: { failure: { type: "score", score: 1 }, attention: { type: "noul", noul: 0.1 } } };
		expect(() => normalizeDecision(bad as never)).toThrow(DecisionsError);
	});
});

describe("createDecision", () => {
	it("posts to the Decisions endpoint with the key and validates the response", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, okBody()));
		const result = await createDecision("key-1", buildDecisionsRequest("m", extractAnalysisInput("x", null), []), fetchImpl);
		expect(result.usage.cost).toBe(0.00002);
		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toBe(OPENROUTER_DECISIONS_URL);
		expect(init.headers.Authorization).toBe("Bearer key-1");
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it.each([
		[401, "auth", false], [403, "auth", false], [402, "payment", false], [404, "not_found", false],
		[413, "too_large", false], [429, "rate_limited", true], [503, "upstream", false], [529, "upstream", false],
	])("maps HTTP %i to %s (retryable=%s)", (status, kind, retryable) => {
		const error = mapDecisionsStatus(status);
		expect(error.kind).toBe(kind);
		expect(error.retryable).toBe(retryable);
	});

	it("reports malformed bodies and timeouts", async () => {
		await expect(createDecision("k", buildDecisionsRequest("m", extractAnalysisInput("x", null), []), vi.fn().mockResolvedValue(jsonResponse(200, { answers: "nope" }))))
			.rejects.toMatchObject({ kind: "malformed" });
		const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
		await expect(createDecision("k", buildDecisionsRequest("m", extractAnalysisInput("x", null), []), vi.fn().mockRejectedValue(timeout)))
			.rejects.toMatchObject({ kind: "timeout", retryable: false });
		await expect(createDecision("k", buildDecisionsRequest("m", extractAnalysisInput("x", null), []), vi.fn().mockRejectedValue(new TypeError("fetch failed"))))
			.rejects.toMatchObject({ kind: "network", retryable: false });
	});
});

describe("availability", () => {
	const base = { aiProviderEndpoint: null, aiProviderApiKey: null, openRouterKey: null, logAnalysisEnabled: true, logAnalysisModel: "m" };

	it("is off by default and explains why", () => {
		expect(getLogAnalysisAvailability({ ...base, logAnalysisEnabled: false }, "inst", SECRET)).toMatchObject({ ready: false, reason: expect.stringContaining("off") });
		expect(getLogAnalysisAvailability({ ...base, logAnalysisModel: null }, "inst", SECRET)).toMatchObject({ ready: false, reason: expect.stringContaining("model") });
		expect(getLogAnalysisAvailability(base, undefined, SECRET)).toMatchObject({ ready: false, keySource: null });
	});

	it("prefers the account OpenRouter key and ignores non-OpenRouter provider keys", () => {
		const own = { ...base, aiProviderApiKey: encryptSecret("acct", SECRET) };
		expect(getLogAnalysisAvailability(own, "inst", SECRET)).toMatchObject({ ready: true, keySource: "account" });
		expect(getLogAnalysisAvailability({ ...own, aiProviderEndpoint: "https://api.openai.com/v1" }, "inst", SECRET)).toMatchObject({ keySource: "instance" });
		expect(getLogAnalysisAvailability({ ...own, aiProviderEndpoint: "https://api.openai.com/v1" }, undefined, SECRET)).toMatchObject({ ready: false });
	});

	it("requires both logging and analyze in the per-function config", () => {
		expect(functionAnalysisEnabled(null)).toBe(false);
		expect(functionAnalysisEnabled('{"enabled":true}')).toBe(false);
		expect(functionAnalysisEnabled('{"enabled":false,"analyze":true}')).toBe(false);
		expect(functionAnalysisEnabled('{"enabled":true,"analyze":true}')).toBe(true);
	});
});

type Row = Record<string, unknown> & { id: number; status: string; attempts: number; nextAttemptAt: Date; startedAt?: Date | null };

function fakeQueue(user: Record<string, unknown>, logging = '{"enabled":true,"analyze":true}') {
	const rows: Row[] = [];
	const triggerLog = {
		id: 10,
		logs: "Error: boom api_key=supersecret",
		result: JSON.stringify({ exit_code: 1, tooks: [] }),
		function: { env: JSON.stringify([{ name: "DB_PASS", value: "envsecret99" }]), secure_header: null, logging, user },
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal Prisma where/data stand-in
	const matches = (row: Row, where: Record<string, any>) =>
		Object.entries(where).every(([key, value]) => {
			if (value && typeof value === "object" && !(value instanceof Date)) {
				if ("lte" in value) return (row[key] as Date) <= value.lte;
				if ("lt" in value) return row[key] != null && (row[key] as number) < value.lt;
				if ("gte" in value) return (row[key] as number) >= value.gte;
			}
			return row[key] === value;
		});
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal Prisma where/data stand-in
	const apply = (row: Row, data: Record<string, any>) => {
		for (const [key, value] of Object.entries(data)) {
			row[key] = value && typeof value === "object" && "increment" in value ? (row[key] as number) + value.increment : value;
		}
	};
	const prisma = {
		function: { findUnique: vi.fn().mockResolvedValue({ user }) },
		triggerLog: {},
		logAnalysis: {
			upsert: vi.fn(async ({ where, create }) => {
				const existing = rows.find((row) => row.triggerLogId === where.triggerLogId);
				if (existing) return existing;
				const row: Row = { id: rows.length + 1, status: "pending", attempts: 0, nextAttemptAt: new Date(0), startedAt: null, ...create };
				rows.push(row);
				return row;
			}),
			updateMany: vi.fn(async ({ where, data }) => {
				const hits = rows.filter((row) => matches(row, where));
				hits.forEach((row) => apply(row, data));
				return { count: hits.length };
			}),
			findMany: vi.fn(async ({ where, take }) => rows.filter((row) => matches(row, where)).slice(0, take).map(({ id }) => ({ id }))),
			findUnique: vi.fn(async ({ where }) => {
				const row = rows.find((candidate) => candidate.id === where.id);
				return row ? { ...row, triggerLog } : null;
			}),
			update: vi.fn(async ({ where, data }) => {
				const row = rows.find((candidate) => candidate.id === where.id)!;
				apply(row, data);
				return row;
			}),
		},
	};
	return { prisma: prisma as never, rows, raw: prisma };
}

const enabledUser = { logAnalysisEnabled: true, logAnalysisModel: "vendor/decider-1", aiProviderEndpoint: null, aiProviderApiKey: null, openRouterKey: null, account_env: null };

describe("log analysis queue", () => {
	it("makes zero provider requests and enqueues nothing when the account is disabled", async () => {
		const q = fakeQueue({ ...enabledUser, logAnalysisEnabled: false });
		await enqueueLogAnalysis(q.prisma, 10, 1);
		const fetchImpl = vi.fn();
		await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, fetchImpl });
		expect(q.rows).toHaveLength(0);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("is idempotent per log and completes with sanitized input and normalized fields", async () => {
		const q = fakeQueue(enabledUser);
		await enqueueLogAnalysis(q.prisma, 10, 1);
		await enqueueLogAnalysis(q.prisma, 10, 1);
		expect(q.rows).toHaveLength(1);

		const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, okBody()));
		await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, fetchImpl });
		await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, fetchImpl });
		expect(fetchImpl).toHaveBeenCalledTimes(1);

		const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
		expect(sent.model).toBe("vendor/decider-1");
		expect(JSON.stringify(sent)).not.toContain("supersecret");
		expect(JSON.stringify(sent)).not.toContain("envsecret99");
		expect(q.rows[0]).toMatchObject({
			status: "completed", attempts: 1, failureDetected: true, failureProbability: 0.9,
			attentionPriority: 8, attentionConfidence: 0.8, costUsd: 0.00002, inputTokens: 400, providerModel: "vendor/decider-1",
		});
		expect(q.rows[0].inputHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("marks the job disabled without a request when the function opt-in was removed", async () => {
		const q = fakeQueue(enabledUser, '{"enabled":true,"analyze":false}');
		await enqueueLogAnalysis(q.prisma, 10, 1);
		const fetchImpl = vi.fn();
		await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, fetchImpl });
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(q.rows[0].status).toBe("disabled");
	});

	it("skips when no key is available", async () => {
		const q = fakeQueue(enabledUser);
		await enqueueLogAnalysis(q.prisma, 10, 1);
		await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: undefined, instanceSecret: SECRET, fetchImpl: vi.fn() });
		expect(q.rows[0].status).toBe("skipped");
	});

	it("retries rate limits with backoff up to the attempt limit, then fails", async () => {
		const q = fakeQueue(enabledUser);
		await enqueueLogAnalysis(q.prisma, 10, 1);
		const fetchImpl = vi.fn().mockImplementation(async () => jsonResponse(429, {}));
		let now = new Date("2026-01-01T00:00:00Z");
		for (let i = 0; i < MAX_ATTEMPTS + 2; i += 1) {
			await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, fetchImpl, now: () => now });
			now = new Date(now.getTime() + 10 * 60_000);
		}
		expect(fetchImpl).toHaveBeenCalledTimes(MAX_ATTEMPTS);
		expect(q.rows[0]).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS, error: expect.stringContaining("rate limited") });
	});

	it("fails immediately on permission errors and malformed decisions", async () => {
		for (const response of [jsonResponse(403, {}), jsonResponse(200, { ...okBody(), answers: {} })]) {
			const q = fakeQueue(enabledUser);
			await enqueueLogAnalysis(q.prisma, 10, 1);
			await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, fetchImpl: vi.fn().mockResolvedValue(response) });
			expect(q.rows[0]).toMatchObject({ status: "failed", attempts: 1 });
		}
	});

	it("never resends after a timeout, network error, or 5xx, since the request may have been billed", async () => {
		const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
		for (const outcome of [() => Promise.reject(timeout), () => Promise.reject(new TypeError("fetch failed")), async () => jsonResponse(503, {})]) {
			const q = fakeQueue(enabledUser);
			await enqueueLogAnalysis(q.prisma, 10, 1);
			const fetchImpl = vi.fn().mockImplementation(outcome);
			let now = new Date("2026-01-01T00:00:00Z");
			for (let i = 0; i < 3; i += 1) {
				await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, fetchImpl, now: () => now });
				now = new Date(now.getTime() + 10 * 60_000);
			}
			expect(fetchImpl).toHaveBeenCalledTimes(1);
			expect(q.rows[0]).toMatchObject({ status: "failed", attempts: 1 });
		}
	});

	it("does not re-bill when the result write fails after a successful request", async () => {
		const q = fakeQueue(enabledUser);
		await enqueueLogAnalysis(q.prisma, 10, 1);
		q.raw.logAnalysis.update.mockRejectedValueOnce(new Error("deadlock"));
		const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, okBody()));
		await expect(processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, fetchImpl })).rejects.toThrow("deadlock");
		expect(q.rows[0]).toMatchObject({ status: "running", attempts: 1 });
	});

	it("never resends a job left running by a restart, since it may already have been billed", async () => {
		const q = fakeQueue(enabledUser);
		await enqueueLogAnalysis(q.prisma, 10, 1);
		Object.assign(q.rows[0], { status: "running", startedAt: new Date("2026-01-01T00:00:00Z"), attempts: 1 });
		const fetchImpl = vi.fn();
		const at = (iso: string) => ({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, fetchImpl, now: () => new Date(iso) });
		await processLogAnalysisQueue(at("2026-01-01T00:01:00Z"));
		expect(q.rows[0].status).toBe("running");
		await processLogAnalysisQueue(at("2026-01-01T01:00:00Z"));
		await processLogAnalysisQueue(at("2026-01-01T02:00:00Z"));
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(q.rows[0]).toMatchObject({ status: "failed", attempts: 1, error: expect.stringContaining("duplicate charge") });
	});
});

describe("analytics integration", () => {
	const makeLog = (id: number, analysis: Record<string, unknown> | null, exit = 1) => ({
		id,
		functionId: 1,
		function: { id: 1, name: "fn" },
		result: JSON.stringify({ exit_code: exit, tooks: [] }),
		logs: "",
		createdAt: new Date(`2026-01-0${id}T00:00:00Z`),
		updatedAt: new Date(),
		analysis: analysis && {
			id, triggerLogId: id, attempts: 1, nextAttemptAt: new Date(), model: "m", inputVersion: 1, inputHash: null,
			failureProbability: null, failureDetected: null, attentionPriority: null, attentionConfidence: null, decision: null,
			providerModel: null, costUsd: null, inputTokens: null, outputTokens: null, error: null, startedAt: null,
			completedAt: new Date(), createdAt: new Date(), updatedAt: new Date(), ...analysis,
		},
	});

	it("separates not analyzed, pending, unavailable and completed results without touching exit codes", () => {
		const executions = [
			makeLog(1, null),
			makeLog(2, { status: "pending" }),
			makeLog(3, { status: "failed", error: "OpenRouter rejected the API key." }),
			makeLog(4, { status: "completed", failureDetected: false, failureProbability: 0.1, attentionPriority: 8, attentionConfidence: 0.2, costUsd: 0.001 }, 0),
		].map((log) => parseExecutionAnalyticsLog(log as never)!);
		const summary = buildLogAnalysisSummary(executions);
		expect(summary).toMatchObject({ analyzed: 1, pending: 1, unavailable: 1, notAnalyzed: 1, failureSignals: 0, avgConfidence: 0.2, costUsd: 0.001 });
		expect(summary.priorityDistribution[7]).toBe(1);
		expect(summary.highPriority.map((execution) => execution.executionId)).toEqual([4]);
		expect(executions[3].exitCode).toBe(0);
		expect(executions[2].analysis).toMatchObject({ status: "failed", analyzedAt: null });
		const withDistribution = parseExecutionAnalyticsLog(makeLog(5, { status: "completed", attentionPriority: 3, decision: { attention: { type: "score", score: 2, probabilities: { "1": 0.3, "2": 0.7 } } } }) as never)!;
		expect(withDistribution.analysis?.attentionDistribution).toEqual({ "2": 0.3, "3": 0.7 });
	});
});
