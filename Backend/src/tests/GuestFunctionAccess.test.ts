import { describe, expect, it } from "vitest";
import { isFunctionOwnedByUser } from "../lib/GuestFunctionAccess";

describe("isFunctionOwnedByUser", () => {
	it("accepts a function owned by the authenticated user", () => {
		expect(isFunctionOwnedByUser({ id: 1, userId: 7 }, 7)).toBe(true);
	});

	it("rejects a missing function", () => {
		expect(isFunctionOwnedByUser(null, 7)).toBe(false);
	});

	it("rejects a function owned by another user", () => {
		expect(isFunctionOwnedByUser({ id: 1, userId: 8 }, 7)).toBe(false);
	});
});
