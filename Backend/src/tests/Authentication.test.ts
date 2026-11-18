import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
	session: { findFirst: vi.fn() },
	accessToken: { findFirst: vi.fn(), update: vi.fn() },
	function: { findFirst: vi.fn() },
	guestUser: { findMany: vi.fn() },
	guestSession: { findFirst: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("..", () => ({
	prisma: db,
	REACT_APP_API_URL: "http://api.test",
	UI_URL: "http://ui.test",
	INSTANCE_SECRET: "instance-secret",
}));
vi.mock("../lib/DataManager", () => ({ getLinkStatus: vi.fn() }));

import { checkAuthentication, checkHttpExecutionPermission, GlobalAuthCheck } from "../lib/Authentication";
import { getLinkStatus } from "../lib/DataManager";

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

	it("only permits an access key belonging to the function owner or a recipient with execute access", async () => {
		const ctr = { headers: new Map([["x-access-key", "key"]]), cookies: new Map() };
		const func = { id: 1, userId: 7, guest_access: false, secure_header: null } as Parameters<typeof checkHttpExecutionPermission>[1];
		db.function.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1 });
		db.accessToken.findFirst
			.mockResolvedValueOnce({ user: { id: 8 }, expired: false })
			.mockResolvedValueOnce({ user: { id: 7 }, expired: false })
			.mockResolvedValueOnce({ user: { id: 9 }, expired: false });
		expect(await checkHttpExecutionPermission(ctr, func, 2, "exec")).toEqual({ state: false, reason: "Provided Access Token, but does not own the function" });
		expect(await checkHttpExecutionPermission(ctr, func, 2, "exec")).toEqual({ state: true, reason: "Provided API Key and owns the function" });
		expect(await checkHttpExecutionPermission(ctr, func, 2, "exec")).toEqual({ state: true, reason: "Provided API Key with shared execute access" });
		expect(db.function.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 1 }) }));
	});
});

describe("GlobalAuthCheck", () => {
	beforeEach(() => vi.resetAllMocks());

	it("rejects a missing secret", async () => {
		expect(await GlobalAuthCheck(null)).toEqual({ success: false, message: "No secret provided." });
		expect(getLinkStatus).not.toHaveBeenCalled();
	});

	it("rejects a wrong secret without consulting the link state", async () => {
		expect(await GlobalAuthCheck("wrong-secret")).toEqual({ success: false, message: "Invalid instance secret." });
		expect(getLinkStatus).not.toHaveBeenCalled();
	});

	it("rejects the instance secret when this instance is not linked", async () => {
		vi.mocked(getLinkStatus).mockResolvedValue({ linked: false });
		expect(await GlobalAuthCheck("instance-secret")).toEqual({ success: false, message: "This instance is not linked." });
	});

	it("accepts the instance secret for a linked instance", async () => {
		vi.mocked(getLinkStatus).mockResolvedValue({ linked: true, global_user_email: "owner@example.test" });
		expect(await GlobalAuthCheck("instance-secret")).toEqual({ success: true, linked_email: "owner@example.test" });
	});
});

describe("guest access boundary", () => {
	const func = {
		id: 1,
		userId: 7,
		namespaceId: 2,
		executionId: "exec",
		guest_access: true,
		secure_header: null,
	} as Parameters<typeof checkHttpExecutionPermission>[1];

	const guestCookie = (ctr: { cookies: Map<string, unknown> }) =>
		ctr.cookies.get("shsf_guest_2_exec") as { expires?: Date };

	const ctr = () => ({
		headers: new Map<string, string>(),
		cookies: new Map<string, unknown>(),
	});

	beforeEach(() => {
		vi.resetAllMocks();
		db.guestUser.findMany.mockResolvedValue([]);
	});

	it("requires a guest cookie and sends the visitor to guest authentication", async () => {
		const context = ctr();

		const result = await checkHttpExecutionPermission(context, func, 2, "exec");

		expect(result).toEqual({
			state: false,
			reason: "Missing guest cookie",
			redirect: "http://ui.test/guest-access?nsp=2&func=exec",
		});
	});

	it("permits a listed guest user with an unexpired session", async () => {
		db.guestUser.findMany.mockResolvedValue([{ id: 11 }]);
		db.guestSession.findFirst.mockResolvedValue({
			id: 21,
			expiresAt: new Date(Date.now() + 60_000),
			guestUser: { id: 11 },
		});
		const context = ctr();
		context.cookies.set("shsf_guest_2_exec", "guest-hash");

		expect(await checkHttpExecutionPermission(context, func, 2, "exec")).toEqual({
			state: true,
			reason: "Valid guest cookie",
		});
		expect(db.guestUser.findMany).toHaveBeenCalledWith({
			where: {
				permittedFunctions: { array_contains: [1] },
				guestOwnerId: 7,
			},
		});
	});

	it("denies a guest user who is not permitted for this function and clears the cookie", async () => {
		db.guestUser.findMany.mockResolvedValue([{ id: 11 }]);
		db.guestSession.findFirst.mockResolvedValue({
			id: 21,
			expiresAt: new Date(Date.now() + 60_000),
			guestUser: { id: 12 },
		});
		const context = ctr();
		context.cookies.set("shsf_guest_2_exec", "guest-hash");

		const result = await checkHttpExecutionPermission(context, func, 2, "exec");

		expect(result.state).toBe(false);
		expect(result.reason).toContain("does not have permission");
		expect(result.redirect).toBe("http://api.test/api/exec/2/exec");
		expect(guestCookie(context).expires!.getTime()).toBeLessThanOrEqual(Date.now());
	});

	it("deletes an expired guest session and clears the cookie", async () => {
		db.guestUser.findMany.mockResolvedValue([{ id: 11 }]);
		db.guestSession.findFirst.mockResolvedValue({
			id: 21,
			expiresAt: new Date(Date.now() - 1_000),
			guestUser: { id: 11 },
		});
		const context = ctr();
		context.cookies.set("shsf_guest_2_exec", "guest-hash");

		const result = await checkHttpExecutionPermission(context, func, 2, "exec");

		expect(result).toEqual({ state: false, reason: "Guest session has expired", redirect: undefined });
		expect(db.guestSession.deleteMany).toHaveBeenCalledWith({ where: { id: 21 } });
		expect(guestCookie(context).expires!.getTime()).toBeLessThanOrEqual(Date.now());
	});

	it("clears a cookie whose session no longer exists", async () => {
		db.guestSession.findFirst.mockResolvedValue(null);
		const context = ctr();
		context.cookies.set("shsf_guest_2_exec", "stale-hash");

		const result = await checkHttpExecutionPermission(context, func, 2, "exec");

		expect(result).toEqual({ state: false, reason: "Invalid guest cookie" });
		expect(guestCookie(context).expires!.getTime()).toBeLessThanOrEqual(Date.now());
	});

	it("ignores guest cookies when the function does not allow guest access", async () => {
		db.guestUser.findMany.mockResolvedValue([{ id: 11 }]);
		const context = ctr();
		context.cookies.set("shsf_guest_2_exec", "guest-hash");

		expect(
			await checkHttpExecutionPermission(context, { ...func, guest_access: false }, 2, "exec"),
		).toEqual({ state: true, reason: "" });
		expect(db.guestUser.findMany).not.toHaveBeenCalled();
	});
});
