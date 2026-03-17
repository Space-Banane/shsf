import { createHash } from "crypto";
import { prisma, API_KEY_HEADER } from "..";

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
			"x-correlation-id"
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
	return createHash("sha256")
		.update(JSON.stringify(sanitized))
		.digest("hex");
}

/**
 * Common response logic for direct execution or cache hits
 */
export function handleFunctionResult(ctr: any, result: any, cached: boolean = false) {
	if (cached) {
		ctr.headers.set("X-SHSF-Cache", "HIT");
	} else {
		ctr.headers.set("X-SHSF-Cache", "MISS");
	}

	if (typeof result === "object" && result !== null && "_shsf" in result) {
		const out = result;
		const version: "v2" = out._shsf;
		const headers: { key: string; value: any }[] | null =
			"_headers" in out
				? Object.entries(out._headers).map(([key, value]) => ({
						key,
						value,
				  }))
				: null;
		const response_code: number | null = "_code" in out ? out._code : null;
		const response: any | null = "_res" in out ? out._res : null;

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

		if (response) {
			return ctr.print(response);
		} else {
			return ctr.print("No Function Result :(");
		}
	}

	return ctr.print(result ?? "No Function Result :(");
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
export async function setFunctionCache(functionId: number, hash: string, result: any, ttl: number) {
	return await prisma.functionCache.upsert({
		where: {
			functionId_hash: {
				functionId,
				hash,
			},
		},
		update: {
			result: JSON.stringify(result),
			expiresAt: new Date(Date.now() + (ttl || 60) * 1000),
		},
		create: {
			functionId,
			hash,
			result: JSON.stringify(result),
			expiresAt: new Date(Date.now() + (ttl || 60) * 1000),
		},
	});
}
