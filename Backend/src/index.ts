import { PrismaClient } from "@prisma/client";
import { Cors, Middleware, Server } from "rjweb-server";
import { Runtime } from "@rjweb/runtime-node";
import { network } from "@rjweb/utils";
import { env } from "process";
import { createClient } from "redis";

export const WhereAreWe = env.WENV!;
export const URL = env.UI_URL!;
export const COOKIE=env.COOKIE!;
export const DOMAIN = env.DOMAIN!;
export const API_KEY_HEADER = env.API_KEY_HEADER!;
export const prisma = new PrismaClient({
	log: ["info", "error", "warn"],
	errorFormat: "pretty",
	transactionOptions: { timeout: 30000, maxWait: 20000 },
});

export const redis = createClient({
	url: env.REDIS_URL,
	disableOfflineQueue: false,
	pingInterval: 1000,
});

export const middleware = new Middleware<
	{},
	{
		allow: boolean;
		date: Date;
	}
>("MIDDLEMAN", "1.0.3")
	.load((config) => {
		console.log(`Primary Middle Ware loaded`);
	})
	.httpRequest(async (config, server, context, ctr, end) => {
		context.data(middleware).allow = true;
		context.data(middleware).date = new Date();
	})
	.httpRequestFinish(async (config, server, context, ctr, ms) => {
		const now = context.data(middleware).date;
		const formattedDate = `${now.getHours()}:${now.getMinutes()}:${
			now.getSeconds().toString().length === 1
				? "0" + now.getSeconds()
				: now.getSeconds()
		}`;

		console.log(
			`${formattedDate} : ${ctr.client.ip.usual()} (${ms.toFixed(3)}ms) --> (${
				ctr.url.method
			}) ${ctr.url.href}`
		);
	})
	.export()
	.use({});

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
		middleware,
		Cors.use({
			allowAll: false,
			origins: ["http://localhost:3000"],
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
			credentials: true
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

server
	.start()
	.then(async (port) => {
		await prisma.$connect();

		await redis
			.connect()
			.then(() => {
				console.log(`Redis connected to DB ${redis.options?.database}`);
			})
			.catch((err) => {
				console.error(err);
			});

		console.log(
			`Started a "${WhereAreWe}" Instance on port ${port}; https://${
				WhereAreWe === "dev" ? "dev." : WhereAreWe === "beta" ? "beta." : ""
			}betternews.app`
		);
	})
	.catch(console.error);

server
	.rateLimit("httpRequest", (ctr) => {
		return ctr.status(ctr.$status.TOO_MANY_REQUESTS).print({
			status: "FAILED",
			message: `This feature is on cooldown. Please retry after ${
				(ctr.getRateLimit()?.endsIn ?? 0) / 1000
			} seconds`,
			time_left: (ctr.getRateLimit()?.endsIn ?? 0) / 1000, // Time left in seconds
		});
	})
	.rateLimit("wsMessage", (ctr) => {
		return ctr.close(1008, "You are making too many requests! Slow down.");
	});

server.error("httpRequest", async (ctr, error) => {
	console.error(error);
	ctr
		.status(ctr.$status.INTERNAL_SERVER_ERROR)
		.print({ status: "ERROR", message: "An Unknown Server Error has occured" });
});
