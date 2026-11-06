import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import type { SsoConfig } from "../lib/SsoConfig";
import { startMockOidc } from "./helpers/mockOidc";

const state = vi.hoisted(() => ({ client: undefined as PrismaClient | undefined, config: null as SsoConfig | null }));
vi.mock("..", () => ({ get prisma() { return state.client; } }));
vi.mock("../lib/db", () => ({ get prisma() { return state.client; } }));
vi.mock("../lib/env", () => ({ env: { NODE_ENV: "production", LOG_LEVEL: "silent", get SSO() { return state.config; } } }));

import { completeSsoLogin, startSsoLogin } from "../lib/Sso";
import { parseSsoConfig, mapSsoClaims } from "../lib/SsoConfig";
import { checkAuthentication } from "../lib/Authentication";
import { functionAccessWhere } from "../lib/Sharing";
import { decryptSecret, encryptSecret } from "../lib/GitOps";

let provider: Awaited<ReturnType<typeof startMockOidc>>;
let config: SsoConfig;
const tag = `sso-${randomUUID()}`;
function configuration(overrides: NodeJS.ProcessEnv = {}) {
	const result = parseSsoConfig({
		NODE_ENV: "test", SSO_ENABLED: "true", SSO_ISSUER: provider.issuer,
		SSO_CLIENT_ID: "shsf-test", SSO_CLIENT_SECRET: "test-client-secret",
		SSO_ALLOW_HTTP_LOOPBACK: "true", REACT_APP_API_URL: "http://127.0.0.1:3100", UI_URL: "http://127.0.0.1:3101",
		INSTANCE_SECRET: "integration-test-instance-secret-of-at-least-32-characters", SSO_TIMEOUT_SECONDS: "1",
		SSO_GROUP_MAPPING: JSON.stringify({ engineering: `${tag}-engineering`, Engineering: `${tag}-case`, éngineering: `${tag}-accent`, operators: `${tag}-operators` }),
		...overrides,
	});
	if (!result) throw new Error("SSO must be enabled in this fixture");
	return result;
}
async function authorize(claims: Record<string, unknown> = {}, options = config, invalidSignature = false) {
	const login = await startSsoLogin(options);
	const callback = await provider.authorize(login.url, claims, invalidSignature);
	return { ...login, callback };
}

beforeAll(async () => {
	provider = await startMockOidc();
	config = configuration();
});
beforeEach(() => { state.config = config; provider.setUnavailable(false); });
afterAll(async () => { await provider.close(); });

