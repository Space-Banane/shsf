import { CronExpressionParser } from "cron-parser";
import type { PrismaClient } from "@prisma/client";
import type { executeFunction as executeFunctionImpl } from "./Runner";
import type { performGitPull as performGitPullImpl } from "./GitOps";
import { createLogger } from "./logger";

type ExecuteFunction = typeof executeFunctionImpl;
type PerformGitPull = typeof performGitPullImpl;

type SystemCronDependencies = {
	prisma: PrismaClient;
	executeFunction: ExecuteFunction;
	performGitPull: PerformGitPull;
};

type ScheduledJob = {
	name: string;
	intervalMs: number;
	runOnStart?: boolean;
	run: () => Promise<void>;
};

type SystemCronHandle = {
	stop: () => void;
};

const cronLog = createLogger("CRONS");
const gitLog = createLogger("GIT");
const storageLog = createLogger("STORAGE");
const systemCronLog = createLogger("SYSTEM_CRONS");

const lastGitPullAt = new Map<number, number>();

function scheduleJob(job: ScheduledJob): SystemCronHandle {
	let running = false;

	const tick = async () => {
		if (running) {
			systemCronLog.warn({ job: job.name }, "Skipping overlapping system cron run");
			return;
		}

		running = true;
		try {
			await job.run();
		} catch (error) {
			systemCronLog.error({ err: error, job: job.name }, "System cron failed");
		} finally {
			running = false;
		}
	};

	const interval = setInterval(() => {
		void tick();
	}, job.intervalMs);

	if (job.runOnStart) {
		void tick();
	}

	return {
		stop: () => clearInterval(interval),
	};
}

export function startSystemCrons(dependencies: SystemCronDependencies): SystemCronHandle {
	const jobs: ScheduledJob[] = [
		{
			name: "function-crons",
			intervalMs: 1000,
			runOnStart: true,
			run: () => processCrons(dependencies),
		},
		{
			name: "git-pulls",
			intervalMs: 60 * 1000,
			run: () => processGitPulls(dependencies),
		},
		{
			name: "storage-cleanup",
			intervalMs: 60 * 1000,
			run: () => processStorageCleanup(dependencies),
		},
	];

	const handles = jobs.map(scheduleJob);
	return {
		stop: () => {
			for (const handle of handles) {
				handle.stop();
			}
		},
	};
}

export async function processCrons({ prisma, executeFunction }: SystemCronDependencies) {
	const now = new Date();
	const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

	const crons = await prisma.functionTrigger.findMany({
		where: {
			OR: [
				{
					nextRun: {
						gte: now,
						lte: fiveMinutesFromNow,
					},
				},
				{
					nextRun: null,
				},
			],
			enabled: true,
		},
		include: {
			function: true,
		},
	});

	for (const cron of crons) {
		let interval;
		try {
			interval = CronExpressionParser.parse(cron.cron!, {
				currentDate: now,
			});
		} catch {
			cronLog.error({ cronId: cron.id }, "Invalid cron expression, disabling");

			await prisma.functionTrigger.update({
				where: { id: cron.id },
				data: {
					enabled: false,
					cron: "0 0 * * *",
				},
			});

			continue;
		}

		try {
			if (cron.nextRun === null) {
				const next = interval.next().toDate();
				await prisma.functionTrigger.update({
					where: { id: cron.id },
					data: { nextRun: next },
				});
				cronLog.debug({ cronId: cron.id, nextRun: next.toISOString() }, "Cron nextRun initialized");
				continue;
			}

			const next = interval.next();

			if (next.getTime() <= now.getTime() + 1000) {
				const followingRun = interval.next().toDate();

				await prisma.functionTrigger.update({
					where: { id: cron.id },
					data: {
						lastRun: now,
						nextRun: followingRun,
						lastRunSuccessful: null,
					},
				});

				cronLog.info({ cronId: cron.id }, "Cron executed");
				const files = await prisma.functionFile.findMany({
					where: { functionId: cron.functionId },
				});

				let cronExecutionData = {};

				if (cron.data) {
					try {
						cronExecutionData = JSON.parse(cron.data as string);
					} catch (err) {
						cronLog.error({ err, cronId: cron.id }, "Failed to parse cron data");
					}
				}

				let executionExitCode: number | null = null;
				try {
					const executionResult = await executeFunction(
						cron.functionId,
						cron.function,
						files,
						{
							enabled: false,
						},
						JSON.stringify({
							ran_by: "cron",
							triggerId: cron.id,
							...cronExecutionData,
						}),
						{ mode: "cron_execute" },
					);
					executionExitCode = executionResult?.exit_code ?? null;
				} catch (executionError) {
					cronLog.error({ err: executionError, cronId: cron.id }, "Function execution failed");
				}

				let lastRunSuccessful: boolean | null = executionExitCode === 0;
				if (executionExitCode === null) {
					lastRunSuccessful = null;
					cronLog.warn({ cronId: cron.id }, "Unknown exit code, marking run result as null");
				}

				await prisma.functionTrigger.update({
					where: { id: cron.id },
					data: {
						lastRunSuccessful,
					},
				});

				if (lastRunSuccessful) {
					cronLog.info({ cronId: cron.id }, "Cron function executed successfully");
				} else {
					cronLog.error({ cronId: cron.id, exitCode: executionExitCode ?? "unknown" }, "Cron function failed");
				}
			} else {
				const secondsUntilNextRun = Math.round(
					(next.getTime() - now.getTime()) / 1000,
				);

				if (secondsUntilNextRun <= 5) {
					cronLog.debug({ cronId: cron.id, secondsUntilNextRun }, "Cron firing soon");
				}
			}
		} catch (error) {
			cronLog.error({ err: error, cronId: cron.id, cronName: cron.name }, "Error processing cron");
		}
	}
}

export async function processGitPulls({ prisma, performGitPull }: SystemCronDependencies) {
	const now = Date.now();
	const functions = await prisma.function.findMany({
		where: {
			git_periodic_pull: true,
			git_url: { not: null },
		},
		select: { id: true, name: true, git_pull_interval: true },
	});

	for (const fn of functions) {
		const intervalMs = (fn.git_pull_interval ?? 10) * 60 * 1000;
		const last = lastGitPullAt.get(fn.id) ?? 0;
		if (now - last < intervalMs) continue;

		lastGitPullAt.set(fn.id, now);
		try {
			const result = await performGitPull(fn.id);
			if (result.success) {
				gitLog.info({ funcId: fn.id, funcName: fn.name }, "Git pull successful");
			} else {
				gitLog.error({ funcId: fn.id, funcName: fn.name, logs: result.logs }, "Git pull failed");
			}
		} catch (err) {
			gitLog.error({ err, funcId: fn.id }, "Unexpected error during git pull");
		}
	}
}

export async function processStorageCleanup({ prisma }: SystemCronDependencies) {
	const now = new Date();
	try {
		const expiredCount = await prisma.functionStorageItem.deleteMany({
			where: {
				expiresAt: {
					not: null,
					lt: now,
				},
			},
		});

		if (expiredCount.count > 0) {
			storageLog.info({ count: expiredCount.count }, "Expired storage items cleaned up");
		}
	} catch (error) {
		storageLog.error({ err: error }, "Error during storage cleanup");
	}
}
