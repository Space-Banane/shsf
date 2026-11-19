import { describe, expect, it, vi } from "vitest";
import {
	buildAnalysisRequest,
	enqueueLogAnalysis,
	extractAnalysisInput,
	FAILURE_THRESHOLD,
	functionAnalysisEnabled,
	getLogAnalysisAvailability,
	MAX_ATTEMPTS,
	MAX_LOG_CHARS,
	normalizeAnalysis,
	processLogAnalysisQueue,
	sanitizeLogText,
	truncateLogText,
} from "../lib/LogAnalysis";
import { createAnalysis, mapAnalysisStatus, parseAnalysisPayload } from "../lib/LogAnalysisProvider";
import { buildLogAnalysisSummary, parseExecutionAnalyticsLog } from "../lib/FunctionAnalytics";
import { encryptSecret } from "../lib/GitOps";

const SECRET = "test-instance-secret-0123456789abcdef";

const okBody = (failure = 0.9, priority = 8, confidence = 0.8) => ({
	model: "vendor/model-1",
	choices: [{ message: { content: JSON.stringify({ failure_probability: failure, attention_priority: priority, confidence }) } }],
	usage: { prompt_tokens: 400, completion_tokens: 40, cost: 0.00002 },
});

const transport = (status: number, body: unknown) =>
	vi.fn(async (
		_endpoint: string,
		_path: "/chat/completions",
		_apiKey: string,
		_timeoutMs: number,
		_body?: Record<string, unknown>,
		_ignoreTlsErrors?: boolean,
		_allowInternal?: boolean,
	) => ({ status, json: async () => body }));

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

describe("buildAnalysisRequest", () => {
	it("sends only sanitized logs and bounded execution metadata with a configurable model", () => {
		const input = extractAnalysisInput(
			"boom token=abcdef123456",
			JSON.stringify({ exit_code: 1, error_type: "timeout", tooks: [{ description: "Total", value: 1.23456 }], payload: '{"secret":"x"}', output: "private" }),
		);
		const request = buildAnalysisRequest("any/model", input, []);
		expect(request.model).toBe("any/model");
		expect(request.state).toEqual({ logs: "boom token=[REDACTED]", exit_code: 1, error_type: "timeout", duration_seconds: 1.235 });
		expect(JSON.stringify(request)).not.toContain("private");
		expect(request.messages[0].content).toContain("failure_probability");
		expect(request.messages[0].content).toContain("attention_priority");
		expect(request.messages[0].content).toContain("10: Critical");
		expect(request.messages[1].content).toContain("Exit code: 1");
	});

	it("handles non-JSON results", () => {
		expect(extractAnalysisInput("", "CORS_DENIED")).toEqual({ logs: "", exitCode: null, errorType: "cors_denied", durationSeconds: null });
	});
});

describe("normalizeAnalysis", () => {
	it("maps the probability through the threshold and clamps the priority to 1-10", () => {
		expect(normalizeAnalysis({ failure_probability: FAILURE_THRESHOLD, attention_priority: 1, confidence: 0.8 })).toEqual({ failureProbability: 0.5, failureDetected: true, attentionPriority: 1, attentionConfidence: 0.8 });
		const low = normalizeAnalysis({ failure_probability: 0.49, attention_priority: 9.4 });
		expect(low.failureDetected).toBe(false);
		expect(low.attentionPriority).toBe(9);
		expect(low.attentionConfidence).toBeNull();
		expect(normalizeAnalysis({ failure_probability: 0.1, attention_priority: 42 }).attentionPriority).toBe(10);
	});

	it("keeps a low-confidence completed result instead of dropping it", () => {
		expect(normalizeAnalysis({ failure_probability: 0.2, attention_priority: 3, confidence: 0.05 }).attentionConfidence).toBe(0.05);
	});
});

describe("parseAnalysisPayload", () => {
	it("accepts plain JSON, fenced JSON, and array content", () => {
		const payload = { failure_probability: 0.7, attention_priority: 6, confidence: 0.4 };
		expect(parseAnalysisPayload(JSON.stringify(payload))).toEqual(payload);
		expect(parseAnalysisPayload("```json\n" + JSON.stringify(payload) + "\n```")).toEqual(payload);
		expect(parseAnalysisPayload([{ type: "text", text: JSON.stringify(payload) }])).toEqual(payload);
	});

	it("rejects empty, non-JSON, and out-of-range answers", () => {
		expect(() => parseAnalysisPayload("")).toThrow(expect.objectContaining({ kind: "malformed" }));
		expect(() => parseAnalysisPayload("nope")).toThrow(expect.objectContaining({ kind: "malformed" }));
		expect(() => parseAnalysisPayload(JSON.stringify({ failure_probability: 2, attention_priority: 5 }))).toThrow(expect.objectContaining({ kind: "malformed" }));
	});
});

