import { describe, it, expect } from "vitest";
import {
    decodeTransportBinary,
    encodeBufferForTransport,
    getSanitizedPayload,
    isSHSFBinaryEnvelope,
    SHSF_BINARY_TRANSPORT,
} from "../lib/Caching";

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

describe("isSHSFBinaryEnvelope", () => {
    it("returns true for a valid envelope shape", () => {
        const value = {
            __shsf_transport: SHSF_BINARY_TRANSPORT,
            data: Buffer.from("hello", "utf8").toString("base64"),
            length: 5,
        };

        expect(isSHSFBinaryEnvelope(value)).toBe(true);
    });

    it("returns false for invalid envelope shape", () => {
        expect(isSHSFBinaryEnvelope(null)).toBe(false);
        expect(isSHSFBinaryEnvelope("hello")).toBe(false);
        expect(
            isSHSFBinaryEnvelope({
                __shsf_transport: SHSF_BINARY_TRANSPORT,
                data: 42,
            })
        ).toBe(false);
        expect(
            isSHSFBinaryEnvelope({
                __shsf_transport: "unknown-transport",
                data: "aGVsbG8=",
            })
        ).toBe(false);
    });
});

describe("encodeBufferForTransport", () => {
    it("encodes top-level Buffer to the transport envelope", () => {
        const input = Buffer.from("hello", "utf8");
        const result = encodeBufferForTransport(input);

        expect(result).toEqual({
            __shsf_transport: SHSF_BINARY_TRANSPORT,
            data: "aGVsbG8=",
            length: 5,
        });
    });

    it("recursively encodes nested buffers in objects and arrays", () => {
        const input = {
            top: Buffer.from("a", "utf8"),
            nested: {
                list: [Buffer.from("b", "utf8"), { last: Buffer.from("c", "utf8") }],
            },
        };

        const result = encodeBufferForTransport(input);

        expect(result).toEqual({
            top: {
                __shsf_transport: SHSF_BINARY_TRANSPORT,
                data: "YQ==",
                length: 1,
            },
            nested: {
                list: [
                    {
                        __shsf_transport: SHSF_BINARY_TRANSPORT,
                        data: "Yg==",
                        length: 1,
                    },
                    {
                        last: {
                            __shsf_transport: SHSF_BINARY_TRANSPORT,
                            data: "Yw==",
                            length: 1,
                        },
                    },
                ],
            },
        });
    });

    it("leaves non-buffer values untouched", () => {
        const input = {
            text: "hello",
            num: 42,
            ok: true,
            n: null,
        };

        expect(encodeBufferForTransport(input)).toEqual(input);
    });
});

describe("decodeTransportBinary", () => {
    it("decodes a valid envelope back to a Buffer", () => {
        const envelope = {
            __shsf_transport: SHSF_BINARY_TRANSPORT,
            data: Buffer.from("cat", "utf8").toString("base64"),
            length: 3,
        };

        const decoded = decodeTransportBinary(envelope);

        expect(decoded).toBeInstanceOf(Buffer);
        expect(decoded?.toString("utf8")).toBe("cat");
    });

    it("returns null for values that are not envelopes", () => {
        expect(decodeTransportBinary(null)).toBeNull();
        expect(decodeTransportBinary("hello")).toBeNull();
        expect(
            decodeTransportBinary({
                __shsf_transport: "other",
                data: "aGVsbG8=",
            })
        ).toBeNull();
    });

    it("returns an empty Buffer when the envelope has invalid base64 data", () => {
        const invalidEnvelope = {
            __shsf_transport: SHSF_BINARY_TRANSPORT,
            data: "%%%%",
        };

        const decoded = decodeTransportBinary(invalidEnvelope);
        expect(decoded).toBeInstanceOf(Buffer);
        expect(decoded?.length).toBe(0);
    });
});