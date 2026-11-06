import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
	session: { findFirst: vi.fn() },
	accessToken: { findFirst: vi.fn(), update: vi.fn() },
	guestUser: { findMany: vi.fn() },
	guestSession: { findFirst: vi.fn(), delete: vi.fn() },
}));
vi.mock("..", () => ({ prisma: db, REACT_APP_API_URL: "http://api.test", UI_URL: "http://ui.test" }));
vi.mock("../lib/DataManager", () => ({ getLinkStatus: vi.fn() }));

import { checkAuthentication, checkHttpExecutionPermission } from "../lib/Authentication";

describe("authentication boundaries", () => {
	beforeEach(() => vi.resetAllMocks());

	it("rejects missing and invalid credentials, without falling back from an invalid session to an API key", async () => {
		expect(await checkAuthentication(null, null)).toEqual({ success: false, method: "none", message: "No authentication data provided" });
		db.session.findFirst.mockResolvedValue(null);
		expect(await checkAuthentication("bad-session", "valid-key")).toEqual({ success: false, method: "none", message: "Invalid session" });
		expect(db.accessToken.findFirst).not.toHaveBeenCalled();
		db.accessToken.findFirst.mockResolvedValue(null);
		expect(await checkAuthentication(null, "bad-key")).toEqual({ success: false, method: "none", message: "Invalid API key" });
	});

	it("accepts a session and an unexpired API key, but marks an expired key and rejects it", async () => {
		const user = { id: 7 };
		const session = { hash: "session", user };
		const key = { id: 3, user, expired: false, expiresAt: new Date("2100-01-01") };
		db.session.findFirst.mockResolvedValue(session);
		db.accessToken.findFirst.mockResolvedValueOnce(key).mockResolvedValueOnce({ ...key, expiresAt: new Date("2000-01-01") });
		expect(await checkAuthentication("session", null)).toEqual({ success: true, method: "session", user, session });
		expect(await checkAuthentication(null, "key")).toEqual({ success: true, method: "apiKey", user, apiKey: key });
		expect(await checkAuthentication(null, "expired")).toEqual({ success: false, method: "none", message: "API key has expired" });
		expect(db.accessToken.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { expired: true } });
	});

	it("only permits an access key belonging to the function owner", async () => {
		const ctr = { headers: new Map([["x-access-key", "key"]]), cookies: new Map() };
		const func = { id: 1, userId: 7, guest_access: false, secure_header: null } as Parameters<typeof checkHttpExecutionPermission>[1];
		db.accessToken.findFirst.mockResolvedValueOnce({ user: { id: 8 }, expired: false }).mockResolvedValueOnce({ user: { id: 7 }, expired: false });
		expect(await checkHttpExecutionPermission(ctr, func, 2, "exec")).toEqual({ state: false, reason: "Provided Access Token, but does not own the function" });
		expect(await checkHttpExecutionPermission(ctr, func, 2, "exec")).toEqual({ state: true, reason: "Provided API Key and owns the function" });
	});
});
