/*
Minimal client for OpenRouter's (alpha) Decisions API: POST https://openrouter.ai/api/alpha/decisions
Kept separate from the chat-completion provider code in AIProvider.ts on purpose.
*/
import { z } from "zod";

export const OPENROUTER_DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
export const DECISIONS_TIMEOUT_MS = 30_000;

type Guidance = string | Record<string, unknown> | unknown[];

export type DecisionsQuestion =
	| { type: "noul"; instructions: Guidance; criteria?: { true: Guidance; false: Guidance } }
	| { type: "score"; instructions: Guidance; criteria: Guidance[] };

export interface DecisionsRequest {
	model: string;
	state: Guidance;
	questions: Record<string, DecisionsQuestion>;
}

const noulAnswer = z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) });
const scoreAnswer = z.object({
	type: z.literal("score"),
	score: z.number(),
	confidence: z.number().optional(),
	probabilities: z.record(z.string(), z.number()).optional(),
	legend: z.record(z.string(), z.unknown()).optional(),
});
const otherAnswer = z.object({ type: z.enum(["choice", "box"]) }).passthrough();

export const decisionsResponseSchema = z.object({
	id: z.string().optional(),
	model: z.string(),
	provider: z.string().optional(),
	answers: z.record(z.string(), z.discriminatedUnion("type", [noulAnswer, scoreAnswer, otherAnswer])),
	usage: z.object({
		input_tokens: z.number(),
		output_tokens: z.number(),
		cost: z.number().optional(),
	}),
});

export type DecisionsResponse = z.infer<typeof decisionsResponseSchema>;

export type DecisionsErrorKind =
	| "auth" // 401/403: key rejected or lacks Decisions access
	| "payment" // 402: out of credits
	| "not_found" // 404: unknown or incompatible model
	| "bad_request" // 400
	| "too_large" // 413
	| "rate_limited" // 429
	| "upstream" // 5xx, 524, 529
	| "timeout"
	| "network"
	| "malformed"; // 2xx with a body that does not match the schema

export class DecisionsError extends Error {
	constructor(
		readonly kind: DecisionsErrorKind,
		message: string,
		readonly status?: number,
	) {
		super(message);
	}

	/**
	 * Only a 429 proves OpenRouter refused the request unbilled. Timeouts, network errors, and 5xx
	 * may follow a billed request, and there is no idempotency key, so those are never resent.
	 */
	get retryable(): boolean {
		return this.kind === "rate_limited";
	}
}

const STATUS_MESSAGES: Record<number, [DecisionsErrorKind, string]> = {
	400: ["bad_request", "OpenRouter rejected the Decisions request."],
	401: ["auth", "OpenRouter rejected the API key."],
	402: ["payment", "The OpenRouter account has insufficient credits."],
	403: ["auth", "The OpenRouter key is not permitted to use the Decisions API."],
	404: ["not_found", "The configured model is not available on the Decisions API."],
	413: ["too_large", "The sanitized log is too large for the Decisions API."],
	429: ["rate_limited", "OpenRouter rate limited the request."],
};

export function mapDecisionsStatus(status: number): DecisionsError {
	const known = STATUS_MESSAGES[status];
	if (known) return new DecisionsError(known[0], known[1], status);
	if (status >= 500) return new DecisionsError("upstream", `OpenRouter upstream error (HTTP ${status}).`, status);
	return new DecisionsError("bad_request", `OpenRouter returned HTTP ${status}.`, status);
}

export async function createDecision(
	apiKey: string,
	request: DecisionsRequest,
	fetchImpl: typeof fetch = fetch,
	timeoutMs = DECISIONS_TIMEOUT_MS,
): Promise<DecisionsResponse> {
	let response: Response;
	try {
		response = await fetchImpl(OPENROUTER_DECISIONS_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"X-Title": "SHSF",
			},
			body: JSON.stringify(request),
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch (error) {
		const name = error instanceof Error ? error.name : "";
		if (name === "TimeoutError" || name === "AbortError") {
			throw new DecisionsError("timeout", `OpenRouter did not respond within ${timeoutMs / 1000}s.`);
		}
		throw new DecisionsError("network", "Could not reach OpenRouter.");
	}

	if (!response.ok) throw mapDecisionsStatus(response.status);

	const parsed = decisionsResponseSchema.safeParse(await response.json().catch(() => null));
	if (!parsed.success) throw new DecisionsError("malformed", "OpenRouter returned a malformed Decisions response.");
	return parsed.data;
}
