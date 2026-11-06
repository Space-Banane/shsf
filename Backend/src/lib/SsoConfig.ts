import { createHash } from "node:crypto";
import { z } from "zod";
import type { User } from "@prisma/client";

const flag = z.enum(["true", "false"]).transform((value) => value === "true");
const claimName = z.string().min(1).max(128);
const groupId = z.string().min(1).max(256).refine((v) => v === v.trim() && !/[\x00-\x1f]/.test(v));
const configSchema = z.object({
	SSO_ENABLED: flag.default(false),
	SSO_LOCAL_LOGIN_ENABLED: flag.default(true),
	SSO_NAME: z.string().trim().min(1).max(80).default("SSO"),
	SSO_ISSUER: z.url(),
	SSO_CLIENT_ID: z.string().min(1),
	SSO_CLIENT_SECRET: z.string().min(1),
	SSO_SCOPES: z.string().default("openid email profile"),
	SSO_EMAIL_CLAIM: claimName.default("email"),
	SSO_EMAIL_VERIFIED_CLAIM: claimName.default("email_verified"),
	SSO_NAME_CLAIM: claimName.default("name"),
	SSO_GROUPS_CLAIM: claimName.default("groups"),
	SSO_ROLES_CLAIM: claimName.default("roles"),
	SSO_GROUP_MAPPING: z.string().default("{}"),
	SSO_ADMIN_ROLES: z.string().default("[]"),
	SSO_SESSION_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
	SSO_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(30).default(5),
	SSO_ALLOW_HTTP_LOOPBACK: flag.default(false),
	REACT_APP_API_URL: z.url(),
	UI_URL: z.url(),
	INSTANCE_SECRET: z.string().min(32).refine((v) => v !== "default_insecure_secret_please_set"),
});

export function ssoDigest(value: unknown): string {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function parseSsoConfig(input: NodeJS.ProcessEnv) {
	try {
		const enabled = flag.default(false).parse(input.SSO_ENABLED);
		const localLoginEnabled = flag.default(true).parse(input.SSO_LOCAL_LOGIN_ENABLED);
		if (!enabled) {
			if (!localLoginEnabled) throw new Error();
			return null;
		}
		const c = configSchema.parse(input);
		const allowHttp = c.SSO_ALLOW_HTTP_LOOPBACK && input.NODE_ENV !== "production";
		const validateUrl = (value: string) => {
			const url = new URL(value);
			const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
			if (url.username || url.password || url.search || url.hash ||
				(url.protocol !== "https:" && !(allowHttp && loopback && url.protocol === "http:"))) throw new Error();
			return url;
		};
		validateUrl(c.SSO_ISSUER);
		const api = validateUrl(c.REACT_APP_API_URL);
		const ui = validateUrl(c.UI_URL);
		if (api.pathname !== "/" || ui.pathname !== "/") throw new Error();
		const groups = z.record(groupId, z.string().trim().min(1).max(128)).parse(JSON.parse(c.SSO_GROUP_MAPPING));
		const adminRoles = z.array(groupId).max(100).parse(JSON.parse(c.SSO_ADMIN_ROLES));
		const scopes = [...new Set(["openid", ...c.SSO_SCOPES.split(/\s+/).filter(Boolean)])];
		if (scopes.includes("offline_access")) throw new Error();
		const policy = {
			issuer: c.SSO_ISSUER, clientId: c.SSO_CLIENT_ID, groups, adminRoles,
			emailClaim: c.SSO_EMAIL_CLAIM, verifiedClaim: c.SSO_EMAIL_VERIFIED_CLAIM,
			nameClaim: c.SSO_NAME_CLAIM, groupsClaim: c.SSO_GROUPS_CLAIM, rolesClaim: c.SSO_ROLES_CLAIM,
			sessionSeconds: c.SSO_SESSION_SECONDS,
		};
		return {
			...policy, policy: ssoDigest(policy), provider: `oidc:${ssoDigest(c.SSO_ISSUER)}`,
			name: c.SSO_NAME, localLoginEnabled, clientSecret: c.SSO_CLIENT_SECRET,
			scopes: scopes.join(" "), timeoutSeconds: c.SSO_TIMEOUT_SECONDS, allowHttp,
			callbackUrl: new URL("/api/account/sso/callback", api).href, uiUrl: ui.origin,
			cookieSecret: ssoDigest(["shsf-oidc-login", c.INSTANCE_SECRET]),
		};
	} catch {
		// Config errors must not echo the client secret or the input object.
		throw new Error("Invalid SSO configuration. Check docs/sso.md.");
	}
}

export type SsoConfig = NonNullable<ReturnType<typeof parseSsoConfig>>;

export function ssoUserIsActive(user: Pick<User, "ssoIdentity" | "ssoPolicy" | "ssoValidUntil">, config: SsoConfig | null): boolean {
	return !user.ssoIdentity || Boolean(config && user.ssoPolicy === config.policy && user.ssoValidUntil && user.ssoValidUntil.getTime() > Date.now());
}

export function mapSsoClaims(config: SsoConfig, claims: Record<string, unknown>) {
	const subject = z.string().min(1).max(255).parse(claims.sub);
	const email = z.email().max(200).parse(claims[config.emailClaim]);
	if (claims[config.verifiedClaim] !== true) throw new Error("Invalid SSO claims");
	const displayName = z.string().trim().min(1).max(128).parse(claims[config.nameClaim]);
	const externalGroups = z.array(groupId).max(1000).parse(claims[config.groupsClaim] ?? []);
	const roles = z.array(groupId).max(1000).parse(claims[config.rolesClaim] ?? []);
	const authTime = z.number().int().nonnegative().parse(claims.auth_time);
	const expiration = z.number().int().positive().parse(claims.exp);
	const expiresAt = new Date(Math.min(authTime + config.sessionSeconds, expiration) * 1000);
	if (authTime * 1000 > Date.now() + 5000 || expiresAt.getTime() <= Date.now()) throw new Error("Invalid SSO claims");
	return {
		ssoIdentity: ssoDigest([config.issuer, subject]), email, displayName, expiresAt,
		role: roles.some((role) => config.adminRoles.includes(role)) ? "Admin" as const : "User" as const,
		groups: [...new Set(externalGroups)].filter((id) => Object.hasOwn(config.groups, id)).map((id) => ({ id, name: config.groups[id] })),
	};
}
