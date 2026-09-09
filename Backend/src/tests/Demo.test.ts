import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
	prisma: {
		user: { findUnique: vi.fn() },
		$transaction: vi.fn(),
	},
}));

vi.mock("../lib/db", () => ({ prisma }));
vi.mock("bcrypt", () => ({ hash: vi.fn().mockResolvedValue("hashed-password") }));

import { DEMO_EMAIL, DEMO_PASSWORD, ensureDemoData } from "../lib/Demo";

describe("demo mode", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does nothing when demo mode is disabled", async () => {
		await expect(ensureDemoData(false)).resolves.toBeNull();
		expect(prisma.user.findUnique).not.toHaveBeenCalled();
	});

	it("does not overwrite an existing demo account", async () => {
		prisma.user.findUnique.mockResolvedValue({ id: 1 });
		await expect(ensureDemoData(true)).resolves.toBeNull();
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	it("creates the public admin, namespace, and runnable function", async () => {
		prisma.user.findUnique.mockResolvedValue(null);
		const tx = {
			user: { create: vi.fn().mockResolvedValue({ id: 7, email: DEMO_EMAIL }) },
			namespace: { create: vi.fn().mockResolvedValue({ id: 9 }) },
			function: { create: vi.fn().mockResolvedValue({ id: 11 }) },
		};
		prisma.$transaction.mockImplementation(async (callback) => callback(tx));

		await expect(ensureDemoData(true)).resolves.toMatchObject({ functions: 1, user: { id: 7 } });
		expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
			data: expect.objectContaining({ email: DEMO_EMAIL, password: "hashed-password", role: "Admin" }),
		}));
		expect(tx.namespace.create).toHaveBeenCalledWith({ data: { name: "Examples", userId: 7 } });
		expect(tx.function.create).toHaveBeenCalledWith(expect.objectContaining({
			data: expect.objectContaining({
				name: "Hello, SHSF",
				image: "python:3.12",
				startup_file: "main.py",
				userId: 7,
				namespaceId: 9,
			}),
		}));
		expect(DEMO_PASSWORD).toBe("demo-password");
	});
});
