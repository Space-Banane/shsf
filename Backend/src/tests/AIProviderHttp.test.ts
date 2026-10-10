import { lookup } from "node:dns/promises";
import type { LookupAddress, LookupAllOptions } from "node:dns";
import { EventEmitter } from "node:events";
import { request as httpRequest, type ClientRequestArgs } from "node:http";
import { request as httpsRequest } from "node:https";
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseAIProviderEndpoint, requestAIProvider } from "../lib/AIProviderHttp";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("node:http", () => ({ request: vi.fn() }));
vi.mock("node:https", () => ({ request: vi.fn() }));

// Select the all-addresses overload used by the guarded transport.
const lookupMock = vi.mocked(lookup as (hostname: string, options: LookupAllOptions) => Promise<LookupAddress[]>);

let status: number;
let responseBody: string;
let socketAddress: string | LookupAddress[] | undefined;
let lookupAll: boolean;

beforeEach(() => {
	vi.resetAllMocks();
	status = 200;
	responseBody = '{"data":[{"id":"test"}]}';
	socketAddress = undefined;
	lookupAll = false;
	lookupMock.mockResolvedValue([{ address: "93.184.215.14", family: 4 }]);
	const transport = (url: URL, options: ClientRequestArgs, onResponse: (response: PassThrough & { statusCode: number }) => void) => {
		const req = new EventEmitter() as EventEmitter & { end: ReturnType<typeof vi.fn> };
		req.end = vi.fn(() => {
			const respond = () => {
				const response = Object.assign(new PassThrough(), { statusCode: status });
				onResponse(response);
				response.end(responseBody);
			};
			// Simulate the socket's lookup before opening the connection.
			options.lookup!(url.hostname, { all: lookupAll }, (error, address) => {
				if (error) req.emit("error", error);
				else { socketAddress = address; respond(); }
			});
		});
		return req;
	};
	// The transport returns an EventEmitter sufficient for the request lifecycle under test.
	vi.mocked(httpRequest).mockImplementation(transport as unknown as typeof httpRequest);
	vi.mocked(httpsRequest).mockImplementation(transport as unknown as typeof httpsRequest);
});