describe("OIDC protocol against an HTTP provider (real openid-client)", () => {
	it("requests a fresh login with state, nonce and S256 PKCE and seals its browser challenge", async () => {
		const login = await startSsoLogin(config);
		const params = Object.fromEntries(new URL(login.url).searchParams);
		expect(params).toMatchObject({ client_id: "shsf-test", redirect_uri: config.callbackUrl, response_type: "code", response_mode: "query", code_challenge_method: "S256", max_age: "0", prompt: "login", scope: "openid email profile" });
		expect(params.state).toMatch(/^[\w-]{32,}$/);
		expect(params.nonce).toMatch(/^[\w-]{32,}$/);
		expect(params.code_challenge).toMatch(/^[\w-]{43}$/);
		expect(login.cookie).not.toContain(params.state);
		expect(JSON.parse(decryptSecret(login.cookie, config.cookieSecret)!)).toMatchObject({ state: params.state, nonce: params.nonce, policy: config.policy });
	});

	it.each([
		["nonce", { nonce: "wrong-nonce" }, /unexpected JWT claim/i],
		["issuer", { iss: "https://other.example.test" }, /unexpected JWT claim/i],
		["audience", { aud: "another-client" }, /unexpected JWT claim/i],
		["expired token", { exp: 1 }, /exp|timestamp/i],
		["future token", { nbf: 4_000_000_000 }, /nbf|timestamp/i],
		["missing auth_time", { auth_time: undefined }, /invalid response/i],
		["old authentication", { auth_time: 1 }, /auth_time|timestamp/i],
		["future authentication", { auth_time: 4_000_000_000 }, /auth_time|timestamp|Invalid SSO claims/i],
		["unverified email", { email_verified: false }, /Invalid SSO claims/i],
		["string email verification", { email_verified: "true" }, /Invalid SSO claims/i],
	] satisfies [string, Record<string, unknown>, RegExp][])("rejects %s before creating a user", async (_name, claims, message) => {
		const login = await authorize(claims);
		await expect(completeSsoLogin(config, login.callback, login.cookie)).rejects.toThrow(message);
	});

	it("rejects a token signed by a key outside the issuer's JWKS", async () => {
		const login = await authorize({}, config, true);
		await expect(completeSsoLogin(config, login.callback, login.cookie)).rejects.toMatchObject({ cause: { message: expect.stringMatching(/signature/i) } });
	});

	it("rejects state mismatch and provider denial", async () => {
		const login = await authorize();
		login.callback.searchParams.set("state", "wrong-state");
		await expect(completeSsoLogin(config, login.callback, login.cookie)).rejects.toMatchObject({ cause: { message: expect.stringMatching(/state/i) } });
		const denial = new URL(config.callbackUrl);
		denial.searchParams.set("state", new URL(login.url).searchParams.get("state")!);
		denial.searchParams.set("error", "access_denied");
		await expect(completeSsoLogin(config, denial, login.cookie)).rejects.toThrow(/authorization.*error/i);
	});

	it("rejects missing, damaged, expired and future browser challenges and a changed callback origin", async () => {
		const login = await authorize();
		await expect(completeSsoLogin(config, login.callback, null)).rejects.toThrow("Invalid SSO login");
		await expect(completeSsoLogin(config, login.callback, `${login.cookie}00`)).rejects.toMatchObject({ name: "ZodError" });
		const challenge = JSON.parse(decryptSecret(login.cookie, config.cookieSecret)!);
		for (const issuedAt of [Date.now() - 300_001, Date.now() + 60_000]) {
			const cookie = encryptSecret(JSON.stringify({ ...challenge, issuedAt }), config.cookieSecret);
			await expect(completeSsoLogin(config, login.callback, cookie)).rejects.toThrow("Invalid SSO login");
		}
		const wrongOrigin = new URL(login.callback);
		wrongOrigin.hostname = "localhost";
		await expect(completeSsoLogin(config, wrongOrigin, login.cookie)).rejects.toThrow("Invalid SSO login");
	});

	it("binds code exchange to the PKCE verifier", async () => {
		const login = await authorize();
		const challenge = JSON.parse(decryptSecret(login.cookie, config.cookieSecret)!);
		const cookie = encryptSecret(JSON.stringify({ ...challenge, verifier: "x".repeat(43) }), config.cookieSecret);
		await expect(completeSsoLogin(config, login.callback, cookie)).rejects.toThrow(/error.*response/i);
	});

	it("fails closed if token exchange or discovery is unavailable and can retry discovery", async () => {
		const login = await authorize();
		provider.setUnavailable(true);
		await expect(completeSsoLogin(config, login.callback, login.cookie)).rejects.toThrow(/response|status/i);
		const changed = configuration({ SSO_SESSION_SECONDS: "301" });
		await expect(startSsoLogin(changed)).rejects.toThrow(/response|status/i);
		provider.setUnavailable(false);
		expect(new URL((await startSsoLogin(changed)).url).pathname).toBe("/authorize");
		const offline = await startMockOidc();
		const unreachable = configuration({ SSO_ISSUER: offline.issuer });
		await offline.close();
		await expect(startSsoLogin(unreachable)).rejects.toThrow(/fetch failed/i);
	});

	it("does not infer administrator roles from group names", () => {
		const now = Math.floor(Date.now() / 1000);
		const claims = { sub: "roles", email: "roles@example.test", email_verified: true, name: "Roles", auth_time: now, exp: now + 600, groups: ["operators"], roles: ["admin"] };
		expect(mapSsoClaims(config, claims)).toMatchObject({ role: "User", groups: [{ id: "operators", name: `${tag}-operators` }] });
		const explicit = configuration({ SSO_ADMIN_ROLES: '["admin"]' });
		expect(mapSsoClaims(explicit, { ...claims, roles: [], groups: ["admin"] })).toMatchObject({ role: "User", groups: [] });
		expect(mapSsoClaims(explicit, claims).role).toBe("Admin");
	});
});

