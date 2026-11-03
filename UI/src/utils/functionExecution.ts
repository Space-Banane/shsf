import type { PopupResult, TimingEntry } from "../types/FunctionExecution";

const TOTAL_EXECUTION_TIME = "Total execution time";

function normalizeMaybeJson(value: unknown): unknown {
	if (typeof value !== "string") return value;
	const trimmed = value.trim();
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		try {
			return JSON.parse(trimmed);
		} catch {
			return value;
		}
	}
	return value;
}

function getHeader(headers: Record<string, string>, name: string): string {
	const target = name.toLowerCase();
	for (const [key, value] of Object.entries(headers || {})) {
		if (key.toLowerCase() === target) return value;
	}
	return "";
}

/**
 * Decides whether an execution result is an HTTP-style response ("_shsf": "v2")
 * that should be previewed as an image or HTML page instead of a plain value.
 */
export function classifyPopupResult(result: unknown): PopupResult | null {
	if (!result || typeof result !== "object") return null;
	const response = result as Record<string, unknown>;
	if (response._shsf !== "v2" || typeof response._headers !== "object") {
		return null;
	}

	const headers = response._headers as Record<string, string>;
	const code = (response._code as number | undefined) ?? 200;
	const contentType = getHeader(headers, "content-type");
	const body = normalizeMaybeJson(response._res);

	if (
		contentType.toLowerCase().startsWith("image/") &&
		body &&
		typeof body === "object" &&
		(body as Record<string, unknown>).__shsf_transport === "base64-bytes-v1" &&
		typeof (body as Record<string, unknown>).data === "string"
	) {
		return {
			kind: "image",
			headers,
			code,
			src: `data:${contentType};base64,${(body as Record<string, string>).data}`,
			contentType,
		};
	}

	if (typeof response._res === "string") {
		return { kind: "html", headers, html: response._res, code };
	}

	return null;
}

export type RunParamsParseResult =
	| { ok: true; value: unknown }
	| { ok: false };

/** Parses the optional JSON run parameters; blank or hidden params are `null`. */
export function parseRunParams(
	enabled: boolean,
	raw: string,
): RunParamsParseResult {
	if (!enabled || !raw.trim()) return { ok: true, value: null };
	try {
		return { ok: true, value: JSON.parse(raw) };
	} catch {
		return { ok: false };
	}
}

export function findTotalExecutionTime(took: TimingEntry[]): number | null {
	const total = took.find((entry) => entry.description === TOTAL_EXECUTION_TIME);
	return total ? total.value : null;
}
