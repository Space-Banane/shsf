import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";

// A real authorization-code provider: keys are public over HTTP and every code
// is bound to its original redirect URI, client, and S256 PKCE challenge.
export async function startMockOidc() {
	const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
	const otherKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
	type Profile = { claims: Record<string, unknown>; invalidSignature: boolean };
	const profiles = new Map<string, Profile>();
	const codes = new Map<string, { request: URLSearchParams; profile: Profile }>();
	let issuer = "";
	let unavailable = false;
	const disabledSubjects = new Set<string>();
	const server = createServer(async (req, res) => {
		const url = new URL(req.url ?? "/", issuer);
		const json = (status: number, body: unknown) => {
			res.writeHead(status, { "content-type": "application/json" });
			res.end(JSON.stringify(body));
		};
		if (unavailable) return json(503, { error: "temporarily_unavailable" });
		if (url.pathname === "/.well-known/openid-configuration") return json(200, {
			issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`,
			jwks_uri: `${issuer}/jwks`, response_types_supported: ["code"], subject_types_supported: ["public"],
			id_token_signing_alg_values_supported: ["RS256"], token_endpoint_auth_methods_supported: ["client_secret_post"],
			code_challenge_methods_supported: ["S256"],
		});
		if (url.pathname === "/jwks") return json(200, { keys: [{ ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" }] });
		if (url.pathname === "/authorize") {
			const state = url.searchParams.get("state") ?? "";
			const profile = profiles.get(state);
			profiles.delete(state);
			if (!profile || url.searchParams.get("code_challenge_method") !== "S256") return json(400, { error: "invalid_request" });
			if (typeof profile.claims.sub === "string" && disabledSubjects.has(profile.claims.sub)) {
				const callback = new URL(url.searchParams.get("redirect_uri")!);
				callback.searchParams.set("state", state);
				callback.searchParams.set("error", "access_denied");
				res.writeHead(302, { location: callback.href });
				return res.end();
			}
			const code = randomUUID();
			codes.set(code, { request: url.searchParams, profile });
			const callback = new URL(url.searchParams.get("redirect_uri")!);
			callback.searchParams.set("code", code);
			callback.searchParams.set("state", state);
			res.writeHead(302, { location: callback.href });
			return res.end();
		}
		if (url.pathname === "/token" && req.method === "POST") {
			const chunks: Buffer[] = [];
			for await (const chunk of req) chunks.push(Buffer.from(chunk));
			const body = new URLSearchParams(Buffer.concat(chunks).toString());
			const code = body.get("code") ?? "";
			const grant = codes.get(code);
			codes.delete(code);
			if (!grant || (typeof grant.profile.claims.sub === "string" && disabledSubjects.has(grant.profile.claims.sub)) || body.get("grant_type") !== "authorization_code" || body.get("client_id") !== "shsf-test" ||
				body.get("client_secret") !== "test-client-secret" || body.get("redirect_uri") !== grant.request.get("redirect_uri") ||
				createHash("sha256").update(body.get("code_verifier") ?? "").digest("base64url") !== grant.request.get("code_challenge")) {
				return json(400, { error: "invalid_grant" });
			}
			const now = Math.floor(Date.now() / 1000);
			const claims = {
				iss: issuer, sub: "test-user", aud: "shsf-test", iat: now, exp: now + 600, auth_time: now,
				nonce: grant.request.get("nonce"), email: "test@example.test", email_verified: true, name: "Test User",
				...grant.profile.claims,
			};
			const unsigned = [ { alg: "RS256", kid: "test-key" }, claims ].map((part) => Buffer.from(JSON.stringify(part)).toString("base64url")).join(".");
			const signature = sign("RSA-SHA256", Buffer.from(unsigned), grant.profile.invalidSignature ? otherKey : privateKey).toString("base64url");
			return json(200, { access_token: randomUUID(), token_type: "Bearer", expires_in: 600, id_token: `${unsigned}.${signature}` });
		}
		json(404, { error: "not_found" });
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Mock OIDC did not bind TCP");
	issuer = `http://127.0.0.1:${address.port}`;
	return {
		issuer,
		setUnavailable(value: boolean) { unavailable = value; },
		disableSubject(subject: string) { disabledSubjects.add(subject); },
		async authorize(url: string, claims: Record<string, unknown> = {}, invalidSignature = false) {
			const request = new URL(url);
			profiles.set(request.searchParams.get("state")!, { claims, invalidSignature });
			const response = await fetch(request, { redirect: "manual" });
			const location = response.headers.get("location");
			if (response.status !== 302 || !location) throw new Error(`Authorization failed: ${response.status}`);
			return new URL(location);
		},
		async close() { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())); },
	};
}
