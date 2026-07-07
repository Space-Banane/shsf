import { env } from "./lib/env"; // must be first — loads dotenv and validates
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Server } from "rjweb-server";
import { Runtime } from "@rjweb/runtime-node";
import { network } from "@rjweb/utils";
import { CronExpressionParser } from "cron-parser";
import { executeFunction } from "./lib/Runner";
import { performGitPull } from "./lib/GitOps";
import { getUUID, prevDirectory } from "./lib/DataManager";
import { join } from "path";
import { logger, createLogger } from "./lib/logger";
import { corsMiddleware, initCorsDomains } from "./lib/middlewares/cors";
import { mainMiddleware } from "./lib/middlewares/main";
import { authResolutionMiddleware, authEnforcementMiddleware } from "./lib/middlewares/auth";
import { makeResponse } from "./lib/response";
import { ERROR_MESSAGES } from "./lib/errors";

export const VERSION: {
	type: "SHSF API" | "SHSF UI";
	major: number;
	minor: number;
	patch: number;
	toString: () => string;
} = {
	type: "SHSF API",
	major: 2,
	minor: 0,
	patch: 0,
	toString() {
		return `${this.major}.${this.minor}.${this.patch}`;
	},
};
export const URL = env.UI_URL;
export const UI_URL = env.UI_URL;
export const REACT_APP_API_URL = env.REACT_APP_API_URL;
export const COOKIE = "shsf_session";
export const DOMAIN = env.DOMAIN;
export const API_KEY_HEADER = "x-access-key";
export const INSTANCE_SECRET = env.INSTANCE_SECRET;
export const API_URL = env.REACT_APP_API_URL;

const _adapter = new PrismaMariaDb(env.DATABASE_URL);
export const prisma = new PrismaClient({
	adapter: _adapter,
	log: ["info", "error", "warn"],
	errorFormat: "pretty",
	transactionOptions: { timeout: 30000, maxWait: 20000 },
});

const CORS_DOMAINS = env.CORS_URLS.split(",");
CORS_DOMAINS.push(URL);
CORS_DOMAINS.push(REACT_APP_API_URL.replace(/\/+$/, ""));
CORS_DOMAINS.push(API_URL);

initCorsDomains(CORS_DOMAINS);

if (env.NODE_ENV !== "test") {
	logger.debug({ corsDomains: CORS_DOMAINS }, "CORS domains loaded");
	logger.info(`Reachable on ${env.PORT}; For example: ${env.REACT_APP_API_URL}`);
}

const dataPath = join(prevDirectory, ".data");
if (env.NODE_ENV !== "test") {
	logger.debug(`DataManager: Using data directory at ${dataPath}`);
}

export const server = new Server(
	Runtime,
	{
		port: env.PORT,
		bind: "0.0.0.0",
		version: false,
		performance: { lastModified: false, eTag: false },
		logging: { warn: true, debug: false, error: true },
		proxy: {
			enabled: true,
			credentials: {
				authenticate: false,
			},
			ips: {
				validate: true,
				list: [new network.Subnet("192.168.32.0/24")],
			},
		},
	},
	[
		corsMiddleware.use({}),
		mainMiddleware.use({}),
		authResolutionMiddleware.use({}),
		authEnforcementMiddleware.use({}),
	],
);

const loader = new server.FileLoader("/");
if (env.NODE_ENV !== "test") {
	loader.load("./routes", { fileBasedRouting: false });
}
export const fileRouter = loader.export();

server.notFound(async (ctr) => {
	return makeResponse({ ctr, content: { code: ERROR_MESSAGES.NOT_FOUND.code, message: ERROR_MESSAGES.NOT_FOUND.message } });
});

server.error("httpRequest", async (ctr, error) => {
	logger.error(error, "Unhandled HTTP request error");
	return makeResponse({ ctr, content: { code: ERROR_MESSAGES.INTERNAL_SERVER_ERROR.code } });
});

if (env.NODE_ENV !== "test") {
	server
		.start()
		.then(async (port) => {
			await prisma.$connect();
			const uuid = await getUUID();

			logger.info({ port, uuid }, "SHSF API running");

			setInterval(async () => {
				await processCrons();
			}, 1000);

			setInterval(async () => {
				await processGitPulls();
			}, 60 * 1000);

			setInterval(async () => {
				await processStorageCleanup();
			}, 60 * 1000);
		})
		.catch((err) => logger.error(err, "Server failed to start"));
}

const cronLog = createLogger("CRONS");
const gitLog = createLogger("GIT");
const storageLog = createLogger("STORAGE");

async function processCrons() {
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

const lastGitPullAt = new Map<number, number>();
async function processGitPulls() {
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

async function processStorageCleanup() {
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
