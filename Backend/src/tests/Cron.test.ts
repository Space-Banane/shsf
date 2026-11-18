import { describe, it, expect, vi, afterEach } from "vitest";
import { validateCronExpression } from "../lib/Cron";
import { processCrons, processGitPulls, startSystemCrons } from "../lib/SystemCrons";

describe("validateCronExpression", () => {
    it("returns true for a valid cron expression", async () => {
        const result = await validateCronExpression("0 0 * * *");
        expect(result).toBe(true);
    });

    it("returns false for an invalid cron expression", async () => {
        const result = await validateCronExpression("invalid-cron");
        expect(result).toBe(false);
    });
});

describe("processCrons", () => {
	const buildDependencies = (
		trigger: Record<string, unknown>,
		functionRow: Record<string, unknown> | null = { id: 7 },
	) => {
		const update = vi.fn().mockResolvedValue({});
		const executeFunction = vi
			.fn()
			.mockResolvedValue({ exit_code: 0, logs: "", result: null, tooks: [] });
		const findMany = vi.fn().mockResolvedValue([trigger]);
		const findUnique = vi.fn().mockResolvedValue(functionRow);
		const prisma = {
			functionTrigger: {
				findMany,
				update,
			},
			function: {
				findUnique,
			},
			functionFile: {
				findMany: vi.fn().mockResolvedValue([]),
			},
		};
		const dependencies: Parameters<typeof processCrons>[0] = {
			prisma: prisma as unknown as Parameters<typeof processCrons>[0]["prisma"],
			executeFunction:
				executeFunction as unknown as Parameters<typeof processCrons>[0]["executeFunction"],
			performGitPull: vi.fn() as unknown as Parameters<
				typeof processCrons
			>[0]["performGitPull"],
		};
		return { dependencies, update, executeFunction, findMany, findUnique };
	};

	it("fires overdue triggers instead of dropping them", async () => {
		const overdue = {
			id: 42,
			functionId: 7,
			name: "overdue-cron",
			cron: "*/5 * * * *",
			enabled: true,
			nextRun: new Date(Date.now() - 60 * 60 * 1000), // missed an hour ago
			data: null,
		};
		const { dependencies, update, executeFunction, findUnique } =
			buildDependencies(overdue);

		await processCrons(dependencies);
		// the execution itself runs detached; wait for the microtask queue
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(findUnique).toHaveBeenCalledWith({ where: { id: 7 } });
		expect(executeFunction).toHaveBeenCalledTimes(1);
		expect(executeFunction.mock.calls[0][1]).toEqual({ id: 7 });
		const rescheduleCall = update.mock.calls.find(
			(call) => call[0]?.data?.nextRun instanceof Date,
		);
		expect(rescheduleCall).toBeDefined();
		expect(rescheduleCall![0].data.nextRun.getTime()).toBeGreaterThan(Date.now());
	});

	it("polls only the fields needed to decide what to run", async () => {
		const overdue = {
			id: 44,
			functionId: 7,
			cron: "*/5 * * * *",
			enabled: true,
			nextRun: new Date(Date.now() - 60 * 60 * 1000),
			data: null,
		};
		const { dependencies, findMany } = buildDependencies(overdue);

		await processCrons(dependencies);

		const query = findMany.mock.calls[0][0];
		expect(query.select).toEqual({
			id: true,
			functionId: true,
			cron: true,
			data: true,
			nextRun: true,
		});
		expect(query.include).toBeUndefined();
	});

	it("skips execution when the function no longer exists", async () => {
		const overdue = {
			id: 45,
			functionId: 8,
			cron: "*/5 * * * *",
			enabled: true,
			nextRun: new Date(Date.now() - 60 * 60 * 1000),
			data: null,
		};
		const { dependencies, executeFunction } = buildDependencies(overdue, null);

		await processCrons(dependencies);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(executeFunction).not.toHaveBeenCalled();
	});

	it("initializes nextRun without executing when it is null", async () => {
		const fresh = {
			id: 43,
			functionId: 7,
			name: "fresh-cron",
			cron: "*/5 * * * *",
			enabled: true,
			nextRun: null,
			data: null,
		};
		const { dependencies, update, executeFunction } = buildDependencies(fresh);

		await processCrons(dependencies);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(executeFunction).not.toHaveBeenCalled();
		expect(update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 43 },
				data: { nextRun: expect.any(Date) },
			}),
		);
	});
});

describe("startSystemCrons", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("polls function crons no more than once every five seconds", async () => {
		vi.useFakeTimers();
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		const prisma = {
			functionTrigger: { findMany: vi.fn().mockResolvedValue([]) },
		};
		const dependencies: Parameters<typeof startSystemCrons>[0] = {
			prisma: prisma as unknown as Parameters<typeof startSystemCrons>[0]["prisma"],
			executeFunction: vi.fn() as unknown as Parameters<
				typeof startSystemCrons
			>[0]["executeFunction"],
			performGitPull: vi.fn() as unknown as Parameters<
				typeof startSystemCrons
			>[0]["performGitPull"],
		};

		const handle = startSystemCrons(dependencies);
		// Flush the immediate first tick so it schedules its next poll.
		await vi.advanceTimersByTimeAsync(0);

		const scheduledDelays = setTimeoutSpy.mock.calls.map((call) => call[1]);
		expect(scheduledDelays).toContain(5000);
		expect(scheduledDelays).not.toContain(1000);

		handle.stop();
	});
});

describe("processGitPulls", () => {
	it("passes configured git source directories to scheduled pulls", async () => {
		const performGitPull = vi.fn().mockResolvedValue({ success: true, logs: "" });
		const prisma = {
			function: {
				findMany: vi.fn().mockResolvedValue([
					{
						id: 910001,
						name: "source-dir-fn",
						git_pull_interval: 10,
						git_source_dir: "functions/api",
					},
				]),
			},
		};

		const dependencies: Parameters<typeof processGitPulls>[0] = {
			prisma: prisma as unknown as Parameters<typeof processGitPulls>[0]["prisma"],
			executeFunction: vi.fn() as unknown as Parameters<typeof processGitPulls>[0]["executeFunction"],
			performGitPull: performGitPull as unknown as Parameters<typeof processGitPulls>[0]["performGitPull"],
		};

		await processGitPulls(dependencies);

		expect(performGitPull).toHaveBeenCalledWith(910001, "functions/api");
	});
});