describe("AI provider network boundary", () => {
	it.each([
		"0.0.0.0", "10.1.2.3", "100.100.100.200", "127.0.0.1", "127.1",
		"2130706433", "0x7f000001", "0177.0.0.1", "169.254.169.254",
		"172.16.0.1", "172.31.255.255", "192.168.1.1", "192.0.0.1",
		"192.0.2.1", "192.88.99.1", "198.18.0.1", "198.51.100.1",
		"203.0.113.1", "224.0.0.1", "255.255.255.255", "168.63.129.16",
		"[::]", "[::1]", "[fc00::1]", "[fd00::1]", "[fe80::1]", "[ff02::1]",
		"[::ffff:127.0.0.1]", "[::ffff:7f00:1]", "[::ffff:169.254.169.254]",
		"[64:ff9b::a00:1]", "[2001::1]", "[2001:db8::1]", "[2002:7f00:1::1]", "[3fff::1]",
		"[2d00::1]", "[2e00::1]", "[3000::1]", "[3800::1]", "[3c00::1]", "[3e00::1]",
		"[3f00::1]", "[3ffe:831f::7f00:1]",
		"[2000::1]", "[2001:1000::1]", "[2200::1]", "[2500::1]", "[2700::1]",
	])("rejects non-public literal %s before requesting a connection", async (hostname) => {
		await expect(requestAIProvider(`http://${hostname}/v1`, "/models", "key", 1000)).rejects.toThrow("public Internet addresses");
		expect(httpRequest).not.toHaveBeenCalled();
		expect(lookup).not.toHaveBeenCalled();
	});

	it.each(["https://user:password@example.com/v1", "https://example.com/v1?token=secret", "https://example.com/v1#fragment", "file:///etc/passwd"])("rejects ambiguous endpoint %s", (endpoint) => {
		expect(() => parseAIProviderEndpoint(endpoint)).toThrow();
	});

	it.each(["127.0.0.1", "169.254.169.254", "192.168.1.1", "::1", "fd00::1", "::ffff:127.0.0.1", "3000::1"])("rejects DNS pointing to %s", async (address) => {
		lookupMock.mockResolvedValue([{ address, family: address.includes(":") ? 6 : 4 }]);
		await expect(requestAIProvider("https://provider.example/v1", "/models", "key", 1000)).rejects.toThrow("public Internet addresses");
		expect(socketAddress).toBeUndefined();
	});

	it("rejects mixed public and private DNS answers", async () => {
		lookupMock.mockResolvedValue([{ address: "93.184.215.14", family: 4 }, { address: "::1", family: 6 }]);
		await expect(requestAIProvider("https://provider.example/v1", "/models", "key", 1000)).rejects.toThrow("public Internet addresses");
		expect(socketAddress).toBeUndefined();
	});

	it("pins the socket to the validated result without a second DNS resolution", async () => {
		lookupMock.mockResolvedValueOnce([{ address: "93.184.215.14", family: 4 }]).mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
		const response = await requestAIProvider("https://provider.example/v1/", "/models", "key", 1000);
		expect(await response.json()).toEqual({ data: [{ id: "test" }] });
		expect(socketAddress).toBe("93.184.215.14");
		expect(lookup).toHaveBeenCalledTimes(1);
		const [url, options] = vi.mocked(httpsRequest).mock.calls[0];
		expect((url as URL).hostname).toBe("provider.example");
		expect((url as URL).pathname).toBe("/v1/models");
		expect(options).toMatchObject({ agent: false, rejectUnauthorized: true, headers: { Authorization: "Bearer key" } });
	});

	it("disables certificate verification only for an opted-in HTTPS request", async () => {
		await requestAIProvider("https://provider.example/v1", "/models", "key", 1000, undefined, true);
		expect(vi.mocked(httpsRequest).mock.calls[0][1]).toMatchObject({ rejectUnauthorized: false, agent: false });
		await requestAIProvider("https://other-provider.example/v1", "/models", "key", 1000);
		expect(vi.mocked(httpsRequest).mock.calls[1][1]).toMatchObject({ rejectUnauthorized: true });
	});

	it("still blocks internal IP literals and private DNS with TLS verification disabled", async () => {
		await expect(requestAIProvider("https://127.0.0.1/v1", "/models", "key", 1000, undefined, true)).rejects.toThrow("public Internet addresses");
		expect(httpsRequest).not.toHaveBeenCalled();
		lookupMock.mockResolvedValue([{ address: "10.0.0.1", family: 4 }]);
		await expect(requestAIProvider("https://provider.example/v1", "/models", "key", 1000, undefined, true)).rejects.toThrow("public Internet addresses");
		expect(socketAddress).toBeUndefined();
	});

	it("still rejects redirects with TLS verification disabled", async () => {
		status = 302;
		await expect(requestAIProvider("https://provider.example/v1", "/models", "key", 1000, undefined, true)).rejects.toThrow("redirects are not allowed");
		expect(httpsRequest).toHaveBeenCalledTimes(1);
	});

	it("supports public IPv4 and IPv6 socket lookup results", async () => {
		lookupAll = true;
		const addresses = [{ address: "93.184.215.14", family: 4 }, { address: "2606:4700:4700::1111", family: 6 }];
		lookupMock.mockResolvedValue(addresses);
		await requestAIProvider("https://provider.example/v1", "/models", "key", 1000);
		expect(socketAddress).toEqual(addresses);
		expect(parseAIProviderEndpoint("https://[2606:4700:4700::1111]/v1").hostname).toBe("[2606:4700:4700::1111]");
	});

	it.each(["2001:4860:4860::8888", "2003::1", "2406:da00::1", "2410::1", "2606:4700:4700::1111", "2620:fe::fe", "2630::1", "2800::1", "2a09::1", "2a10::1", "2c00::1"])("allows allocated public IPv6 %s", (address) => {
		expect(parseAIProviderEndpoint(`https://[${address}]/v1`).hostname).toBe(`[${address}]`);
	});

	it("revalidates DNS when a saved provider later resolves internally", async () => {
		await requestAIProvider("https://provider.example/v1", "/models", "key", 1000);
		lookupMock.mockResolvedValue([{ address: "10.0.0.1", family: 4 }]);
		await expect(requestAIProvider("https://provider.example/v1", "/chat/completions", "key", 1000, { model: "test" })).rejects.toThrow("public Internet addresses");
		expect(lookup).toHaveBeenCalledTimes(2);
	});

	it.each([301, 302, 303, 307, 308])("rejects HTTP %s redirects without following or forwarding credentials", async (redirectStatus) => {
		status = redirectStatus;
		await expect(requestAIProvider("https://provider.example/v1", "/models", "key", 1000)).rejects.toThrow("redirects are not allowed");
		expect(httpsRequest).toHaveBeenCalledTimes(1);
		expect(httpRequest).not.toHaveBeenCalled();
	});

	it("uses the same guarded lookup for HTTP completion requests", async () => {
		responseBody = '{"choices":[]}';
		const response = await requestAIProvider("http://provider.example/v1", "/chat/completions", "key", 1000, { model: "test", messages: [] }, true);
		expect(await response.json()).toEqual({ choices: [] });
		const [url, options] = vi.mocked(httpRequest).mock.calls[0];
		expect((url as URL).pathname).toBe("/v1/chat/completions");
		expect(options).toMatchObject({ method: "POST", agent: false });
		expect(options).not.toHaveProperty("rejectUnauthorized");
	});

	it("fails closed on an empty or failed DNS lookup without leaking raw errors", async () => {
		lookupMock.mockResolvedValue([]);
		await expect(requestAIProvider("https://provider.example/v1", "/models", "key", 1000)).rejects.toThrow("Could not resolve");
		lookupMock.mockRejectedValue(new Error("secret from resolver"));
		await expect(requestAIProvider("https://provider.example/v1", "/models", "key", 1000)).rejects.toThrow("Could not resolve");
	});

	it("redacts synchronous transport errors instead of exposing key or Node details", async () => {
		vi.mocked(httpsRequest).mockImplementation(() => { throw new Error('Invalid header: provider-secret'); });
		await expect(requestAIProvider("https://provider.example/v1", "/models", "provider-secret", 1000)).rejects.toThrow("Could not reach the provider. Check the endpoint and network access.");
	});
});
