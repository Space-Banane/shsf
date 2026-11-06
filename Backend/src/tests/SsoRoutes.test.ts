import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Server } from "rjweb-server";
import { createServer } from "node:net";
import { hash } from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Runtime } from "@rjweb/runtime-node";
import { parseSsoConfig } from "../lib/SsoConfig";
import { env } from "../lib/env";
import { corsMiddleware } from "../lib/middlewares/cors";
import { mainMiddleware } from "../lib/middlewares/main";
import { authResolutionMiddleware, authEnforcementMiddleware } from "../lib/middlewares/auth";

const mocks = vi.hoisted(() => ({
	start: vi.fn(), complete: vi.fn(), info: vi.fn(), warn: vi.fn(),
	adminId: 0, db: undefined as PrismaClient | undefined,
	server: undefined as unknown as Server<{ port: number; bind: string }>,
}));
vi.mock("..", () => ({
	COOKIE: "shsf_session", API_KEY_HEADER: "x-access-key", DOMAIN: "localhost",
	get prisma() { return mocks.db; },
	fileRouter: {
		Path: class {
			http(...args: Parameters<Parameters<Parameters<typeof mocks.server.path>[1]>[0]["http"]>) {
				mocks.server.path("/", (path) => path.http(...args));
				return this;
			}
		},
	},
}));
vi.mock("../lib/Sso", () => ({ startSsoLogin: mocks.start, completeSsoLogin: mocks.complete }));
vi.mock("../lib/Authentication", async (importOriginal) => ({ ...await importOriginal<typeof import("../lib/Authentication")>(), checkAuthentication: async () => mocks.adminId ? { success: true, method: "session", user: { id: mocks.adminId, role: "Admin" } } : { success: false, method: "none", message: "Invalid session" } }));
vi.mock("../lib/Runner", () => ({ persistFunctionExecutionLog: vi.fn() }));
vi.mock("../lib/logger", () => ({ createLogger: () => ({ info: mocks.info, warn: mocks.warn, debug: vi.fn() }) }));

beforeAll(async () => {
	env.SSO = parseSsoConfig({
		SSO_ENABLED: "true", SSO_ISSUER: "https://id.example", SSO_CLIENT_ID: "shsf", SSO_CLIENT_SECRET: "client-secret",
		INSTANCE_SECRET: "at-least-32-characters-for-instance-secret", REACT_APP_API_URL: "https://api.example", UI_URL: "https://app.example",
	});
	const socket = createServer();
	await new Promise<void>((resolve) => socket.listen(0, "127.0.0.1", resolve));
	const address = socket.address();
	if (!address || typeof address === "string") throw new Error("Missing test port");
	await new Promise<void>((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
	const server = new Server(Runtime, { port: address.port, bind: "127.0.0.1" }, [
		corsMiddleware.use({}), mainMiddleware.use({}), authResolutionMiddleware.use({}), authEnforcementMiddleware.use({}),
	]);
	// The route builder only needs Server.path; its middleware context is resolved by rjweb at runtime.
	mocks.server = server as unknown as typeof mocks.server;
	await import("../routes/api/account/sso.js");
	await import("../routes/api/account/login.js");
	await import("../routes/api/config.js");
	await import("../routes/api/admin/groups.js");
	if (process.env.SSO_TEST_DATABASE_URL) mocks.db = new PrismaClient({ adapter: new PrismaMariaDb(process.env.SSO_TEST_DATABASE_URL) });
	server.path("/", (path) => path
		.http("GET", "/login", (route) => route.onRequest((ctr) => ctr.print("<main>Sign in</main>")))
		.http("GET", "/assets/login.js", (route) => route.onRequest((ctr) => ctr.print("login-script"))));
	await server.start();
});
afterAll(async () => { mocks.server.stop(); await mocks.db?.$disconnect(); });
beforeEach(() => {
	vi.clearAllMocks();
	mocks.adminId = 0;
	mocks.start.mockResolvedValue({ url: "https://id.example/authorize?state=random", cookie: "encrypted-challenge" });
	mocks.complete.mockResolvedValue({ hash: "random-session-hash", expiresAt: new Date(Date.now() + 300_000) });
});

const get = (path: string, cookie = "shsf_session=expired") => mocks.server.fetch(path, { redirect: "manual", headers: { cookie } });

describe("SSO HTTP routes and middleware", () => {
	it("advertises only public config even with an expired session", async () => {
		const response = await get("/api/config");
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ isDemo: false, sso: { name: "SSO" }, localLoginEnabled: true });
	});
	it("sets a host-only HttpOnly challenge and redirects to the provider", async () => {
		const response = await get("/api/account/sso/login");
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("https://id.example/authorize?state=random");
		const cookie = response.headers.get("set-cookie") ?? "";
		expect(cookie).toContain("shsf_oidc_login=encrypted-challenge");
		expect(cookie.toLowerCase()).toContain("httponly");
		expect(cookie.toLowerCase()).toContain("secure");
		expect(cookie.toLowerCase()).toContain("samesite=lax");
		expect(cookie).toContain("Path=/api/account/sso");
		expect(cookie).not.toContain("Domain=");
	});
	it("uses the configured callback origin, creates the existing session cookie and clears the challenge", async () => {
		const response = await get("/api/account/sso/callback?code=secret-code&state=secret-state", "shsf_session=expired; shsf_oidc_login=sealed");
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("https://app.example");
		expect(mocks.complete).toHaveBeenCalledWith(env.SSO, new URL("https://api.example/api/account/sso/callback?code=secret-code&state=secret-state"), "sealed");
		const cookies = response.headers.getSetCookie();
		expect(cookies.find((c) => c.startsWith("shsf_session="))).toContain("random-session-hash");
		expect(cookies.find((c) => c.startsWith("shsf_session="))).toContain("Domain=localhost");
		expect(cookies.find((c) => c.startsWith("shsf_oidc_login="))).toContain("1970");
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.get("referrer-policy")).toBe("no-referrer");
	});
	it("never exposes callback values or raw provider errors, including debug logging", async () => {
		env.REQUEST_DEBUGGING = true;
		env.RESPONSE_DEBUGGING = true;
		mocks.complete.mockRejectedValue(new Error("provider-secret-sentinel"));
		const response = await get("/api/account/sso/callback?code=code-sentinel&state=state-sentinel");
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("https://app.example/login?sso=failed");
		expect(await response.text()).toBe("");
		const logs = JSON.stringify([...mocks.info.mock.calls, ...mocks.warn.mock.calls]);
		expect(logs).toContain("SSO sign-in failed");
		for (const secret of ["provider-secret-sentinel", "code-sentinel", "state-sentinel"]) expect(logs).not.toContain(secret);
		env.REQUEST_DEBUGGING = false;
		env.RESPONSE_DEBUGGING = false;
	});
	it("follows a failed callback back to the public login UI with an invalid cookie", async () => {
		mocks.complete.mockRejectedValue(new Error("Invalid SSO login"));
		const failed = await get("/api/account/sso/callback?code=bad&state=bad");
		const destination = new URL(failed.headers.get("location") ?? "");
		const page = await get(destination.pathname + destination.search);
		expect(page.status).toBe(200);
		expect(await page.text()).toBe("<main>Sign in</main>");
		const asset = await get("/assets/login.js");
		expect(asset.status).toBe(200);
		expect(await asset.text()).toBe("login-script");
		expect((await get("/exec/protected")).status).toBe(401);
	});

	it("keeps authentication enforcement on other routes", async () => {
		const response = await get("/api/private");
		expect(response.status).toBe(401);
	});
	it("enforces the login limit even when the instance disables its general rate limit", async () => {
		env.RATELIMIT = 0;
		const statuses = [];
		for (let i = 0; i < 6; i++) statuses.push((await get("/api/account/sso/login")).status);
		expect(statuses).toContain(429);
	});
});


