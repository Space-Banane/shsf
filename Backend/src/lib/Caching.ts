import { createHash } from "crypto";
import { prisma, API_KEY_HEADER } from "..";

export const SHSF_BINARY_TRANSPORT = "base64-bytes-v1";

export interface SHSFBinaryEnvelope {
	__shsf_transport: string;
	data: string;
	length?: number;
}

export function isSHSFBinaryEnvelope(value: any): value is SHSFBinaryEnvelope {
	return (
		typeof value === "object" &&
		value !== null &&
		value.__shsf_transport === SHSF_BINARY_TRANSPORT &&
		typeof value.data === "string"
	);
}

export function encodeBufferForTransport(value: any): any {
	if (Buffer.isBuffer(value)) {
		return {
			__shsf_transport: SHSF_BINARY_TRANSPORT,
			data: value.toString("base64"),
			length: value.length,
		};
	}

	if (Array.isArray(value)) {
		return value.map((entry) => encodeBufferForTransport(entry));
	}

	if (typeof value === "object" && value !== null) {
		const out: Record<string, any> = {};
		for (const [key, entry] of Object.entries(value)) {
			out[key] = encodeBufferForTransport(entry);
		}
		return out;
	}

	return value;
}

export function decodeTransportBinary(value: any): Buffer | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
			try {
				return decodeTransportBinary(JSON.parse(trimmed));
			} catch {
				return null;
			}
		}
		return null;
	}

	if (!isSHSFBinaryEnvelope(value)) {
		return null;
	}

	try {
		return Buffer.from(value.data, "base64");
	} catch {
		return null;
	}
}

function sanitizeFunctionResponseHeaders(input: Record<string, any>): Record<string, string> {
	const blocked = new Set([
		"connection",
		"keep-alive",
		"proxy-authenticate",
		"proxy-authorization",
		"te",
		"trailer",
		"transfer-encoding",
		"upgrade",
		"content-length",
		"content-encoding",
		"host",
		"server",
		"via",
		"alt-svc",
		"cf-ray",
		"cf-cache-status",
		"nel",
		"report-to",
	]);

	const out: Record<string, string> = {};
	for (const [rawKey, rawValue] of Object.entries(input || {})) {
		const key = String(rawKey).trim();
		const keyLower = key.toLowerCase();

		if (
			blocked.has(keyLower) ||
			keyLower.startsWith("x-amz-") ||
			keyLower.startsWith("x-ratelimit-")
		) {
			continue;
		}

		if (rawValue === undefined || rawValue === null) {
			continue;
		}

		out[key] = String(rawValue);
	}

	return out;
}

function getCaseInsensitiveHeader(headers: Record<string, string>, name: string): string | null {
	const target = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === target) {
			return value;
		}
	}
	return null;
}

/**
 * Strips generic/auth headers from the payload before hashing for cache keys.
 */
export function getSanitizedPayload(payload: any) {
	if (typeof payload !== "object" || payload === null) return payload;

	const sanitized = { ...payload };
	if (sanitized.headers) {
		const headers = { ...sanitized.headers };
		const toStrip = [
			"host",
			"user-agent",
			"connection",
			"accept",
			"accept-encoding",
			"accept-language",
			"postman-token",
			"cache-control",
			"cf-ray",
			"traceparent",
			"tracestate",
			"x-amzn-trace-id",
			"x-request-id",
			"x-correlation-id",
			"cf-connecting-ip",
			"cf-connecting-ipv6",
			"cf-pseudo-ipv4",
			"x-forwarded-for",
			"x-real-ip",
		];
		toStrip.forEach((h) => delete headers[h.toLowerCase()]);
		sanitized.headers = headers;
	}
	// source_ip might change even for same request logic
	delete sanitized.source_ip;
	return sanitized;
}

/**
 * Generates a SHA-256 hash of the sanitized payload.
 */
export function getPayloadHash(payload: any) {
	const sanitized = getSanitizedPayload(payload);
	return createHash("sha256").update(JSON.stringify(sanitized)).digest("hex");
}

