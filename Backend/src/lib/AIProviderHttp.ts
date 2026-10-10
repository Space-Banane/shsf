import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

export class AIProviderEndpointError extends Error {}

const blockedIPv4 = new BlockList();
// Private, loopback, link-local, shared, documentation, benchmark, and reserved ranges.
for (const [address, prefix] of [
	["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
	["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
	["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
	["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blockedIPv4.addSubnet(address, prefix, "ipv4");
// Azure's virtual platform address is publicly numbered but not a public provider.
blockedIPv4.addAddress("168.63.129.16", "ipv4");

const globalIPv6 = new BlockList();
// Allocated public unicast ranges only; IANA reserves unlisted space. Update this
// table when IANA allocates additional ranges. Protocol/tunnel allocations are omitted.
// https://www.iana.org/assignments/ipv6-unicast-address-assignments/
for (const [address, prefix] of [
	["2001:200::", 23], ["2001:400::", 23], ["2001:600::", 23], ["2001:800::", 22],
	["2001:c00::", 23], ["2001:e00::", 23], ["2001:1200::", 23], ["2001:1400::", 22],
	["2001:1800::", 23], ["2001:1a00::", 23], ["2001:1c00::", 22], ["2001:2000::", 19],
	["2001:4000::", 23], ["2001:4200::", 23], ["2001:4400::", 23], ["2001:4600::", 23],
	["2001:4800::", 23], ["2001:4a00::", 23], ["2001:4c00::", 23], ["2001:5000::", 20],
	["2001:8000::", 19], ["2001:a000::", 20], ["2001:b000::", 20], ["2003::", 18],
	["2400::", 12], ["2410::", 12], ["2600::", 12], ["2610::", 23], ["2620::", 23],
	["2630::", 12], ["2800::", 12], ["2a00::", 12], ["2a10::", 12], ["2c00::", 12],
] as const) globalIPv6.addSubnet(address, prefix, "ipv6");
const blockedIPv6 = new BlockList();
// Documentation space within an otherwise allocated range.
blockedIPv6.addSubnet("2001:db8::", 32, "ipv6");

function assertPublicAddress(address: string): void {
	const family = isIP(address);
	if (
		(family === 4 && !blockedIPv4.check(address, "ipv4")) ||
		(family === 6 && globalIPv6.check(address, "ipv6") && !blockedIPv6.check(address, "ipv6"))
	) return;
	throw new AIProviderEndpointError("AI provider endpoints must resolve only to public Internet addresses. Internal and reserved addresses are not allowed.");
}

export function parseAIProviderEndpoint(endpoint: string): URL {
	let url: URL;
	try {
		url = new URL(endpoint.trim());
	} catch {
		throw new AIProviderEndpointError("Provider endpoint must be a valid HTTP or HTTPS URL.");
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new AIProviderEndpointError("Provider endpoint must use HTTP or HTTPS.");
	}
	if (url.username || url.password || url.search || url.hash) {
		throw new AIProviderEndpointError("Provider endpoint must not contain credentials, a query, or a fragment.");
	}
	const hostname = url.hostname.replace(/^\[|\]$/g, "");
	if (isIP(hostname)) assertPublicAddress(hostname);
	return url;
}

// Run validation inside the socket's lookup: the connection uses the checked DNS
// results directly, with no second resolution that could enable DNS rebinding.
const publicLookup: LookupFunction = (hostname, options, callback) => {
	lookup(hostname, { all: true, verbatim: true }).then((addresses) => {
		try {
			if (addresses.length === 0) throw new Error("Empty DNS response");
			for (const { address } of addresses) assertPublicAddress(address);
			if (options.all) callback(null, addresses);
			else callback(null, addresses[0].address, addresses[0].family);
		} catch (error) {
			callback(error instanceof AIProviderEndpointError ? error : new AIProviderEndpointError("Could not resolve the AI provider endpoint."), "");
		}
	}, () => callback(new AIProviderEndpointError("Could not resolve the AI provider endpoint."), ""));
};

export async function requestAIProvider(
	endpoint: string,
	path: "/models" | "/chat/completions",
	apiKey: string,
	timeoutMs: number,
	body?: Record<string, unknown>,
	ignoreTlsErrors = false,
): Promise<{ status: number; json: () => Promise<unknown> }> {
	const url = parseAIProviderEndpoint(endpoint);
	url.pathname = url.pathname.replace(/\/+$/, "") + path;
	return new Promise<{ status: number; json: () => Promise<unknown> }>((resolve, reject) => {
		const request = url.protocol === "https:" ? httpsRequest : httpRequest;
		const req = request(url, {
			method: body ? "POST" : "GET",
			headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
			agent: false, // Each connection must use the validating lookup; no pooled socket bypass.
			lookup: publicLookup,
			signal: AbortSignal.timeout(timeoutMs),
			...(url.protocol === "https:" ? { rejectUnauthorized: !ignoreTlsErrors } : {}),
		}, (response) => {
			const status = response.statusCode ?? 502;
			if (status >= 300 && status < 400) {
				response.destroy();
				reject(new AIProviderEndpointError("AI provider redirects are not allowed. Configure the final public endpoint directly."));
				return;
			}
			const chunks: Buffer[] = [];
			let size = 0;
			response.on("data", (chunk: Buffer) => {
				size += chunk.length;
				if (size > 8 * 1024 * 1024) {
					response.destroy();
					reject(new Error("AI provider response exceeded the 8 MiB limit."));
				} else chunks.push(chunk);
			});
			response.on("error", () => reject(new Error("Could not read the AI provider response.")));
			response.on("end", () => resolve({
				status,
				json: async () => {
					try {
						return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
					} catch {
						throw new Error("AI provider returned invalid JSON.");
					}
				},
			}));
		});
		req.on("error", (error) => reject(error instanceof AIProviderEndpointError ? error : new Error("Could not reach the provider. Check the endpoint and network access.")));
		req.end(body ? JSON.stringify(body) : undefined);
	}).catch((error: unknown) => {
		// Also redact synchronous request construction errors (e.g. invalid API-key headers).
		if (error instanceof AIProviderEndpointError) throw error;
		throw new Error("Could not reach the provider. Check the endpoint and network access.");
	});
}