describe.skipIf(!process.env.SSO_TEST_DATABASE_URL)("group linkage changes (database)", () => {
	it("keeps local password login working alongside SSO and refuses local login for SSO identities", async () => {
		const db = mocks.db;
		if (!db || !env.SSO) throw new Error("Missing test config");
		const email = `sso-local-route-${Date.now()}@example.test`;
		const user = await db.user.create({ data: { email, displayName: "Local", password: await hash("test-password-123", 4) } });
		const login = () => mocks.server.fetch("/api/account/login", {
			method: "POST", headers: { "content-type": "application/json", cookie: "shsf_session=expired-sso" }, body: JSON.stringify({ email, password: "test-password-123" }),
		});
		try {
			const local = await login();
			expect(local.status).toBe(200);
			expect(await local.json()).toEqual({ status: "OK", message: "Welcome back!" });
			expect(local.headers.get("set-cookie")).toContain("shsf_session=");
			expect(local.headers.get("set-cookie")).toContain("Domain=localhost");
			await db.user.update({ where: { id: user.id }, data: { ssoIdentity: "a".repeat(64) } });
			const managed = await login();
			expect(managed.status).toBe(401);
			expect(await managed.json()).toEqual({ status: "FAILED", message: "Invalid Credentials" });
			env.SSO.localLoginEnabled = false;
			const disabled = await login();
			expect(disabled.status).toBe(403);
			expect(await disabled.json()).toEqual({ status: "FAILED", message: "Local login is disabled" });
		} finally {
			env.SSO.localLoginEnabled = true;
			await db.user.delete({ where: { id: user.id } });
		}
	});

	it("unlinks SSO memberships atomically without removing local memberships or grants", async () => {
		const db = mocks.db;
		if (!db) throw new Error("Missing database");
		const tag = `sso-route-${Date.now()}`;
		const admin = await db.user.create({ data: { email: `${tag}@example.test`, displayName: tag, role: "Admin" } });
		const member = await db.user.create({ data: { email: `${tag}-member@example.test`, displayName: tag } });
		const group = await db.group.create({ data: { name: tag, ssoProvider: "route-provider", ssoGroupId: tag } });
		try {
			await db.groupMember.createMany({ data: [
				{ groupId: group.id, userId: member.id, source: "sso" },
				{ groupId: group.id, userId: admin.id, source: "local" },
			] });
			const storage = await db.functionStorage.create({ data: { name: tag, purpose: "test", user: admin.id } });
			await db.resourceShare.create({ data: { storageId: storage.id, groupId: group.id, permission: "view" } });
			mocks.adminId = admin.id;
			const response = await mocks.server.fetch(`/api/admin/groups/${group.id}`, {
				method: "PATCH", headers: { "content-type": "application/json", cookie: "shsf_session=admin" },
				body: JSON.stringify({ ssoProvider: null, ssoGroupId: null }),
			});
			expect(response.status).toBe(200);
			expect(await db.groupMember.findMany({ where: { groupId: group.id }, select: { userId: true, source: true } }))
				.toEqual([{ userId: admin.id, source: "local" }]);
			expect(await db.resourceShare.count({ where: { groupId: group.id } })).toBe(1);
			expect(await db.auditLog.findFirst({ where: { targetId: group.id, action: "group.member.remove" }, select: { details: true } }))
				.toEqual({ details: { source: "sso", count: 1, reason: "mapping changed" } });
		} finally {
			await db.group.delete({ where: { id: group.id } });
			await db.user.deleteMany({ where: { id: { in: [admin.id, member.id] } } });
			await db.auditLog.deleteMany({ where: { actorId: admin.id } });
		}
	});
});
