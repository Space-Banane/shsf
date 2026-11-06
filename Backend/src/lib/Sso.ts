import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "..";
import { decryptSecret, encryptSecret } from "./GitOps";
import { audit, syncSsoGroupMembership } from "./Sharing";
import { mapSsoClaims, type SsoConfig } from "./SsoConfig";

const challengeSchema = z.object({
	state: z.string().min(32), nonce: z.string().min(32), verifier: z.string().min(43),
	issuedAt: z.number(), policy: z.string(),
});

// Cache provider metadata/keys, not tokens. A failed discovery can be retried.
let discovery: { policy: string; value: Promise<import("openid-client", { with: { "resolution-mode": "import" } }).Configuration> } | undefined;
async function oidc(config: SsoConfig) {
	const client = await import("openid-client");
	if (!discovery || discovery.policy !== config.policy) {
		const value = client.discovery(new URL(config.issuer), config.clientId, config.clientSecret, undefined, {
			timeout: config.timeoutSeconds,
			execute: [client.enableNonRepudiationChecks, ...(config.allowHttp ? [client.allowInsecureRequests] : [])],
			[client.customFetch]: (url, options) => {
				const target = new URL(url);
				if (target.protocol !== "https:" && !(config.allowHttp && target.protocol === "http:" &&
					["localhost", "127.0.0.1", "[::1]"].includes(target.hostname))) throw new Error("Invalid OIDC endpoint");
				return fetch(url, { ...options, redirect: "error" });
			},
		});
		discovery = { policy: config.policy, value };
		void value.catch(() => { if (discovery?.value === value) discovery = undefined; });
	}
	return { client, configuration: await discovery.value };
}

export async function startSsoLogin(config: SsoConfig) {
	const { client, configuration } = await oidc(config);
	const challenge = {
		state: client.randomState(), nonce: client.randomNonce(), verifier: client.randomPKCECodeVerifier(),
		issuedAt: Date.now(), policy: config.policy,
	};
	const url = client.buildAuthorizationUrl(configuration, {
		redirect_uri: config.callbackUrl, scope: config.scopes, response_mode: "query",
		state: challenge.state, nonce: challenge.nonce, max_age: "0", prompt: "login",
		code_challenge: await client.calculatePKCECodeChallenge(challenge.verifier), code_challenge_method: "S256",
	});
	if (url.protocol !== "https:" && !(config.allowHttp && url.protocol === "http:" &&
		["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("Invalid OIDC endpoint");
	return { url: url.href, cookie: encryptSecret(JSON.stringify(challenge), config.cookieSecret) };
}

export async function completeSsoLogin(config: SsoConfig, callback: URL, cookie: string | null) {
	if (!cookie || cookie.length > 4096) throw new Error("Invalid SSO login");
	const decoded = decryptSecret(cookie, config.cookieSecret);
	const challenge = challengeSchema.parse(JSON.parse(decoded ?? "null"));
	if (challenge.policy !== config.policy || challenge.issuedAt > Date.now() || Date.now() - challenge.issuedAt > 300_000 ||
		callback.origin + callback.pathname !== config.callbackUrl) throw new Error("Invalid SSO login");
	const { client, configuration } = await oidc(config);
	const tokens = await client.authorizationCodeGrant(configuration, callback, {
		expectedState: challenge.state, expectedNonce: challenge.nonce, pkceCodeVerifier: challenge.verifier, maxAge: 0,
	});
	const claims = tokens.claims();
	if (!claims) throw new Error("Invalid SSO login");
	const mapped = mapSsoClaims(config, claims);
	const hash = randomBytes(32).toString("hex");
	// A retried transaction never repeats the token exchange. Concurrent first logins
	// can race on the unique identity/group keys; all changes still commit together.
	for (let attempt = 0; ; attempt++) {
		try {
			return await prisma.$transaction(async (tx) => {
				if (mapped.expiresAt.getTime() <= Date.now()) throw new Error("Expired SSO login");
				const existing = await tx.user.findUnique({ where: { ssoIdentity: mapped.ssoIdentity } });
				// Equal-millisecond attempts are rejected too: ambiguous ordering must
				// never restore earlier memberships or roles.
				if (existing?.ssoLoginStartedAt && existing.ssoLoginStartedAt.getTime() >= challenge.issuedAt) throw new Error("Stale SSO login");
				const data = {
					email: mapped.email, displayName: mapped.displayName, role: mapped.role,
					ssoIdentity: mapped.ssoIdentity, ssoPolicy: config.policy, ssoValidUntil: mapped.expiresAt,
					ssoLoginStartedAt: new Date(challenge.issuedAt),
				};
				const user = existing
					? await tx.user.update({ where: { id: existing.id }, data })
					: await tx.user.create({ data });
				if (existing && existing.ssoPolicy !== config.policy) {
					await tx.session.deleteMany({ where: { userId: user.id } });
					await tx.accessToken.updateMany({ where: { userId: user.id }, data: { expired: true } });
				}
				await syncSsoGroupMembership(config.provider, user.id, mapped.groups, tx);
				await tx.session.create({ data: { userId: user.id, hash, expiresAt: mapped.expiresAt } });
				await audit(user.id, "sso.login", "user", user.id, { role: user.role }, tx);
				return { hash, expiresAt: mapped.expiresAt };
			}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
		} catch (error) {
			if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
			const changedRecord = z.object({
				driverAdapterError: z.object({ cause: z.object({ kind: z.literal("mysql"), code: z.literal(1020) }) }),
			}).safeParse(error.meta).success;
			if (!["P2002", "P2034"].includes(error.code) && !(error.code === "P2039" && changedRecord)) throw error;
		}
	}
}
