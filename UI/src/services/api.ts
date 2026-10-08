export type ApiErrorCode =
	| "VALIDATION_ERROR"
	| "AUTHENTICATION_REQUIRED"
	| "PERMISSION_DENIED"
	| "NOT_FOUND"
	| "CONFLICT"
	| "DEPENDENCY_ERROR"
	| "DEPENDENCY_TIMEOUT"
	| "FUNCTION_TIMEOUT"
	| "FUNCTION_EXECUTION_FAILED"
	| "REQUEST_TIMEOUT"
	| "RATE_LIMITED"
	| "NETWORK_ERROR"
	| "SERVER_ERROR"
	| "UNKNOWN_ERROR";

export interface ApiFailure {
	status: "FAILED";
	code: ApiErrorCode;
	message: string;
	retry_after_ms?: number;
	penalty_ms?: number;
}

export interface ApiRequestInit extends RequestInit {
	timeoutMs?: number;
	rawResponse?: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const ERROR_CODES = new Set<ApiErrorCode>([
	"VALIDATION_ERROR",
	"AUTHENTICATION_REQUIRED",
	"PERMISSION_DENIED",
	"NOT_FOUND",
	"CONFLICT",
	"DEPENDENCY_ERROR",
	"DEPENDENCY_TIMEOUT",
	"FUNCTION_TIMEOUT",
	"FUNCTION_EXECUTION_FAILED",
	"REQUEST_TIMEOUT",
	"RATE_LIMITED",
	"NETWORK_ERROR",
	"SERVER_ERROR",
	"UNKNOWN_ERROR",
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isSafeDetail(message: string): boolean {
	return (
		message.length <= 240 &&
		!message.includes("\n") &&
		!/(?:token|secret|password|authorization|cookie|api[_ -]?key)\s*[:=]/i.test(message) &&
		!/:\/\/[^/\s]+@/.test(message) &&
		!/(?:prisma|sqlstate|stack trace|typeerror|referenceerror|exception|errno|enoent|econn|docker|database query|\/app\/|node_modules)/i.test(message)
	);
}

function inferCode(status: number, rawMessage?: string): ApiErrorCode {
	const message = rawMessage?.toLowerCase() ?? "";

	if (message.includes("timed out") || message.includes("timeout")) {
		if (message.includes("pip") || message.includes("dependenc")) {
			return "DEPENDENCY_TIMEOUT";
		}
		if (message.includes("function") || message.includes("execution") || message.includes("code")) {
			return "FUNCTION_TIMEOUT";
		}
	}
	if (message.includes("dependency") || message.includes("requirements.txt") || message.includes("pip install")) {
		return "DEPENDENCY_ERROR";
	}

	switch (status) {
		case 400:
		case 422:
			return "VALIDATION_ERROR";
		case 401:
			return "AUTHENTICATION_REQUIRED";
		case 403:
			return "PERMISSION_DENIED";
		case 404:
			return "NOT_FOUND";
		case 408:
			return "FUNCTION_TIMEOUT";
		case 409:
			return "CONFLICT";
		case 424:
			return "DEPENDENCY_ERROR";
		case 429:
			return "RATE_LIMITED";
		default:
			return status >= 500 ? "SERVER_ERROR" : "UNKNOWN_ERROR";
	}
}

function statusForCode(code: ApiErrorCode): number {
	switch (code) {
		case "VALIDATION_ERROR": return 400;
		case "AUTHENTICATION_REQUIRED": return 401;
		case "PERMISSION_DENIED": return 403;
		case "NOT_FOUND": return 404;
		case "CONFLICT": return 409;
		case "FUNCTION_TIMEOUT":
		case "REQUEST_TIMEOUT": return 408;
		case "FUNCTION_EXECUTION_FAILED": return 422;
		case "DEPENDENCY_ERROR": return 424;
		case "DEPENDENCY_TIMEOUT": return 504;
		case "RATE_LIMITED": return 429;
		case "NETWORK_ERROR": return 503;
		case "SERVER_ERROR": return 500;
		default: return 400;
	}
}

function withRecovery(detail: string | undefined, recovery: string): string {
	if (!detail || !isSafeDetail(detail)) return recovery;
	const sentence = /[.!?]$/.test(detail) ? detail : `${detail}.`;
	return `${sentence} ${recovery}`;
}

function userMessage(code: ApiErrorCode, rawMessage?: string): string {
	switch (code) {
		case "VALIDATION_ERROR":
			return withRecovery(rawMessage, "Review the entered values and try again.");
		case "AUTHENTICATION_REQUIRED":
			return /invalid credentials/i.test(rawMessage ?? "")
				? "The email or password is incorrect. Check your credentials and try again."
				: "Your session has expired or could not be verified. Sign in and try again.";
		case "PERMISSION_DENIED":
			return "You do not have permission to do this. Ask an administrator for access if you think this is a mistake.";
		case "NOT_FOUND":
			return withRecovery(rawMessage, "Refresh the page; the item may have been moved or deleted.");
		case "CONFLICT":
			return withRecovery(rawMessage, "Refresh the latest data and try again.");
		case "DEPENDENCY_ERROR":
			return "A required dependency could not be installed. Check the dependency file and function logs, then try again.";
		case "DEPENDENCY_TIMEOUT":
			return "Dependency installation exceeded its time limit. Check the dependency source and logs, then retry.";
		case "FUNCTION_TIMEOUT":
			return "The function exceeded its configured execution timeout. Check its logs or increase the timeout in function settings.";
		case "FUNCTION_EXECUTION_FAILED":
			return "The function did not complete successfully. Check its logs, fix the reported error, and try again.";
		case "REQUEST_TIMEOUT":
			return "The server did not respond in time. Check your connection and try again; the operation may still be running.";
		case "RATE_LIMITED":
			return "Too many requests were sent. Wait a moment and try again.";
		case "NETWORK_ERROR":
			return "The server could not be reached. Check your connection and the SHSF service, then try again.";
		case "SERVER_ERROR":
			return "SHSF could not complete the request. Try again, and check the server logs if the problem continues.";
		default:
			return rawMessage && isSafeDetail(rawMessage)
				? rawMessage
				: "The request could not be completed. Try again.";
	}
}

export function normalizeApiFailure(
	status: number,
	payload?: unknown,
	overrideCode?: ApiErrorCode,
): ApiFailure {
	const record = isRecord(payload) ? payload : {};
	const rawMessage = stringValue(record.message);
	const explicitCode = stringValue(record.code);
	const code = overrideCode ?? (
		explicitCode && ERROR_CODES.has(explicitCode as ApiErrorCode)
			? explicitCode as ApiErrorCode
			: inferCode(status, rawMessage)
	);
	const retryAfter = typeof record.retry_after_ms === "number" ? record.retry_after_ms : undefined;
	const penalty = typeof record.penalty_ms === "number" ? record.penalty_ms : undefined;

	return {
		status: "FAILED",
		code,
		message: userMessage(code, rawMessage),
		...(retryAfter !== undefined ? { retry_after_ms: retryAfter } : {}),
		...(penalty !== undefined ? { penalty_ms: penalty } : {}),
	};
}

export function isApiFailure(value: unknown): value is ApiFailure {
	return (
		isRecord(value) &&
		value.status === "FAILED" &&
		typeof value.code === "string" &&
		ERROR_CODES.has(value.code as ApiErrorCode) &&
		typeof value.message === "string"
	);
}

function jsonResponse(body: ApiFailure, status = statusForCode(body.code)): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

async function normalizeResponse(response: Response): Promise<Response> {
	// Keeps lightweight mocked responses usable in component tests while real
	// browser responses always take the normalization path below.
	if (typeof response.clone !== "function") return response;

	let payload: unknown;
	try {
		const text = await response.clone().text();
		payload = text ? JSON.parse(text) : undefined;
	} catch {
		payload = undefined;
	}

	const record = isRecord(payload) ? payload : undefined;
	const bodyStatus = record?.status;
	const numericStatus = typeof bodyStatus === "number" ? bodyStatus : undefined;
	const bodyFailed = bodyStatus === "FAILED" || bodyStatus === "ERROR" || (numericStatus !== undefined && numericStatus >= 400);
	if (response.ok && !bodyFailed) return response;

	const initialStatus = !response.ok ? response.status : numericStatus ?? 400;
	const failure = normalizeApiFailure(initialStatus, payload);
	const normalizedStatus = response.ok ? statusForCode(failure.code) : response.status;
	return jsonResponse(failure, normalizedStatus);
}

export async function apiFetch(
	input: RequestInfo | URL,
	init: ApiRequestInit = {},
): Promise<Response> {
	const { timeoutMs = DEFAULT_TIMEOUT_MS, rawResponse = false, signal, ...requestInit } = init;
	const controller = new AbortController();
	let timedOut = false;
	let externalAbort = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const abortFromCaller = () => {
		externalAbort = true;
		controller.abort();
	};
	if (signal) {
		if (signal.aborted) abortFromCaller();
		else signal.addEventListener("abort", abortFromCaller, { once: true });
	}
	if (timeoutMs > 0) {
		timer = setTimeout(() => {
			timedOut = true;
			controller.abort();
		}, timeoutMs);
	}

	try {
		const response = await globalThis.fetch(input, {
			...requestInit,
			signal: controller.signal,
		});
		if (rawResponse && response.ok) return response;
		return await normalizeResponse(response);
	} catch (error) {
		if (externalAbort) throw error;
		if (timedOut) {
			return jsonResponse(normalizeApiFailure(408, undefined, "REQUEST_TIMEOUT"));
		}
		return jsonResponse(normalizeApiFailure(503, undefined, "NETWORK_ERROR"));
	} finally {
		if (timer) clearTimeout(timer);
		signal?.removeEventListener("abort", abortFromCaller);
	}
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
	if (isRecord(error) && ERROR_CODES.has(error.code as ApiErrorCode)) {
		return stringValue(error.message) ?? fallback;
	}
	return fallback;
}
