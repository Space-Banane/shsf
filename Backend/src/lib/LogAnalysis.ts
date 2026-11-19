/*
Opt-in advisory log analysis through the account's configured AI provider.

Flow: persistFunctionExecutionLog -> enqueueLogAnalysis (pending row) -> SystemCrons
"log-analysis" job -> processLogAnalysisQueue -> createAnalysis. The LogAnalysis row is
the durable queue, so pending work survives restarts. Nothing here touches the TriggerLog's
own result; deterministic execution status stays authoritative.
*/
import { createHash } from "node:crypto";
import type { LogAnalysis, Prisma, PrismaClient, User } from "@prisma/client";
import { DEFAULT_AI_PROVIDER_MODEL, getAIProvider, type AIProvider } from "./AIProvider";
import { parseStoredEnvironmentVariables } from "./EnvironmentVariables";
import {
	AnalysisError,
	buildAnalysisRequest as buildProviderRequest,
	createAnalysis,
	type AnalysisPayload,
	type AnalysisRequest,
	type AnalysisTransport,
} from "./LogAnalysisProvider";
import { createLogger } from "./logger";

const log = createLogger("LogAnalysis");

export const LOG_ANALYSIS_INPUT_VERSION = 2;
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

/** Builds the analysis request after sanitizing and truncating the log. */
export function buildAnalysisRequest(model: string, input: AnalysisInput, configuredSecrets: string[]): AnalysisRequest {
	return buildProviderRequest(model, {
		logs: truncateLogText(sanitizeLogText(input.logs, configuredSecrets)),
		exit_code: input.exitCode,
		error_type: input.errorType,
		duration_seconds: input.durationSeconds,
	});
}

export function hashAnalysisState(request: AnalysisRequest): string {
	return createHash("sha256").update(JSON.stringify(request.state)).digest("hex");
}

export interface NormalizedDecision {
	failureProbability: number;
	failureDetected: boolean;
	attentionPriority: number;
	attentionConfidence: number | null;
}

export function normalizeAnalysis(answers: AnalysisPayload): NormalizedDecision {
	return {
		failureProbability: answers.failure_probability,
		failureDetected: answers.failure_probability >= FAILURE_THRESHOLD,
		attentionPriority: Math.min(10, Math.max(1, Math.round(answers.attention_priority))),
		attentionConfidence: answers.confidence ?? null,
	};
}

// ---------- configuration ----------

type ProviderFields = Pick<User, "aiProviderEndpoint" | "aiProviderModel" | "aiProviderApiKey" | "aiProviderCapabilities" | "openRouterKey">;
type SettingsFields = ProviderFields & Pick<User, "logAnalysisEnabled" | "logAnalysisModel">;

export interface ResolvedLogAnalysisProvider {
	provider: AIProvider;
	model: string;
	keySource: "account" | "instance";
}

/**
 * Uses the account's AI provider (endpoint, key, model, capabilities, TLS options) or the
 * instance OpenRouter key as a fallback. The optional logAnalysisModel overrides the provider model.
 */
export function resolveLogAnalysisProvider(
	user: SettingsFields,
	instanceKey: string | undefined,
	instanceSecret: string,
): ResolvedLogAnalysisProvider | null {
	let provider: AIProvider | null;
	try {
		provider = getAIProvider(user, instanceKey, instanceSecret);
	} catch {
		// An undecryptable stored key is reported as unavailable rather than crashing the caller.
		return null;
	}
	if (!provider) return null;
	return {
		provider,
		model: user.logAnalysisModel || provider.model,
		keySource: user.aiProviderApiKey || user.openRouterKey ? "account" : "instance",
	};
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
	const resolved = resolveLogAnalysisProvider(user, instanceKey, instanceSecret);
	const model = resolved?.model ?? user.logAnalysisModel ?? null;
	const keySource = resolved?.keySource ?? null;
	const reason = !user.logAnalysisEnabled
		? "Log analysis is turned off for this account."
		: !resolved
			? "No AI provider is configured. Add one under AI generation."
			: null;
	return { enabled: user.logAnalysisEnabled, model, keySource, ready: reason === null, reason };
}

/** Verifies the provider can answer with this model. Costs one tiny request. */
export async function validateLogAnalysis(
	provider: AIProvider,
	model: string,
	requestImpl?: AnalysisTransport,
): Promise<void> {
	await createAnalysis({ ...provider, model }, buildProviderRequest(model, {
		logs: "SHSF configuration check: function started and returned OK.",
		exit_code: 0,
		error_type: null,
		duration_seconds: 0.1,
	}), requestImpl);
}

// ---------- queue ----------

type AnalysisPrisma = Pick<PrismaClient, "function" | "logAnalysis" | "triggerLog">;

/** Called after a TriggerLog is stored for a function whose logging config has analyze=true. */
export async function enqueueLogAnalysis(prisma: AnalysisPrisma, triggerLogId: number, functionId: number): Promise<void> {
	const owner = await prisma.function.findUnique({
		where: { id: functionId },
		select: { user: { select: { logAnalysisEnabled: true, logAnalysisModel: true, aiProviderModel: true } } },
	});
	const user = owner?.user;
	if (!user?.logAnalysisEnabled) return;
	const model = user.logAnalysisModel || user.aiProviderModel || DEFAULT_AI_PROVIDER_MODEL;
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
	requestImpl?: AnalysisTransport;
	now?: () => Date;
}

export async function processLogAnalysisQueue(deps: ProcessDependencies): Promise<void> {
	const now = deps.now?.() ?? new Date();
	// A row left "running" (crash, restart, failed result write) may already have been billed by
	// the provider, which has no idempotency key, so it is never resent.
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
									aiProviderModel: true,
									aiProviderApiKey: true,
									aiProviderCapabilities: true,
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
	const resolved = resolveLogAnalysisProvider(user, deps.instanceKey, deps.instanceSecret);
	if (!resolved) {
		await finish({ status: "skipped", error: "No AI provider is configured. Add one under AI generation." });
		return;
	}
	const provider = { ...resolved.provider, model: job.model || resolved.model };

	const secrets = [
		...parseStoredEnvironmentVariables(user.account_env),
		...parseStoredEnvironmentVariables(fn.env),
	].map((entry) => entry.value);
	if (fn.secure_header) secrets.push(fn.secure_header);
	secrets.push(provider.apiKey);

	const request = buildAnalysisRequest(provider.model, extractAnalysisInput(job.triggerLog.logs, job.triggerLog.result), secrets);
	let response: Awaited<ReturnType<typeof createAnalysis>>;
	let normalized: NormalizedDecision;
	try {
		response = await createAnalysis(provider, request, deps.requestImpl);
		normalized = normalizeAnalysis(response.answers);
	} catch (error) {
		const failure = error instanceof AnalysisError ? error : new AnalysisError("network", "Unexpected analysis error.");
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
			costUsd: response.usage.costUsd,
			inputTokens: response.usage.inputTokens,
			outputTokens: response.usage.outputTokens,
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
