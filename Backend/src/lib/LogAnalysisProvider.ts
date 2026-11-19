/*
Advisory log analysis over any OpenAI-compatible chat-completions provider.
Uses the account's saved AI provider settings (endpoint, key, model, JSON mode,
and TLS options) so analysis is not tied to OpenRouter.
*/
import { z } from "zod";
import type { AIProvider } from "./AIProvider";
import { AIProviderEndpointError, requestAIProvider } from "./AIProviderHttp";
import { getAllowAIProviderInternal } from "./DataManager";

export const ANALYSIS_TIMEOUT_MS = 30_000;

export const PRIORITY_LEVELS = [
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

export interface AnalysisState {
	logs: string;
	exit_code: number | null;
	error_type: string | null;
	duration_seconds: number | null;
}

export interface AnalysisRequest {
	model: string;
	state: AnalysisState;
	messages: Array<{ role: "system" | "user"; content: string }>;
}

/** Prompt and state sent to the provider. The caller sanitizes and truncates the logs. */
export function buildAnalysisRequest(model: string, state: AnalysisState): AnalysisRequest {
	return {
		model,
		state,
		messages: [
			{
				role: "system",
				content: `You triage serverless function execution logs. Reply with ONLY a JSON object, no prose and no code fences, using exactly these keys:
{"failure_probability": <number 0-1>, "attention_priority": <integer 1-10>, "confidence": <number 0-1>}

failure_probability is the chance the execution failed or shows an actionable malfunction.
attention_priority uses this scale:
${PRIORITY_LEVELS.join("\n")}`,
			},
			{
				role: "user",
				content: `Exit code: ${state.exit_code ?? "unknown"}
Error type: ${state.error_type ?? "none"}
Duration (seconds): ${state.duration_seconds ?? "unknown"}

Logs:
${state.logs}`,
			},
		],
	};
}

const payloadSchema = z.object({
	failure_probability: z.number().min(0).max(1),
	attention_priority: z.number().min(1).max(10),
	confidence: z.number().min(0).max(1).optional(),
});

const completionSchema = z.object({
	model: z.string().optional(),
	choices: z.array(z.object({ message: z.object({ content: z.unknown() }) })).min(1),
	usage: z.object({
		prompt_tokens: z.number().optional(),
		completion_tokens: z.number().optional(),
		input_tokens: z.number().optional(),
		output_tokens: z.number().optional(),
		cost: z.number().optional(),
	}).passthrough().optional(),
});

export type AnalysisPayload = z.infer<typeof payloadSchema>;

export interface AnalysisResponse {
	model: string;
	answers: AnalysisPayload;
	usage: { inputTokens: number | null; outputTokens: number | null; costUsd: number | null };
}

export type AnalysisErrorKind =
	| "auth" // 401/403: key rejected
	| "payment" // 402: out of credits
	| "not_found" // 404: unknown or unavailable model
	| "bad_request" // 400
	| "too_large" // 413
	| "rate_limited" // 429
	| "upstream" // 5xx
	| "timeout"
	| "network"
	| "malformed"; // 2xx with a body that does not match the schema

export class AnalysisError extends Error {
	constructor(
		readonly kind: AnalysisErrorKind,
		message: string,
		readonly status?: number,
	) {
		super(message);
	}

	/**
	 * Only a 429 proves the provider refused the request unbilled. Timeouts, network errors, and
	 * 5xx may follow a billed request, so those are never resent.
	 */
	get retryable(): boolean {
		return this.kind === "rate_limited";
	}
}

const STATUS_MESSAGES: Record<number, [AnalysisErrorKind, string]> = {
	400: ["bad_request", "The AI provider rejected the analysis request."],
	401: ["auth", "The AI provider rejected the API key."],
	402: ["payment", "The AI provider account has insufficient credits."],
	403: ["auth", "The AI provider key is not permitted to run analysis."],
	404: ["not_found", "The configured analysis model is not available on the AI provider."],
	413: ["too_large", "The sanitized log is too large for the AI provider."],
	429: ["rate_limited", "The AI provider rate limited the request."],
};

export function mapAnalysisStatus(status: number): AnalysisError {
	const known = STATUS_MESSAGES[status];
	if (known) return new AnalysisError(known[0], known[1], status);
	if (status >= 500) return new AnalysisError("upstream", `The AI provider returned an upstream error (HTTP ${status}).`, status);
	return new AnalysisError("bad_request", `The AI provider returned HTTP ${status}.`, status);
}

/** Reads a JSON object from a completion body, tolerating code fences and surrounding prose. */
export function parseAnalysisPayload(content: unknown): AnalysisPayload {
	const text = typeof content === "string"
		? content
		: Array.isArray(content)
			? content
				.map((part) => typeof part === "object" && part !== null && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : "")
				.join("")
			: "";
	if (!text.trim()) throw new AnalysisError("malformed", "The AI provider returned an empty analysis.");
	const match = text.match(/\{[\s\S]*\}/);
	let value: unknown;
	try {
		value = JSON.parse(match ? match[0] : text);
	} catch {
		throw new AnalysisError("malformed", "The AI provider returned analysis that is not valid JSON.");
	}
	const parsed = payloadSchema.safeParse(value);
	if (!parsed.success) throw new AnalysisError("malformed", "The AI provider returned analysis that does not match the expected shape.");
	return parsed.data;
}

export type AnalysisTransport = typeof requestAIProvider;

/**
 * Sends the analysis prompt through the provider's chat-completions endpoint.
 * requestImpl is injected by tests; production resolves internal-endpoint access itself.
 */
export async function createAnalysis(
	provider: AIProvider,
	request: AnalysisRequest,
	requestImpl?: AnalysisTransport,
	timeoutMs = ANALYSIS_TIMEOUT_MS,
): Promise<AnalysisResponse> {
	const body = {
		model: request.model,
		messages: request.messages,
		temperature: 0,
		...(provider.capabilities.json ? { response_format: { type: "json_object" } } : {}),
	};
	let response: Awaited<ReturnType<AnalysisTransport>>;
	try {
		response = requestImpl
			? await requestImpl(provider.endpoint, "/chat/completions", provider.apiKey, timeoutMs, body, provider.ignoreTlsErrors === true, false)
			: await requestAIProvider(provider.endpoint, "/chat/completions", provider.apiKey, timeoutMs, body, provider.ignoreTlsErrors === true, await getAllowAIProviderInternal());
	} catch (error) {
		const name = error instanceof Error ? error.name : "";
		if (name === "TimeoutError" || name === "AbortError") {
			throw new AnalysisError("timeout", `The AI provider did not respond within ${timeoutMs / 1000}s.`);
		}
		throw new AnalysisError("network", error instanceof AIProviderEndpointError ? error.message : "Could not reach the AI provider.");
	}

	if (response.status < 200 || response.status >= 300) throw mapAnalysisStatus(response.status);

	const parsed = completionSchema.safeParse(await response.json().catch(() => null));
	if (!parsed.success) throw new AnalysisError("malformed", "The AI provider returned a malformed completion response.");
	return {
		model: parsed.data.model ?? request.model,
		answers: parseAnalysisPayload(parsed.data.choices[0]?.message?.content),
		usage: {
			inputTokens: parsed.data.usage?.input_tokens ?? parsed.data.usage?.prompt_tokens ?? null,
			outputTokens: parsed.data.usage?.output_tokens ?? parsed.data.usage?.completion_tokens ?? null,
			costUsd: parsed.data.usage?.cost ?? null,
		},
	};
}
