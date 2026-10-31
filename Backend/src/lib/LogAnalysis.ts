/*
Opt-in advisory log analysis through OpenRouter's Decisions API.

Flow: persistFunctionExecutionLog -> enqueueLogAnalysis (pending row) -> SystemCrons
"log-analysis" job -> processLogAnalysisQueue -> createDecision. The LogAnalysis row is
the durable queue, so pending work survives restarts. Nothing here touches the TriggerLog's
own result; deterministic execution status stays authoritative.
*/
import { createHash } from "node:crypto";
import type { LogAnalysis, Prisma, PrismaClient, User } from "@prisma/client";
import { DEFAULT_AI_PROVIDER_ENDPOINT } from "./AIProvider";
import { decryptSecret } from "./GitOps";
import { parseStoredEnvironmentVariables } from "./EnvironmentVariables";
import { createDecision, DecisionsError, type DecisionsRequest, type DecisionsResponse } from "./OpenRouterDecisions";
import { createLogger } from "./logger";

const log = createLogger("LogAnalysis");

export const LOG_ANALYSIS_INPUT_VERSION = 1;
export const MAX_LOG_CHARS = 8_000;
export const MAX_ATTEMPTS = 3;
// ponytail: instance-wide cap of 5 requests per 10s tick (~30/min); per-user budgets if one tenant floods it.
export const MAX_ANALYSES_PER_TICK = 5;
export const STALE_RUNNING_MS = 5 * 60_000;
/** failureDetected = failureProbability >= this. The raw probability is stored alongside. */
export const FAILURE_THRESHOLD = 0.5;
const RETRY_BASE_MS = 30_000;

// ---------- sanitization ----------

const SENSITIVE_NAME = String.raw`(?:api[_-]?key|apikey|access[_-]?key|secret[_-]?key|client[_-]?secret|secret|token|access[_-]?token|refresh[_-]?token|id[_-]?token|password|passwd|pwd|cookie|set-cookie|authorization|x-api-key|x-access-key|session(?:[_-]?id)?|private[_-]?key|credentials?)`;

const REDACTIONS: Array<[RegExp, string]> = [
	[/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
	[/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 [REDACTED]"],
	[/\b((?:set-)?cookie\s*:\s*)[^\r\n]*/gi, "$1[REDACTED]"],
	// Optional backslashes cover JSON that was itself stringified into the log.
	[new RegExp(String.raw`(\\?["']?${SENSITIVE_NAME}\\?["']?\s*[:=]\s*)(\\?"[^"\\]*\\?"|'[^']*'|[^\s,;&}]+)`, "gi"), "$1[REDACTED]"],
	[/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, "[REDACTED_JWT]"],
	[/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g, "[REDACTED_KEY]"],
	[/\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}/g, "[REDACTED_KEY]"],
	[/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, "[REDACTED_KEY]"],
	[/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, "[REDACTED_KEY]"],
	[/\bAIza[0-9A-Za-z_-]{35}\b/g, "[REDACTED_KEY]"],
	[/\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]*:[^\s@/]+@/gi, "[REDACTED_URL_CREDENTIALS]@"],
	// Bounded repeats keep this linear on long base64-like runs.
	[/[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}/g, "[EMAIL]"],
];

/** Masks common credentials, emails, and every configured secret value. */
export function sanitizeLogText(text: string, configuredSecrets: string[] = []): string {
	let result = text;
	// Longest first so a secret containing another secret is masked whole.
	for (const secret of [...new Set(configuredSecrets)].filter(Boolean).sort((a, b) => b.length - a.length)) {
		// Short values are masked only as standalone tokens so "1" doesn't erase every digit.
		result = secret.length >= 6
			? result.split(secret).join("[REDACTED_SECRET]")
			: result.replace(new RegExp(`(?<![A-Za-z0-9])${secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`, "g"), "[REDACTED_SECRET]");
	}
	for (const [pattern, replacement] of REDACTIONS) result = result.replace(pattern, replacement);
	return result;
}

/** Keeps the head and the tail (where errors usually are) within maxChars. */
export function truncateLogText(text: string, maxChars = MAX_LOG_CHARS): string {
	if (text.length <= maxChars) return text;
	const head = Math.floor(maxChars / 4);
	const marker = `\n...[${text.length - maxChars} chars truncated]...\n`;
	return text.slice(0, head) + marker + text.slice(text.length - (maxChars - head));
}

// ---------- request / response ----------

