import { CronExpressionParser } from "cron-parser";
import type { PrismaClient } from "@prisma/client";
import type { executeFunction as executeFunctionImpl } from "./Runner";
import type { performGitPull as performGitPullImpl } from "./GitOps";
import { createLogger } from "./logger";
import { getAutoUpdateEnabled } from "./DataManager";
import { checkForUpdate, applyUpdate, hasFailedAttempt } from "./Updater";
import { processLogAnalysisQueue } from "./LogAnalysis";
import { env } from "./env";

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
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const tick = async () => {
		if (stopped) return;
		try {
			await job.run();
		} catch (error) {
			systemCronLog.error({ err: error, job: job.name }, "System cron failed");
		}
		if (!stopped) {
			timer = setTimeout(() => void tick(), job.intervalMs);
		}
	};

	if (job.runOnStart) {
		void tick();
	} else {
		timer = setTimeout(() => void tick(), job.intervalMs);
	}

	return {
		stop: () => {
			stopped = true;
			if (timer !== null) clearTimeout(timer);
		},
	};
}

export function startSystemCrons(dependencies: SystemCronDependencies): SystemCronHandle {
	const jobs: ScheduledJob[] = [
		{
			name: "function-crons",
			// Overdue triggers are caught up on the next tick, so a slower poll
			// keeps the schedule accurate without scanning every second.
			intervalMs: 5000,
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
		{
			name: "retention-cleanup",
			intervalMs: 60 * 60 * 1000,
			runOnStart: true,
			run: () => processRetentionCleanup(dependencies),
		},
		{
			name: "log-analysis",
			intervalMs: 10 * 1000,
			run: () => processLogAnalysisQueue({
				prisma: dependencies.prisma,
				instanceKey: env.OPENROUTER_API_KEY,
				instanceSecret: env.INSTANCE_SECRET,
			}),
		},
		{
			name: "auto-update",
			intervalMs: 6 * 60 * 60 * 1000, // every 6 hours
			run: () => processAutoUpdate(),
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
					// Includes overdue triggers (nextRun in the past): a missed
					// tick or server downtime must not permanently kill a cron.
					nextRun: {
						lte: fiveMinutesFromNow,
					},
				},
				{
					nextRun: null,
				},
			],
			enabled: true,
		},
		// Only the fields the poller needs; the function row (including env
		// and secrets) is loaded at execution time instead of on every tick.
		select: {
			id: true,
			functionId: true,
			cron: true,
			data: true,
			nextRun: true,
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

			// Fire based on the stored schedule so overdue triggers run instead
			// of waiting for (or missing) the next parsed boundary.
			if (cron.nextRun.getTime() <= now.getTime() + 1000) {
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
				const functionData = await prisma.function.findUnique({
					where: { id: cron.functionId },
				});

				if (!functionData) {
					cronLog.warn({ cronId: cron.id, functionId: cron.functionId }, "Cron function not found");
					continue;
				}

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

				const capturedCronId = cron.id;
				void (async () => {
					let executionExitCode: number | null = null;
					try {
						const executionResult = await executeFunction(
							cron.functionId,
							functionData,
							files,
							{
								enabled: false,
							},
							JSON.stringify({
								ran_by: "cron",
								triggerId: capturedCronId,
								...cronExecutionData,
							}),
							{},
						);
						executionExitCode = executionResult?.exit_code ?? null;
					} catch (executionError) {
						cronLog.error({ err: executionError, cronId: capturedCronId }, "Function execution failed");
					}

					let lastRunSuccessful: boolean | null = executionExitCode === 0;
					if (executionExitCode === null) {
						lastRunSuccessful = null;
						cronLog.warn({ cronId: capturedCronId }, "Unknown exit code, marking run result as null");
					}

					await prisma.functionTrigger.update({
						where: { id: capturedCronId },
						data: {
							lastRunSuccessful,
						},
					});

					if (lastRunSuccessful) {
						cronLog.info({ cronId: capturedCronId }, "Cron function executed successfully");
					} else {
						cronLog.error({ cronId: capturedCronId, exitCode: executionExitCode ?? "unknown" }, "Cron function failed");
					}
				})();
			} else {
				const secondsUntilNextRun = Math.round(
					(cron.nextRun.getTime() - now.getTime()) / 1000,
				);

				if (secondsUntilNextRun <= 5) {
					cronLog.debug({ cronId: cron.id, secondsUntilNextRun }, "Cron firing soon");
				}
			}
		} catch (error) {
			cronLog.error({ err: error, cronId: cron.id }, "Error processing cron");
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
		select: { id: true, name: true, git_pull_interval: true, git_source_dir: true },
	});

	for (const fn of functions) {
		const intervalMs = (fn.git_pull_interval ?? 10) * 60 * 1000;
		const last = lastGitPullAt.get(fn.id) ?? 0;
		if (now - last < intervalMs) continue;

		lastGitPullAt.set(fn.id, now);
		try {
			const result = await performGitPull(fn.id, fn.git_source_dir);
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

	try {
		// Expired cache rows are only ever filtered out on read; without this
		// they accumulate in the table indefinitely.
		const expiredCache = await prisma.functionCache.deleteMany({
			where: {
				expiresAt: { lt: now },
			},
		});

		if (expiredCache.count > 0) {
			storageLog.info({ count: expiredCache.count }, "Expired function cache entries cleaned up");
		}
	} catch (error) {
		storageLog.error({ err: error }, "Error during function cache cleanup");
	}
}

const RETENTION_DAY_MS = 24 * 60 * 60 * 1000;
// Local (non-SSO) sessions have no expiresAt column; they are dead once their
// cookie has expired. Mirrors the 30-day cookie lifetime in the login route.
const LOCAL_SESSION_MAX_AGE_MS = 30 * RETENTION_DAY_MS;

const retentionLog = createLogger("RETENTION");

type RetentionTarget = {
	label: string;
	findBatch: (take: number) => Promise<number[]>;
	deleteBatch: (ids: number[]) => Promise<number>;
};

type RetentionOptions = {
	logDays?: number;
	auditDays?: number;
	batchSize?: number;
};

async function drainRetentionTarget(target: RetentionTarget, batchSize: number): Promise<number> {
	let deleted = 0;
	for (;;) {
		const ids = await target.findBatch(batchSize);
		if (ids.length === 0) break;

		const removed = await target.deleteBatch(ids);
		deleted += removed;
		// Stop on a short batch or if a full batch deleted nothing, so an
		// unexpected constraint cannot spin the loop forever.
		if (removed === 0 || ids.length < batchSize) break;
	}
	return deleted;
}

export async function processRetentionCleanup(
	{ prisma }: SystemCronDependencies,
	options: RetentionOptions = {},
) {
	const now = new Date();
	const logDays = options.logDays ?? env.RETENTION_LOG_DAYS;
	const auditDays = options.auditDays ?? env.RETENTION_AUDIT_DAYS;
	const batchSize = options.batchSize ?? env.RETENTION_BATCH_SIZE;
	const logCutoff = new Date(now.getTime() - logDays * RETENTION_DAY_MS);
	const auditCutoff = new Date(now.getTime() - auditDays * RETENTION_DAY_MS);
	const localSessionCutoff = new Date(now.getTime() - LOCAL_SESSION_MAX_AGE_MS);

	// Every target deletes by primary key in bounded batches so a large backlog
	// never turns into one long-running lock. Deleting a TriggerLog cascades to
	// its LogAnalysis row, so this one pass bounds both tables.
	const targets: RetentionTarget[] = [];

	if (logDays > 0) {
		targets.push({
			label: "execution logs",
			findBatch: async (take) =>
				(
					await prisma.triggerLog.findMany({
						where: { createdAt: { lt: logCutoff } },
						select: { id: true },
						orderBy: { createdAt: "asc" },
						take,
					})
				).map((row) => row.id),
			deleteBatch: async (ids) =>
				(await prisma.triggerLog.deleteMany({ where: { id: { in: ids } } })).count,
		});
	}

	targets.push(
		{
			label: "expired sessions",
			findBatch: async (take) =>
				(
					await prisma.session.findMany({
						where: { expiresAt: { lt: now } },
						select: { id: true },
						orderBy: { expiresAt: "asc" },
						take,
					})
				).map((row) => row.id),
			deleteBatch: async (ids) =>
				(await prisma.session.deleteMany({ where: { id: { in: ids } } })).count,
		},
		{
			label: "abandoned local sessions",
			findBatch: async (take) =>
				(
					await prisma.session.findMany({
						where: { expiresAt: null, createdAt: { lt: localSessionCutoff } },
						select: { id: true },
						orderBy: { createdAt: "asc" },
						take,
					})
				).map((row) => row.id),
			deleteBatch: async (ids) =>
				(await prisma.session.deleteMany({ where: { id: { in: ids } } })).count,
		},
		{
			label: "expired guest sessions",
			findBatch: async (take) =>
				(
					await prisma.guestSession.findMany({
						where: { expiresAt: { lt: now } },
						select: { id: true },
						orderBy: { expiresAt: "asc" },
						take,
					})
				).map((row) => row.id),
			deleteBatch: async (ids) =>
				(await prisma.guestSession.deleteMany({ where: { id: { in: ids } } })).count,
		},
	);

	if (auditDays > 0) {
		targets.push({
			label: "audit log rows",
			findBatch: async (take) =>
				(
					await prisma.auditLog.findMany({
						where: { createdAt: { lt: auditCutoff } },
						select: { id: true },
						orderBy: { createdAt: "asc" },
						take,
					})
				).map((row) => row.id),
			deleteBatch: async (ids) =>
				(await prisma.auditLog.deleteMany({ where: { id: { in: ids } } })).count,
		});
	}

	for (const target of targets) {
		try {
			const deleted = await drainRetentionTarget(target, batchSize);
			if (deleted > 0) {
				retentionLog.info({ target: target.label, deleted }, "Retention cleanup removed rows");
			}
		} catch (error) {
			retentionLog.error({ err: error, target: target.label }, "Error during retention cleanup");
		}
	}
}

const updateLog = createLogger("AUTO_UPDATE");

export async function processAutoUpdate() {
	const enabled = await getAutoUpdateEnabled();
	if (!enabled) return;

	updateLog.info("Running scheduled update check");
	try {
		const result = await checkForUpdate();
		if (!result.updateAvailable || !result.newImageId) {
			updateLog.info("No update available");
		} else if (await hasFailedAttempt(result.newImageId)) {
			// Without this, a release that always fails its readiness checks would be retried every 6 hours.
			updateLog.warn({ newImageId: result.newImageId }, "Skipping auto-update: this image already failed and was rolled back");
		} else {
			updateLog.info({ newImageId: result.newImageId }, "Update available — applying automatically");
			await applyUpdate("auto");
		}
	} catch (err) {
		updateLog.error({ err }, "Scheduled update check/apply failed");
	}
}
