import { PrismaClient } from "@prisma/client";
import { Cors, Middleware, Server } from "rjweb-server";
import { Runtime } from "@rjweb/runtime-node";
import { network } from "@rjweb/utils";
import { env } from "process";
import { CronExpressionParser } from "cron-parser";
import { executeFunction } from "./lib/Runner";

export const URL = env.UI_URL!;
export const COOKIE = "shsf_session";
export const DOMAIN = env.DOMAIN!;
export const API_KEY_HEADER = "x-api-key";
export const prisma = new PrismaClient({
	log: ["info", "error", "warn"],
	errorFormat: "pretty",
	transactionOptions: { timeout: 30000, maxWait: 20000 },
});

export const server = new Server(
	Runtime,
	{
		port: parseInt(env.PORT!),
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
		compression: {
			http: {
				enabled: true,
			},
			ws: {
				enabled: true,
				maxSize: 1024 * 1024 * 10,
			},
		},
	},
	[
		Cors.use({
			allowAll: false,
			origins: [URL],
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
			credentials: true,
		}),
	]
);

export const fileRouter = new server.FileLoader("/")
	.load("./routes", { fileBasedRouting: false })
	.export();

server.notFound(async (ctr) => {
	return ctr.status(ctr.$status.NOT_FOUND).print({
		status: "FAILED",
		message: "The requested resource was not found",
	});
});

server.finish("httpRequest", async (ctr) => {
	console.log(
		`[SHSF API] ${ctr.client.ip} [${ctr.url.method}]➡️  ${ctr.url.href}`
	);
});

server
	.start()
	.then(async (port) => {
		await prisma.$connect();

		console.log(`[SHSF API] Running on ${port}`);

		setInterval(async () => {
			await processCrons();
		}, 1000); // Every second
	})
	.catch(console.error);

server.error("httpRequest", async (ctr, error) => {
	console.error(error);
	ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
		status: "ERROR",
		message: "An Unknown Server Error has occurred",
	});
});

// Crons
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
		const interval = CronExpressionParser.parse(cron.cron!, {
			currentDate: now,
		});

		try {
			// If nextRun is null, calculate and set it
			if (cron.nextRun === null) {
				const next = interval.next().toDate();
				await prisma.functionTrigger.update({
					where: { id: cron.id },
					data: { nextRun: next },
				});
				console.log(`Cron #${cron.id} nextRun set to ${next.toISOString()}`);
				continue; // Skip further processing for this iteration
			}

			const next = interval.next();

			// Adjusted logic to ensure the cron fires correctly
			if (next.getTime() <= now.getTime() + 1000) {
				await prisma.functionTrigger.update({
					where: { id: cron.id },
					data: {
						lastRun: now,
						nextRun: interval.next().toDate(), // Update nextRun to the following occurrence
					},
				});

				console.log(`[SHSF CRONS] Cron #${cron.id} executed`);
				const files = await prisma.functionFile.findMany({
					where: { functionId: cron.functionId },
				});

				await executeFunction(
					cron.functionId,
					cron.function,
					files,
					{
						enabled: false,
					},
					JSON.stringify({})
				);

				console.log(
					`[SHSF CRONS] Function for Cron #${cron.id} executed successfully.`
				);
			} else {
				const secondsUntilNextRun = Math.round(
					(next.getTime() - now.getTime()) / 1000
				);

				if (secondsUntilNextRun <= 12) {
					console.log(
						`[SHSF CRONS] Cron #${cron.id} will run in ${secondsUntilNextRun} seconds`
					);
				}
			}
		} catch (error) {
			console.error(
				`[SHSF CRONS] Error processing cron ${cron.name} (${cron.id}):`,
				error
			);
		}
	}
}