export interface AnalysisInput {
	logs: string;
	exitCode: number | null;
	errorType: string | null;
	durationSeconds: number | null;
}

/** Pulls only the minimum execution context from a stored TriggerLog. */
export function extractAnalysisInput(logs: string, result: string | null): AnalysisInput {
	let parsed: Record<string, unknown> = {};
	try {
		const value: unknown = JSON.parse(result ?? "null");
		if (value && typeof value === "object") parsed = value as Record<string, unknown>;
	} catch {
		// Non-JSON results (e.g. CORS_DENIED) carry no extra context.
	}
	const tooks = Array.isArray(parsed.tooks) ? parsed.tooks as Array<{ description?: unknown; value?: unknown }> : [];
	const total = tooks.find((entry) => typeof entry.description === "string" && entry.description.toLowerCase().startsWith("total"));
	return {
		logs,
		exitCode: typeof parsed.exit_code === "number" ? parsed.exit_code : null,
		errorType: typeof parsed.error_type === "string" ? parsed.error_type : result === "CORS_DENIED" ? "cors_denied" : null,
		durationSeconds: typeof total?.value === "number" ? Math.round(total.value * 1000) / 1000 : null,
	};
}

const PRIORITY_LEVELS = [
	"1: Informational. Routine output, nothing to do.",
	"2: Minor noise such as debug output or harmless warnings.",
	"3: Low. Warnings worth a look eventually.",
	"4: Low-moderate. Recoverable errors or retries that succeeded.",
	"5: Moderate. Degraded behavior or handled errors users may notice.",
	"6: Elevated. A real error affecting this execution's output.",
	"7: High. Clear malfunction likely to recur on every call.",
	"8: High. Failure with data loss, broken integrations, or security-relevant errors.",
	"9: Urgent. Crash, timeout, or outage-level failure.",
	"10: Critical. Widespread or security-critical failure needing immediate action.",
];

export function buildDecisionsRequest(model: string, input: AnalysisInput, configuredSecrets: string[]): DecisionsRequest {
	return {
		model,
		state: {
			logs: truncateLogText(sanitizeLogText(input.logs, configuredSecrets)),
			exit_code: input.exitCode,
			error_type: input.errorType,
			duration_seconds: input.durationSeconds,
		},
		questions: {
			failure: {
				type: "noul",
				instructions: "Does this serverless function execution log indicate a function failure or an actionable malfunction?",
				criteria: {
					true: "The log shows an error, exception, crash, timeout, or behavior the function owner should fix.",
					false: "The log shows normal operation, expected output, or harmless warnings.",
				},
			},
			attention: {
				type: "score",
				instructions: "How much attention should the function owner pay to this execution?",
				criteria: PRIORITY_LEVELS,
			},
		},
	};
}

export function hashAnalysisState(request: DecisionsRequest): string {
	return createHash("sha256").update(JSON.stringify(request.state)).digest("hex");
}

export interface NormalizedDecision {
	failureProbability: number;
	failureDetected: boolean;
	attentionPriority: number;
	attentionConfidence: number | null;
}

/** Score answers are an expected index (0-9) over PRIORITY_LEVELS; priority is that index + 1. */
export function normalizeDecision(response: DecisionsResponse): NormalizedDecision {
	const failure = response.answers.failure;
	const attention = response.answers.attention;
	if (failure?.type !== "noul" || attention?.type !== "score" || !("score" in attention)) {
		throw new DecisionsError("malformed", "OpenRouter returned answers that do not match the requested questions.");
	}
	const failureProbability = (failure as { noul: number }).noul;
	return {
		failureProbability,
		failureDetected: failureProbability >= FAILURE_THRESHOLD,
		attentionPriority: Math.min(10, Math.max(1, Math.round(attention.score) + 1)),
		attentionConfidence: typeof attention.confidence === "number" ? attention.confidence : null,
	};
}

// ---------- configuration ----------

type KeyFields = Pick<User, "aiProviderEndpoint" | "aiProviderApiKey" | "openRouterKey">;
type SettingsFields = KeyFields & Pick<User, "logAnalysisEnabled" | "logAnalysisModel">;