describe("createAnalysis", () => {
	const provider = {
		endpoint: "https://api.openai.com/v1",
		model: "vendor/model",
		apiKey: "key-1",
		capabilities: { tools: true, json: true },
		ignoreTlsErrors: true,
	};

	it("posts to the configured provider with its key, model, TLS option, and JSON mode", async () => {
		const impl = transport(200, okBody());
		const request = buildAnalysisRequest("vendor/model", extractAnalysisInput("x", null), []);
		const result = await createAnalysis(provider, request, impl as never);
		expect(result).toEqual({
			model: "vendor/model-1",
			answers: { failure_probability: 0.9, attention_priority: 8, confidence: 0.8 },
			usage: { inputTokens: 400, outputTokens: 40, costUsd: 0.00002 },
		});
		const [endpoint, path, apiKey, , rawBody, ignoreTlsErrors, allowInternal] = impl.mock.calls[0];
		const body = rawBody!;
		expect(endpoint).toBe("https://api.openai.com/v1");
		expect(path).toBe("/chat/completions");
		expect(apiKey).toBe("key-1");
		expect(ignoreTlsErrors).toBe(true);
		expect(allowInternal).toBe(false);
		expect(body.model).toBe("vendor/model");
		expect(body.response_format).toEqual({ type: "json_object" });
		expect(body.messages).toBe(request.messages);
	});

	it("omits JSON mode when the provider does not support it", async () => {
		const impl = transport(200, okBody());
		await createAnalysis({ ...provider, capabilities: { tools: true, json: false } }, buildAnalysisRequest("m", extractAnalysisInput("x", null), []), impl as never);
		expect(impl.mock.calls[0][4]!.response_format).toBeUndefined();
	});

	it.each([
		[401, "auth", false], [403, "auth", false], [402, "payment", false], [404, "not_found", false],
		[413, "too_large", false], [429, "rate_limited", true], [503, "upstream", false], [529, "upstream", false],
	])("maps HTTP %i to %s (retryable=%s)", (status, kind, retryable) => {
		const error = mapAnalysisStatus(status);
		expect(error.kind).toBe(kind);
		expect(error.retryable).toBe(retryable);
	});

	it("reports malformed bodies and transport timeouts", async () => {
		await expect(createAnalysis(provider, buildAnalysisRequest("m", extractAnalysisInput("x", null), []), transport(200, { choices: [{ message: { content: "nope" } }] }) as never))
			.rejects.toMatchObject({ kind: "malformed" });
		const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
		await expect(createAnalysis(provider, buildAnalysisRequest("m", extractAnalysisInput("x", null), []), vi.fn().mockRejectedValue(timeout) as never))
			.rejects.toMatchObject({ kind: "timeout", retryable: false });
		await expect(createAnalysis(provider, buildAnalysisRequest("m", extractAnalysisInput("x", null), []), vi.fn().mockRejectedValue(new TypeError("failed")) as never))
			.rejects.toMatchObject({ kind: "network", retryable: false });
	});
});

