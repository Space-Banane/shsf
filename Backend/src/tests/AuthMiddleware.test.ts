import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Server } from "rjweb-server";
import { createServer } from "node:net";
import { Runtime } from "@rjweb/runtime-node";
import { authResolutionMiddleware, authEnforcementMiddleware } from "../lib/middlewares/auth";

const mocks = vi.hoisted(() => ({
	db: {
		session: { findFirst: vi.fn() },
		accessToken: { findFirst: vi.fn(), update: vi.fn() },
	},
	server: undefined as unknown as Server<{ port: number; bind: string }>,
	info: vi.fn(),
}));

vi.mock("..", () => ({
	COOKIE: "shsf_session",
	API_KEY_HEADER: "x-access-key",
	get prisma() {
		return mocks.db;
	},
}));
vi.mock("../lib/DataManager", () => ({ getLinkStatus: vi.fn() }));
vi.mock("../lib/logger", () => ({
	createLogger: () => ({ info: mocks.info, warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

const user = { id: 7, role: "User", ssoIdentity: null };

beforeAll(async () => {
	const socket = createServer();
	await new Promise<void>((resolve) => socket.listen(0, "127.0.0.1", resolve));
	const address = socket.address();
	if (!address || typeof address === "string") throw new Error("Missing test port");
	await new Promise<void>((resolve, reject) => socket.close((error) => (error ? reject(error) : resolve())));

	const server = new Server(Runtime, { port: address.port, bind: "127.0.0.1" }, [
		authResolutionMiddleware.use({}),
		authEnforcementMiddleware.use({}),
	]);
	mocks.server = server as unknown as typeof mocks.server;

	// Reports the resolved state without touching the database itself.
	server.path("/", (path) =>
		path
			.http("GET", "/api/whoami", (route) =>
				route.onRequest((ctr) => {
					const auth = ctr.getAuth();
					return ctr.print({
						success: auth.success,
						method: auth.method,
						userId: auth.success ? auth.user.id : null,
						tokenProvided: auth.success ? true : auth.tokenProvided,
					});
				}),
			)
			.http("POST", "/exec/demo", (route) =>
				route.onRequest((ctr) => {
					const auth = ctr.getAuth();
					return ctr.print({ success: auth.success, method: auth.method });
				}),
			)
			.http("GET", "/assets/app.js", (route) =>
				route.onRequest((ctr) => {
					const auth = ctr.getAuth();
					return ctr.print({ success: auth.success, method: auth.method });
				}),
			),
	);
	await server.start();
});

afterAll(() => mocks.server.stop());
beforeEach(() => {
	vi.clearAllMocks();
	mocks.db.session.findFirst.mockResolvedValue(null);
	mocks.db.accessToken.findFirst.mockResolvedValue(null);
});

const request = (path: string, options: { method?: string; cookie?: string; apiKey?: string } = {}) =>
	mocks.server.fetch(path, {
		method: options.method ?? "GET",
		headers: {
			...(options.cookie ? { cookie: `shsf_session=${options.cookie}` } : {}),
			...(options.apiKey ? { "x-access-key": options.apiKey } : {}),
		},
	});

describe("auth resolution middleware", () => {
	it("resolves a session with exactly one database lookup", async () => {
		mocks.db.session.findFirst.mockResolvedValue({ hash: "session-hash", user });

		const response = await request("/api/whoami", { cookie: "session-hash" });

		expect(await response.json()).toEqual({ success: true, method: "session", userId: 7, tokenProvided: true });
		expect(mocks.db.session.findFirst).toHaveBeenCalledTimes(1);
		expect(mocks.db.accessToken.findFirst).not.toHaveBeenCalled();
	});

	it("resolves an API key without a session lookup", async () => {
		mocks.db.accessToken.findFirst.mockResolvedValue({ id: 3, token: "key", user, expired: false, expiresAt: null });

		const response = await request("/api/whoami", { apiKey: "key" });

		expect(await response.json()).toEqual({ success: true, method: "apiKey", userId: 7, tokenProvided: true });
		expect(mocks.db.session.findFirst).not.toHaveBeenCalled();
		expect(mocks.db.accessToken.findFirst).toHaveBeenCalledTimes(1);
	});

	it("keeps anonymous requests unauthenticated without a database lookup", async () => {
		const response = await request("/api/whoami");

		expect(await response.json()).toEqual({ success: false, method: "none", userId: null, tokenProvided: false });
		expect(mocks.db.session.findFirst).not.toHaveBeenCalled();
		expect(mocks.db.accessToken.findFirst).not.toHaveBeenCalled();
	});

	it("resolves credentials on function execution paths", async () => {
		mocks.db.session.findFirst.mockResolvedValue({ hash: "session-hash", user });

		const response = await request("/exec/demo", { method: "POST", cookie: "session-hash" });

		expect(await response.json()).toEqual({ success: true, method: "session" });
		expect(mocks.db.session.findFirst).toHaveBeenCalledTimes(1);
	});

	it("skips resolution and enforcement for static and UI paths", async () => {
		const response = await request("/assets/app.js", { cookie: "stale-session" });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: false, method: "none" });
		expect(mocks.db.session.findFirst).not.toHaveBeenCalled();
	});

	it("rejects a provided but invalid token on API paths", async () => {
		const response = await request("/api/whoami", { cookie: "stale-session" });

		expect(response.status).toBe(401);
		expect(mocks.db.session.findFirst).toHaveBeenCalledTimes(1);
	});
});