/** The account's own OpenRouter key when its AI provider is OpenRouter, otherwise the instance key. */
export function resolveOpenRouterKey(
	user: KeyFields,
	instanceKey: string | undefined,
	instanceSecret: string,
): { apiKey: string; source: "account" | "instance" } | null {
	if (user.aiProviderApiKey && (user.aiProviderEndpoint ?? DEFAULT_AI_PROVIDER_ENDPOINT) === DEFAULT_AI_PROVIDER_ENDPOINT) {
		const apiKey = decryptSecret(user.aiProviderApiKey, instanceSecret);
		if (apiKey) return { apiKey, source: "account" };
	}
	if (user.openRouterKey) return { apiKey: user.openRouterKey, source: "account" };
	return instanceKey ? { apiKey: instanceKey, source: "instance" } : null;
}

export interface LogAnalysisAvailability {
	enabled: boolean;
	model: string | null;
	keySource: "account" | "instance" | null;
	ready: boolean;
	reason: string | null;
}

export function getLogAnalysisAvailability(
	user: SettingsFields,
	instanceKey: string | undefined,
	instanceSecret: string,
): LogAnalysisAvailability {
	const keySource = resolveOpenRouterKey(user, instanceKey, instanceSecret)?.source ?? null;
	const model = user.logAnalysisModel || null;
	const reason = !user.logAnalysisEnabled
		? "Log analysis is turned off for this account."
		: !model
			? "No Decisions model is configured."
			: !keySource
				? "No OpenRouter API key is configured."
				: null;
	return { enabled: user.logAnalysisEnabled, model, keySource, ready: reason === null, reason };
}

/** Verifies the key can reach the Decisions endpoint with this model. Costs one tiny request. */
export async function validateLogAnalysisModel(apiKey: string, model: string, fetchImpl: typeof fetch = fetch): Promise<void> {
	const response = await createDecision(apiKey, buildDecisionsRequest(model, {
		logs: "SHSF configuration check: function started and returned OK.",
		exitCode: 0,
		errorType: null,
		durationSeconds: 0.1,
	}, []), fetchImpl);
	normalizeDecision(response);
}

// ---------- queue ----------

type AnalysisPrisma = Pick<PrismaClient, "function" | "logAnalysis" | "triggerLog">;

/** Called after a TriggerLog is stored for a function whose logging config has analyze=true. */
export async function enqueueLogAnalysis(prisma: AnalysisPrisma, triggerLogId: number, functionId: number): Promise<void> {
	const owner = await prisma.function.findUnique({
		where: { id: functionId },
		select: { user: { select: { logAnalysisEnabled: true, logAnalysisModel: true } } },
	});
	const model = owner?.user.logAnalysisModel;
	if (!owner?.user.logAnalysisEnabled || !model) return;
	await prisma.logAnalysis.upsert({
		where: { triggerLogId },
		create: { triggerLogId, model },
		update: {},
	});
}

interface ProcessDependencies {
	prisma: AnalysisPrisma;
	instanceKey: string | undefined;
	instanceSecret: string;
	fetchImpl?: typeof fetch;
	now?: () => Date;
}

export async function processLogAnalysisQueue(deps: ProcessDependencies): Promise<void> {
	const now = deps.now?.() ?? new Date();
	// A row left "running" (crash, restart, failed result write) may already have been billed by
	// OpenRouter, which has no idempotency key, so it is never resent.
	await deps.prisma.logAnalysis.updateMany({
		where: { status: "running", startedAt: { lt: new Date(now.getTime() - STALE_RUNNING_MS) } },
		data: { status: "failed", completedAt: now, error: "Analysis was interrupted and not retried to avoid a duplicate charge." },
	});

	const due = await deps.prisma.logAnalysis.findMany({
		where: { status: "pending", nextAttemptAt: { lte: now } },
		orderBy: { nextAttemptAt: "asc" },
		take: MAX_ANALYSES_PER_TICK,
		select: { id: true },
	});

	for (const { id } of due) {
		// Claim atomically; a concurrent worker that already took it gets count 0.
		const claim = await deps.prisma.logAnalysis.updateMany({
			where: { id, status: "pending", attempts: { lt: MAX_ATTEMPTS } },
			data: { status: "running", startedAt: now, attempts: { increment: 1 } },
		});
		if (claim.count === 1) await analyzeOne(id, deps, now);
	}
}

