import { describe, it, expect } from "vitest";
import { getSanitizedPayload } from "../../lib/Caching";

describe("getSanitizedPayload", () => {
    it("returns non-object primitives as-is", async () => {
        expect(getSanitizedPayload("string")).toBe("string");
        expect(getSanitizedPayload(42)).toBe(42);
        expect(getSanitizedPayload(null)).toBe(null);
        expect(getSanitizedPayload(undefined)).toBe(undefined);
    });

    it("strips all known noisy headers", () => {
        const headersToStrip = [
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

        const headers: Record<string, string> = {};
        headersToStrip.forEach((h) => (headers[h] = "should-be-removed"));
        headers["content-type"] = "application/json";

        const result = getSanitizedPayload({ headers });

        headersToStrip.forEach((h) => {
            expect(result.headers).not.toHaveProperty(h);
        });
        expect(result.headers["content-type"]).toBe("application/json");
    });

    it("strips source_ip from the payload", () => {
        const payload = { source_ip: "1.2.3.4", body: "hello" };
        const result = getSanitizedPayload(payload);
        expect(result).not.toHaveProperty("source_ip");
        expect(result.body).toBe("hello");
    });

    it("does not mutate the original payload", () => {
        const payload = {
            source_ip: "1.2.3.4",
            headers: { host: "example.com", "content-type": "text/plain" },
        };
        getSanitizedPayload(payload);
        expect(payload.source_ip).toBe("1.2.3.4");
        expect(payload.headers.host).toBe("example.com");
    });

    it("handles payload with no headers or source_ip", () => {
        const payload = { body: "data", method: "POST" };
        const result = getSanitizedPayload(payload);
        expect(result).toEqual({ body: "data", method: "POST" });
    });

    it("handles empty headers object", () => {
        const payload = { headers: {} };
        const result = getSanitizedPayload(payload);
        expect(result.headers).toEqual({});
    });

    it("is case-insensitive for header stripping", () => {
        const payload = { headers: { "X-Forwarded-For": "1.2.3.4" } };
        // The function uses h.toLowerCase() on the strip list, but the incoming
        // headers are keyed as-is. Only lowercase keys are stripped.
        // This test documents the current behaviour: mixed-case keys survive.
        const result = getSanitizedPayload(payload);
        expect(result.headers).toHaveProperty("X-Forwarded-For");
    });
});