/**
 * Common response logic for direct execution or cache hits
 */
export function handleFunctionResult(
	ctr: any,
	result: any,
	cached: boolean = false,
) {
	const normalizeMaybeJson = (value: any): any => {
		if (typeof value !== "string") {
			return value;
		}

		const trimmed = value.trim();
		if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
			try {
				return JSON.parse(trimmed);
			} catch {
				return value;
			}
		}

		return value;
	};

	const normalizedResult = normalizeMaybeJson(result);

	if (cached) {
		ctr.headers.set("X-SHSF-Cache", "HIT");
	} else {
		ctr.headers.set("X-SHSF-Cache", "MISS");
	}

	if (
		typeof normalizedResult === "object" &&
		normalizedResult !== null &&
		"_shsf" in normalizedResult
	) {
		const out = normalizedResult;
		const version: "v2" = out._shsf;
		const rawHeaders = ("_headers" in out && typeof out._headers === "object" && out._headers)
			? out._headers
			: {};
		const sanitizedHeaderMap = sanitizeFunctionResponseHeaders(rawHeaders);
		const headers: { key: string; value: any }[] | null =
			"_headers" in out
				? Object.entries(sanitizedHeaderMap).map(([key, value]) => ({
						key,
						value,
					}))
				: null;
		const response_code: number | null = "_code" in out ? out._code : null;
		const response: any | null = "_res" in out ? normalizeMaybeJson(out._res) : null;

		if (response_code === 301 || response_code === 302) {
			ctr.status(response_code);
			if (headers) {
				headers.forEach(({ key, value }) => {
					ctr.headers.set(key, value);
				});
			}
			const link = "_location" in out ? out._location : "/";
			return ctr.redirect(link);
		}

		ctr.status(response_code || 200);

		if (headers) {
			headers.forEach(({ key, value }) => {
				ctr.headers.set(key, value);
			});
		}

		if (response !== null && response !== undefined) {
			const binaryResponse = decodeTransportBinary(response);
			if (binaryResponse) {
				const functionContentType = getCaseInsensitiveHeader(
					sanitizedHeaderMap,
					"content-type"
				);
				const existingContentType =
					functionContentType ||
					ctr.headers.get("Content-Type") ||
					ctr.headers.get("content-type") ||
					null;
				if (!existingContentType) {
					ctr.headers.set("Content-Type", "application/octet-stream");
				} else {
					ctr.headers.set("Content-Type", existingContentType);
				}
				return ctr.print(binaryResponse);
			}
			return ctr.print(response);
		} else {
			return ctr.print("No Function Result :(");
		}
	}

	const topLevelBinary = decodeTransportBinary(normalizedResult);
	if (topLevelBinary) {
		const existingContentType =
			ctr.headers.get("Content-Type") || ctr.headers.get("content-type") || null;
		if (!existingContentType) {
			ctr.headers.set("Content-Type", "application/octet-stream");
		}
		return ctr.print(topLevelBinary);
	}

	return ctr.print(normalizedResult ?? "No Function Result :(");
}

/**
 * Tries to retrieve a cached result for a function.
 */
export async function getFunctionCache(functionId: number, hash: string) {
	return await prisma.functionCache.findFirst({
		where: {
			functionId,
			hash,
			expiresAt: { gt: new Date() },
		},
	});
}

/**
 * Stores a function execution result in the cache.
 */
export async function setFunctionCache(
	functionId: number,
	hash: string,
	result: any,
	ttl: number,
) {
	const serializableResult = encodeBufferForTransport(result);

	return await prisma.functionCache.upsert({
		where: {
			functionId_hash: {
				functionId,
				hash,
			},
		},
		update: {
			result: JSON.stringify(serializableResult),
			expiresAt: new Date(Date.now() + (ttl || 60) * 1000),
		},
		create: {
			functionId,
			hash,
			result: JSON.stringify(serializableResult),
			expiresAt: new Date(Date.now() + (ttl || 60) * 1000),
		},
	});
}