describe("availability", () => {
	const base = { aiProviderEndpoint: null, aiProviderModel: null, aiProviderApiKey: null, aiProviderCapabilities: null, openRouterKey: null, logAnalysisEnabled: true, logAnalysisModel: "m" };

	it("is off by default and explains why", () => {
		expect(getLogAnalysisAvailability({ ...base, logAnalysisEnabled: false }, "inst", SECRET)).toMatchObject({ ready: false, reason: expect.stringContaining("off") });
		expect(getLogAnalysisAvailability(base, undefined, SECRET)).toMatchObject({ ready: false, keySource: null, reason: expect.stringContaining("AI provider") });
	});

	it("uses the instance key as a fallback", () => {
		expect(getLogAnalysisAvailability(base, "inst", SECRET)).toMatchObject({ ready: true, keySource: "instance", model: "m" });
	});

	it("uses the account's AI provider settings and default model", () => {
		const own = {
			...base,
			logAnalysisModel: null,
			aiProviderEndpoint: "https://api.openai.com/v1",
			aiProviderModel: "gpt-4o-mini",
			aiProviderApiKey: encryptSecret("acct", SECRET),
			aiProviderCapabilities: JSON.stringify({ tools: true, json: true }),
		};
		expect(getLogAnalysisAvailability(own, "inst", SECRET)).toMatchObject({ ready: true, keySource: "account", model: "gpt-4o-mini" });
		expect(getLogAnalysisAvailability({ ...own, logAnalysisModel: "override/model" }, "inst", SECRET)).toMatchObject({ model: "override/model" });
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

const enabledUser = {
	logAnalysisEnabled: true,
	logAnalysisModel: "vendor/model",
	aiProviderEndpoint: null,
	aiProviderModel: null,
	aiProviderApiKey: null,
	aiProviderCapabilities: null,
	openRouterKey: null,
	account_env: null,
};

describe("log analysis queue", () => {
	it("makes zero provider requests and enqueues nothing when the account is disabled", async () => {
		const q = fakeQueue({ ...enabledUser, logAnalysisEnabled: false });
		await enqueueLogAnalysis(q.prisma, 10, 1);
		const impl = vi.fn();
		await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, requestImpl: impl as never });
		expect(q.rows).toHaveLength(0);
		expect(impl).not.toHaveBeenCalled();
	});

	it("is idempotent per log and completes with sanitized input and normalized fields", async () => {
		const q = fakeQueue(enabledUser);
		await enqueueLogAnalysis(q.prisma, 10, 1);
		await enqueueLogAnalysis(q.prisma, 10, 1);
		expect(q.rows).toHaveLength(1);

		const impl = transport(200, okBody());
		await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, requestImpl: impl as never });
		await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, requestImpl: impl as never });
		expect(impl).toHaveBeenCalledTimes(1);

		const sent = impl.mock.calls[0][4]!;
		expect(sent.model).toBe("vendor/model");
		expect(JSON.stringify(sent)).not.toContain("supersecret");
		expect(JSON.stringify(sent)).not.toContain("envsecret99");
		expect(q.rows[0]).toMatchObject({
			status: "completed", attempts: 1, failureDetected: true, failureProbability: 0.9,
			attentionPriority: 8, attentionConfidence: 0.8, costUsd: 0.00002, inputTokens: 400, providerModel: "vendor/model-1",
		});
		expect(q.rows[0].inputHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("carries the account provider endpoint, key, model, JSON mode, and TLS options into the request", async () => {
		const user = {
			...enabledUser,
			logAnalysisModel: null,
			aiProviderEndpoint: "https://api.openai.com/v1",
			aiProviderModel: "gpt-4o-mini",
			aiProviderApiKey: encryptSecret("acct-key", SECRET),
			aiProviderCapabilities: JSON.stringify({ tools: true, json: false, ignoreTlsErrors: true }),
		};
		const q = fakeQueue(user);
		await enqueueLogAnalysis(q.prisma, 10, 1);
		const impl = transport(200, okBody());
		await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: undefined, instanceSecret: SECRET, requestImpl: impl as never });
		expect(impl).toHaveBeenCalledTimes(1);
		const [endpoint, path, apiKey, , rawBody, ignoreTlsErrors] = impl.mock.calls[0];
		const body = rawBody!;
		expect(endpoint).toBe("https://api.openai.com/v1");
		expect(path).toBe("/chat/completions");
		expect(apiKey).toBe("acct-key");
		expect(body.model).toBe("gpt-4o-mini");
		expect(body.response_format).toBeUndefined();
		expect(ignoreTlsErrors).toBe(true);
	});

	it("marks the job disabled without a request when the function opt-in was removed", async () => {
		const q = fakeQueue(enabledUser, '{"enabled":true,"analyze":false}');
		await enqueueLogAnalysis(q.prisma, 10, 1);
		const impl = vi.fn();
		await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, requestImpl: impl as never });
		expect(impl).not.toHaveBeenCalled();
		expect(q.rows[0].status).toBe("disabled");
	});

	it("skips when no provider or key is available", async () => {
		const q = fakeQueue(enabledUser);
		await enqueueLogAnalysis(q.prisma, 10, 1);
		await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: undefined, instanceSecret: SECRET, requestImpl: vi.fn() as never });
		expect(q.rows[0]).toMatchObject({ status: "skipped", error: expect.stringContaining("AI provider") });
	});

	it("retries rate limits with backoff up to the attempt limit, then fails", async () => {
		const q = fakeQueue(enabledUser);
		await enqueueLogAnalysis(q.prisma, 10, 1);
		const impl = transport(429, {});
		let now = new Date("2026-01-01T00:00:00Z");
		for (let i = 0; i < MAX_ATTEMPTS + 2; i += 1) {
			await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, requestImpl: impl as never, now: () => now });
			now = new Date(now.getTime() + 10 * 60_000);
		}
		expect(impl).toHaveBeenCalledTimes(MAX_ATTEMPTS);
		expect(q.rows[0]).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS, error: expect.stringContaining("rate limited") });
	});

	it("fails immediately on permission errors and malformed answers", async () => {
		for (const impl of [transport(403, {}), transport(200, { choices: [{ message: { content: "{}" } }] })]) {
			const q = fakeQueue(enabledUser);
			await enqueueLogAnalysis(q.prisma, 10, 1);
			await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, requestImpl: impl as never });
			expect(q.rows[0]).toMatchObject({ status: "failed", attempts: 1 });
		}
	});

	it("never resends after a timeout, network error, or 5xx, since the request may have been billed", async () => {
		const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
		for (const outcome of [
			() => Promise.reject(timeout),
			() => Promise.reject(new TypeError("failed")),
			async () => ({ status: 503, json: async () => ({}) }),
		]) {
			const q = fakeQueue(enabledUser);
			await enqueueLogAnalysis(q.prisma, 10, 1);
			const impl = vi.fn().mockImplementation(outcome);
			let now = new Date("2026-01-01T00:00:00Z");
			for (let i = 0; i < 3; i += 1) {
				await processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, requestImpl: impl as never, now: () => now });
				now = new Date(now.getTime() + 10 * 60_000);
			}
			expect(impl).toHaveBeenCalledTimes(1);
			expect(q.rows[0]).toMatchObject({ status: "failed", attempts: 1 });
		}
	});

	it("does not re-bill when the result write fails after a successful request", async () => {
		const q = fakeQueue(enabledUser);
		await enqueueLogAnalysis(q.prisma, 10, 1);
		q.raw.logAnalysis.update.mockRejectedValueOnce(new Error("deadlock"));
		const impl = transport(200, okBody());
		await expect(processLogAnalysisQueue({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, requestImpl: impl as never })).rejects.toThrow("deadlock");
		expect(q.rows[0]).toMatchObject({ status: "running", attempts: 1 });
	});

	it("never resends a job left running by a restart, since it may already have been billed", async () => {
		const q = fakeQueue(enabledUser);
		await enqueueLogAnalysis(q.prisma, 10, 1);
		Object.assign(q.rows[0], { status: "running", startedAt: new Date("2026-01-01T00:00:00Z"), attempts: 1 });
		const impl = vi.fn();
		const at = (iso: string) => ({ prisma: q.prisma, instanceKey: "inst", instanceSecret: SECRET, requestImpl: impl as never, now: () => new Date(iso) });
		await processLogAnalysisQueue(at("2026-01-01T00:01:00Z"));
		expect(q.rows[0].status).toBe("running");
		await processLogAnalysisQueue(at("2026-01-01T01:00:00Z"));
		await processLogAnalysisQueue(at("2026-01-01T02:00:00Z"));
		expect(impl).not.toHaveBeenCalled();
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
			id, triggerLogId: id, attempts: 1, nextAttemptAt: new Date(), model: "m", inputVersion: 2, inputHash: null,
			failureProbability: null, failureDetected: null, attentionPriority: null, attentionConfidence: null, decision: null,
			providerModel: null, costUsd: null, inputTokens: null, outputTokens: null, error: null, startedAt: null,
			completedAt: new Date(), createdAt: new Date(), updatedAt: new Date(), ...analysis,
		},
	});

	it("separates not analyzed, pending, unavailable and completed results without touching exit codes", () => {
		const executions = [
			makeLog(1, null),
			makeLog(2, { status: "pending" }),
			makeLog(3, { status: "failed", error: "The AI provider rejected the API key." }),
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
