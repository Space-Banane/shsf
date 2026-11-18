import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ function: { findFirst: vi.fn() } }));
vi.mock("..", () => ({ prisma: db }));

import { createCallFuncExecutor, resolveCallTarget } from "../lib/RunnerInvocation";

type CallTarget = NonNullable<Awaited<ReturnType<typeof resolveCallTarget>>>;
type Executor = Parameters<typeof createCallFuncExecutor>[1];

const target = { id: 5, userId: 8, files: [{ id: 50 }] } as unknown as CallTarget;

describe("callF ownership boundary", () => {
	beforeEach(() => vi.clearAllMocks());

	it("scopes the target lookup to the caller's owner", async () => {
		db.function.findFirst.mockResolvedValue(target);

		await resolveCallTarget("worker", 7);

		expect(db.function.findFirst).toHaveBeenCalledWith({
			where: { name: "worker", userId: 7 },
			include: { files: true },
		});
	});

	it("does not resolve a function owned by another user", async () => {
		db.function.findFirst.mockImplementation(
			async ({ where }: { where: { userId: number } }) =>
				where.userId === 8 ? target : null,
		);

		await expect(resolveCallTarget("worker", 7)).resolves.toBeNull();
	});

	it("reports not-found and never executes another owner's function", async () => {
		db.function.findFirst.mockImplementation(
			async ({ where }: { where: { userId: number } }) =>
				where.userId === 8 ? target : null,
		);
		const execute = vi.fn();

		const call = createCallFuncExecutor(
			{ id: 42, userId: 7 },
			execute as unknown as Executor,
		);

		await expect(call("worker", { key: "value" })).rejects.toThrow(
			'Function "worker" not found',
		);
		expect(execute).not.toHaveBeenCalled();
	});

	it("executes an owned target with ran_by set to the caller id", async () => {
		db.function.findFirst.mockResolvedValue(target);
		const execute = vi
			.fn()
			.mockResolvedValue({ exit_code: 0, result: { ok: true } });

		const call = createCallFuncExecutor(
			{ id: 42, userId: 7 },
			execute as unknown as Executor,
		);

		await expect(call("worker", { key: "value" })).resolves.toEqual({
			ok: true,
		});
		expect(execute).toHaveBeenCalledTimes(1);
		const [id, functionData, files, stream, payload] = execute.mock.calls[0];
		expect(id).toBe(5);
		expect(functionData).toBe(target);
		expect(files).toBe(target.files);
		expect(stream).toEqual({ enabled: false });
		expect(JSON.parse(payload)).toEqual({
			ran_by: "func_42",
			body: { key: "value" },
		});
	});

	it("surfaces a non-zero target exit as a failed call", async () => {
		db.function.findFirst.mockResolvedValue(target);
		const execute = vi.fn().mockResolvedValue({ exit_code: 3 });

		const call = createCallFuncExecutor(
			{ id: 42, userId: 7 },
			execute as unknown as Executor,
		);

		await expect(call("worker", {})).rejects.toThrow(
			'Function "worker" exited with code 3',
		);
	});
});