async function analyzeOne(id: number, deps: ProcessDependencies, now: Date): Promise<void> {
	const job = await deps.prisma.logAnalysis.findUnique({
		where: { id },
		include: {
			triggerLog: {
				include: {
					function: {
						select: {
							env: true,
							secure_header: true,
							logging: true,
							user: {
								select: {
									logAnalysisEnabled: true,
									logAnalysisModel: true,
									aiProviderEndpoint: true,
									aiProviderApiKey: true,
									openRouterKey: true,
									account_env: true,
								},
							},
						},
					},
				},
			},
		},
	});
	if (!job) return;
	const finish = (data: Prisma.LogAnalysisUpdateInput) =>
		deps.prisma.logAnalysis.update({ where: { id }, data: { completedAt: now, ...data } });

	const fn = job.triggerLog.function;
	const user = fn.user;
	if (!user.logAnalysisEnabled || !functionAnalysisEnabled(fn.logging)) {
		await finish({ status: "disabled", error: "Log analysis was turned off before this log was analyzed." });
		return;
	}
	const key = resolveOpenRouterKey(user, deps.instanceKey, deps.instanceSecret);
	if (!key) {
		await finish({ status: "skipped", error: "No OpenRouter API key is configured." });
		return;
	}

	const secrets = [
		...parseStoredEnvironmentVariables(user.account_env),
		...parseStoredEnvironmentVariables(fn.env),
	].map((entry) => entry.value);
	if (fn.secure_header) secrets.push(fn.secure_header);
	secrets.push(key.apiKey);

	const request = buildDecisionsRequest(job.model, extractAnalysisInput(job.triggerLog.logs, job.triggerLog.result), secrets);
	let response: DecisionsResponse;
	let normalized: NormalizedDecision;
	try {
		response = await createDecision(key.apiKey, request, deps.fetchImpl);
		normalized = normalizeDecision(response);
	} catch (error) {
		const failure = error instanceof DecisionsError ? error : new DecisionsError("network", "Unexpected analysis error.");
		log.warn({ analysisId: id, kind: failure.kind, status: failure.status }, "Log analysis attempt failed");
		if (failure.retryable && job.attempts < MAX_ATTEMPTS) {
			await deps.prisma.logAnalysis.update({
				where: { id },
				data: {
					status: "pending",
					error: failure.message,
					nextAttemptAt: new Date(now.getTime() + RETRY_BASE_MS * 2 ** (job.attempts - 1)),
				},
			});
			return;
		}
		await finish({ status: "failed", error: failure.message.slice(0, 512) });
		return;
	}
	// Outside the try: a DB error here must not be mistaken for a retryable provider error and re-billed.
	await finish({
			status: "completed",
			error: null,
			inputVersion: LOG_ANALYSIS_INPUT_VERSION,
			inputHash: hashAnalysisState(request),
			...normalized,
			decision: response.answers as Prisma.InputJsonValue,
			providerModel: response.model,
			costUsd: response.usage.cost ?? null,
			inputTokens: response.usage.input_tokens,
			outputTokens: response.usage.output_tokens,
		});
}

export function functionAnalysisEnabled(logging: string | null): boolean {
	try {
		const config = JSON.parse(logging ?? "null") as { enabled?: unknown; analyze?: unknown } | null;
		return config?.enabled === true && config.analyze === true;
	} catch {
		return false;
	}
}

// ---------- API shape ----------

export type ExecutionLogAnalysis = Pick<
	LogAnalysis,
	"status" | "failureProbability" | "failureDetected" | "attentionPriority" | "attentionConfidence" | "model" | "error" | "costUsd"
> & { analyzedAt: string | null; attentionDistribution: Record<string, number> | null };

export function toExecutionLogAnalysis(analysis: LogAnalysis | null | undefined): ExecutionLogAnalysis | null {
	if (!analysis) return null;
	return {
		status: analysis.status,
		failureProbability: analysis.failureProbability,
		failureDetected: analysis.failureDetected,
		attentionPriority: analysis.attentionPriority,
		attentionConfidence: analysis.attentionConfidence,
		model: analysis.providerModel ?? analysis.model,
		error: analysis.error,
		costUsd: analysis.costUsd,
		analyzedAt: analysis.status === "completed" ? analysis.completedAt?.toISOString() ?? null : null,
		attentionDistribution: priorityDistributionFrom(analysis.decision),
	};
}

/** Re-keys the score answer's probabilities from criteria index (0-9) to priority (1-10). */
function priorityDistributionFrom(decision: Prisma.JsonValue | null): Record<string, number> | null {
	const probabilities = (decision as { attention?: { probabilities?: unknown } } | null)?.attention?.probabilities;
	if (!probabilities || typeof probabilities !== "object") return null;
	return Object.fromEntries(
		Object.entries(probabilities as Record<string, unknown>)
			.filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isInteger(Number(entry[0])))
			.map(([index, probability]) => [String(Number(index) + 1), probability]),
	);
}