// SSO_TEST_DATABASE_URL must point to a migrated, disposable MariaDB database.
// Protocol rejection coverage above always runs, even without that database.
describe.skipIf(!process.env.SSO_TEST_DATABASE_URL)("SSO sessions and authorization (MariaDB)", () => {
	let db: PrismaClient;
	const email = (name: string) => `${name}-${tag}@example.test`;
	const claimsFor = (name: string, extra: Record<string, unknown> = {}) => ({ sub: `${tag}:${name}`, email: email(name), name: `User ${name}`, ...extra });
	async function login(name: string, extra: Record<string, unknown> = {}, options = config) {
		const request = await authorize(claimsFor(name, extra), options);
		const session = await completeSsoLogin(options, request.callback, request.cookie);
		const saved = await db.session.findFirstOrThrow({ where: { hash: session.hash }, include: { user: true } });
		return { ...request, ...session, saved, user: saved.user };
	}
	beforeAll(async () => {
		db = new PrismaClient({ adapter: new PrismaMariaDb(process.env.SSO_TEST_DATABASE_URL!), transactionOptions: { timeout: 30000 } });
		state.client = db;
	});
	afterAll(async () => {
		if (!db) return;
		const users = await db.user.findMany({ where: { email: { endsWith: `-${tag}@example.test` } }, select: { id: true } });
		const groups = await db.group.findMany({ where: { name: { startsWith: tag } }, select: { id: true } });
		await db.auditLog.deleteMany({ where: { OR: [
			{ actorId: { in: users.map((u) => u.id) } },
			{ targetType: "group", targetId: { in: groups.map((g) => g.id) } },
		] } });
		await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
		await db.group.deleteMany({ where: { id: { in: groups.map((g) => g.id) } } });
		await db.$disconnect();
	});

	it("creates a passwordless user and a normal usable Session with a bounded lifetime", async () => {
		const tokenExpiry = Math.floor(Date.now() / 1000) + 90;
		const result = await login("success", { exp: tokenExpiry });
		expect(result.expiresAt).toEqual(new Date(tokenExpiry * 1000));
		expect(result.user).toMatchObject({ email: email("success"), displayName: "User success", password: null, role: "User", ssoPolicy: config.policy });
		expect(result.saved.expiresAt).toEqual(result.expiresAt);
		expect(result.user.ssoValidUntil).toEqual(result.expiresAt);
		expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
		expect(result.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + config.sessionSeconds * 1000);
		expect(await checkAuthentication(result.hash, null)).toMatchObject({ success: true, method: "session", user: { id: result.user.id } });
		expect(await db.auditLog.findMany({ where: { actorId: result.user.id, action: "sso.login" }, select: { targetType: true, targetId: true } })).toEqual([{ targetType: "user", targetId: result.user.id }]);
		await expect(completeSsoLogin(config, result.callback, result.cookie)).rejects.toThrow(/error.*response/i);
		expect(await db.session.count({ where: { userId: result.user.id } })).toBe(1);
	});

	it("updates attributes by exact issuer and subject; case-distinct subjects stay separate", async () => {
		const first = await login("stable");
		const updated = await login("stable", { email: email("updated"), name: "Updated Name" });
		expect(updated.user).toMatchObject({ id: first.user.id, email: email("updated"), displayName: "Updated Name" });
		const distinct = await login("STABLE");
		expect(distinct.user.id).not.toBe(first.user.id);
		expect(await db.user.count({ where: { id: { in: [first.user.id, distinct.user.id] } } })).toBe(2);
		const otherIssuer = await startMockOidc();
		try {
			const otherConfig = configuration({ SSO_ISSUER: otherIssuer.issuer });
			const request = await startSsoLogin(otherConfig);
			const callback = await otherIssuer.authorize(request.url, claimsFor("stable", { email: email("other-issuer") }));
			const result = await completeSsoLogin(otherConfig, callback, request.cookie);
			const other = await db.session.findFirstOrThrow({ where: { hash: result.hash }, include: { user: true } });
			expect(other.user.email).toBe(email("other-issuer"));
			expect(other.user.id).not.toBe(first.user.id);
		} finally {
			await otherIssuer.close();
		}
	});

	it("never links an SSO identity to a local account just because email matches", async () => {
		const local = await db.user.create({ data: { email: email("collision"), displayName: "Local Admin", password: "existing-password-hash", role: "Admin" } });
		const request = await authorize(claimsFor("collision"));
		await expect(completeSsoLogin(config, request.callback, request.cookie)).rejects.toMatchObject({ code: "P2002" });
		expect(await db.user.findUniqueOrThrow({ where: { id: local.id } })).toMatchObject({ ssoIdentity: null, password: "existing-password-hash", role: "Admin", displayName: "Local Admin" });
		expect(await db.session.count({ where: { userId: local.id } })).toBe(0);
		expect(await db.user.count({ where: { email: email("collision") } })).toBe(1);
	});

	it("adds and removes real shared-function access while preserving local memberships", async () => {
		const recipient = await login("sharing", { groups: ["engineering", "engineering", "unknown"] });
		const owner = await db.user.create({ data: { email: email("owner"), displayName: "Owner" } });
		const ns = await db.namespace.create({ data: { name: "shared", userId: owner.id } });
		const fn = await db.function.create({ data: { userId: owner.id, namespaceId: ns.id, name: "shared", description: "SSO test", image: "python:3.12", startup_file: "main.py", executionId: tag } });
		const group = await db.group.findUniqueOrThrow({ where: { ssoProvider_ssoGroupId: { ssoProvider: config.provider, ssoGroupId: "engineering" } } });
		const local = await db.group.create({ data: { name: `${tag}-local` } });
		await db.groupMember.create({ data: { groupId: local.id, userId: recipient.user.id, source: "local" } });
		await db.resourceShare.create({ data: { groupId: group.id, functionId: fn.id, permission: "execute" } });
		const access = (need: "view" | "execute" | "edit") => db.function.findFirst({ where: { id: fn.id, ...functionAccessWhere(recipient.user.id, need) }, select: { id: true } });
		expect(await access("execute")).toEqual({ id: fn.id });
		expect(await access("edit")).toBeNull();
		expect(await db.groupMember.count({ where: { groupId: group.id, userId: recipient.user.id } })).toBe(1);
		for (const externalId of ["Engineering", "éngineering"]) {
			await login("sharing", { groups: [externalId] });
			expect(await access("view")).toBeNull();
			expect(await db.groupMember.findMany({ where: { userId: recipient.user.id, source: "sso" }, select: { group: { select: { ssoGroupId: true } } } })).toEqual([{ group: { ssoGroupId: externalId } }]);
		}
		const distinctGroups = await db.group.findMany({ where: { ssoProvider: config.provider, ssoGroupId: { in: ["engineering", "Engineering", "éngineering"] } }, select: { id: true } });
		expect(new Set(distinctGroups.map((item) => item.id)).size).toBe(3);
		await login("sharing", { groups: [] });
		expect(await access("view")).toBeNull();
		expect(await db.groupMember.findMany({ where: { userId: recipient.user.id }, select: { groupId: true, source: true } })).toEqual([{ groupId: local.id, source: "local" }]);
		expect(await db.resourceShare.count({ where: { groupId: group.id, functionId: fn.id } })).toBe(1);
		expect(await db.auditLog.findMany({ where: { targetId: group.id, action: { startsWith: "group.member" } }, orderBy: { id: "asc" }, select: { action: true } })).toEqual([{ action: "group.member.add" }, { action: "group.member.remove" }]);
	});

	it("maps only configured roles to Admin and removes the role on the next login", async () => {
		const explicit = configuration({ SSO_ADMIN_ROLES: '["administrator"]' });
		const admin = await login("role", { roles: ["administrator"] }, explicit);
		expect(admin.user.role).toBe("Admin");
		const demoted = await login("role", { roles: [], groups: ["administrator"] }, explicit);
		expect(demoted.user).toMatchObject({ id: admin.user.id, role: "User" });
		const ordinary = await login("ordinary", { roles: ["admin", "administrator"], groups: ["operators"] });
		expect(ordinary.user.role).toBe("User");
	});

	it("enforces session and user expiry for SSO credentials while local sessions and keys stay valid", async () => {
		const sso = await login("expiry");
		const key = await db.accessToken.create({ data: { userId: sso.user.id, token: `${tag}-sso-key`, name: "SSO key" } });
		const local = await db.user.create({ data: { email: email("local"), displayName: "Local", password: "local-password-hash" } });
		const localSession = await db.session.create({ data: { userId: local.id, hash: `${tag}-local-session` } });
		const localKey = await db.accessToken.create({ data: { userId: local.id, token: `${tag}-local-key`, name: "Local key" } });
		expect(await checkAuthentication(null, key.token)).toMatchObject({ success: true, method: "apiKey", user: { id: sso.user.id } });
		state.config = null;
		expect(await checkAuthentication(sso.hash, null)).toEqual({ success: false, method: "none", message: "Invalid session" });
		expect(await checkAuthentication(null, key.token)).toEqual({ success: false, method: "none", message: "Invalid API key" });
		state.config = config;
		expect(await checkAuthentication(sso.hash, null)).toMatchObject({ success: true, method: "session" });
		await db.session.update({ where: { id: sso.saved.id }, data: { expiresAt: new Date(0) } });
		expect(await checkAuthentication(sso.hash, null)).toEqual({ success: false, method: "none", message: "Invalid session" });
		expect(await checkAuthentication(null, key.token)).toMatchObject({ success: true, method: "apiKey" });
		await db.session.update({ where: { id: sso.saved.id }, data: { expiresAt: sso.expiresAt } });
		await db.user.update({ where: { id: sso.user.id }, data: { ssoValidUntil: new Date(0) } });
		expect(await checkAuthentication(sso.hash, null)).toEqual({ success: false, method: "none", message: "Invalid session" });
		expect(await checkAuthentication(null, key.token)).toEqual({ success: false, method: "none", message: "Invalid API key" });
		for (const current of [config, null]) {
			state.config = current;
			expect(await checkAuthentication(localSession.hash, null)).toMatchObject({ success: true, method: "session", user: { id: local.id } });
			expect(await checkAuthentication(null, localKey.token)).toMatchObject({ success: true, method: "apiKey", user: { id: local.id } });
		}
	});

	it("disabled provider accounts cannot get new sessions and existing sessions stop at expiry", async () => {
		const current = await login("disabled");
		const inFlight = await authorize(claimsFor("disabled"));
		provider.disableSubject(`${tag}:disabled`);
		await expect(completeSsoLogin(config, inFlight.callback, inFlight.cookie)).rejects.toThrow(/error.*response/i);
		const denied = await authorize(claimsFor("disabled"));
		expect(denied.callback.searchParams.get("error")).toBe("access_denied");
		await expect(completeSsoLogin(config, denied.callback, denied.cookie)).rejects.toThrow(/authorization.*error/i);
		expect(await checkAuthentication(current.hash, null)).toMatchObject({ success: true, user: { id: current.user.id } });
		await db.session.update({ where: { id: current.saved.id }, data: { expiresAt: new Date(0) } });
		expect(await checkAuthentication(current.hash, null)).toEqual({ success: false, method: "none", message: "Invalid session" });
		expect(await db.user.findUnique({ where: { id: current.user.id }, select: { email: true } })).toEqual({ email: email("disabled") });
		expect(await db.session.count({ where: { userId: current.user.id } })).toBe(1);
	});

	it("policy changes invalidate old credentials and cannot revive old keys after reauthentication", async () => {
		const original = await login("policy");
		const key = await db.accessToken.create({ data: { userId: original.user.id, token: `${tag}-policy-key`, name: "Policy key" } });
		const changed = configuration({ SSO_ADMIN_ROLES: '["new-admin"]' });
		state.config = changed;
		expect(await checkAuthentication(original.hash, null)).toEqual({ success: false, method: "none", message: "Invalid session" });
		expect(await checkAuthentication(null, key.token)).toEqual({ success: false, method: "none", message: "Invalid API key" });
		const pending = await authorize(claimsFor("policy"));
		await expect(completeSsoLogin(changed, pending.callback, pending.cookie)).rejects.toThrow("Invalid SSO login");
		const refreshed = await login("policy", {}, changed);
		expect(refreshed.user.id).toBe(original.user.id);
		expect(await checkAuthentication(refreshed.hash, null)).toMatchObject({ success: true, method: "session" });
		expect(await checkAuthentication(original.hash, null)).toEqual({ success: false, method: "none", message: "Invalid session" });
		expect(await checkAuthentication(null, key.token)).toEqual({ success: false, method: "none", message: "API key has expired" });
		state.config = null;
		expect(await checkAuthentication(refreshed.hash, null)).toEqual({ success: false, method: "none", message: "Invalid session" });
	});

	it("rejects a late callback that would restore older authorization", async () => {
		const now = Math.floor(Date.now() / 1000);
		const pending = await authorize(claimsFor("stale", { exp: now + 120, groups: ["engineering"] }));
		const fresh = await login("stale", { exp: now + 180, groups: [] });
		await expect(completeSsoLogin(config, pending.callback, pending.cookie)).rejects.toThrow("Stale SSO login");
		expect(await db.user.findUniqueOrThrow({ where: { id: fresh.user.id } })).toMatchObject({ ssoValidUntil: fresh.expiresAt });
		expect(await db.groupMember.count({ where: { userId: fresh.user.id } })).toBe(0);
		expect(await db.session.count({ where: { userId: fresh.user.id } })).toBe(1);
	});

	it("an older callback cannot restore Admin even when both tokens have identical timestamps", async () => {
		const options = configuration({ SSO_ADMIN_ROLES: '["administrator"]' });
		const now = Math.floor(Date.now() / 1000);
		const old = await authorize(claimsFor("same-time", { roles: ["administrator"], groups: ["engineering"], auth_time: now, exp: now + 600 }), options);
		await new Promise((resolve) => setTimeout(resolve, 2));
		const fresh = await login("same-time", { roles: [], groups: [], auth_time: now, exp: now + 600 }, options);
		await expect(completeSsoLogin(options, old.callback, old.cookie)).rejects.toThrow("Stale SSO login");
		expect(await db.user.findUnique({ where: { id: fresh.user.id }, select: { role: true } })).toEqual({ role: "User" });
		expect(await db.groupMember.count({ where: { userId: fresh.user.id } })).toBe(0);
	});

	it("shortening the configured lifetime permits fresh authentication immediately", async () => {
		const original = await login("shorter-policy");
		await new Promise((resolve) => setTimeout(resolve, 2));
		const shortened = configuration({ SSO_SESSION_SECONDS: "60" });
		state.config = shortened;
		const fresh = await login("shorter-policy", {}, shortened);
		expect(fresh.user.id).toBe(original.user.id);
		expect(fresh.expiresAt.getTime()).toBeLessThan(original.expiresAt.getTime());
		expect(await checkAuthentication(fresh.hash, null)).toMatchObject({ success: true, user: { id: original.user.id } });
		expect(await checkAuthentication(original.hash, null)).toEqual({ success: false, method: "none", message: "Invalid session" });
	});

	it("concurrent callbacks preserve the newest login and converge on one identity", async () => {
		const claims = claimsFor("concurrent", { groups: ["engineering"], auth_time: Math.floor(Date.now() / 1000) });
		const first = await authorize(claims);
		await new Promise((resolve) => setTimeout(resolve, 2));
		const second = await authorize(claims);
		const requests = [first, second];
		const outcomes = await Promise.allSettled(requests.map((request) => completeSsoLogin(config, request.callback, request.cookie)));
		expect(outcomes[1].status).toBe("fulfilled");
		if (outcomes[0].status === "rejected") expect(outcomes[0].reason).toMatchObject({ message: "Stale SSO login" });
		const users = await db.user.findMany({ where: { email: email("concurrent") } });
		expect(users).toHaveLength(1);
		expect(await db.session.count({ where: { userId: users[0].id } })).toBe(outcomes[0].status === "fulfilled" ? 2 : 1);
		for (const outcome of outcomes) {
			if (outcome.status === "fulfilled") expect(await checkAuthentication(outcome.value.hash, null)).toMatchObject({ success: true, method: "session", user: { id: users[0].id } });
		}
		expect(await db.groupMember.count({ where: { userId: users[0].id } })).toBe(1);
	});
});
