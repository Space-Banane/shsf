import { env } from "./lib/env"; // must be first — loads dotenv and validates
import { Server } from "rjweb-server";
import { Runtime } from "@rjweb/runtime-node";
import { network } from "@rjweb/utils";
import { existsSync } from "node:fs";
import { executeFunction } from "./lib/Runner";
import { performGitPull } from "./lib/GitOps";
import { getUUID } from "./lib/DataManager";
import { prisma } from "./lib/db";
import { join } from "path";
import { logger } from "./lib/logger";
import { corsMiddleware, initCorsDomains } from "./lib/middlewares/cors";
import { mainMiddleware } from "./lib/middlewares/main";
import { authResolutionMiddleware, authEnforcementMiddleware } from "./lib/middlewares/auth";
import { executionMiddleware } from "./lib/middlewares/execution";
import { makeResponse } from "./lib/response";
import { ERROR_MESSAGES } from "./lib/errors";
import { startSystemCrons } from "./lib/SystemCrons";
import { reconcileUpdateState } from "./lib/Updater";
import { getUpdateLastCheck } from "./lib/DataManager";

export const VERSION: {
	type: "SHSF API" | "SHSF UI";
	major: number;
	minor: number;
	patch: number;
	toString: () => string;
} = {
	type: "SHSF API",
	major: 2,
	minor: 1,
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
export const PORT = env.PORT;

export { prisma };

const CORS_DOMAINS = env.CORS_URLS.split(",");
CORS_DOMAINS.push(URL);
CORS_DOMAINS.push(REACT_APP_API_URL.replace(/\/+$/, ""));
CORS_DOMAINS.push(API_URL);

initCorsDomains(CORS_DOMAINS);

if (env.NODE_ENV !== "test") {
	logger.debug({ corsDomains: CORS_DOMAINS }, "CORS domains loaded");
	logger.info(`Reachable on ${env.PORT}; For example: ${env.REACT_APP_API_URL}`);
}

const uiBuildPath = join(__dirname, "../../UI/build");
const uiIndexPath = join(uiBuildPath, "index.html");
const hasUiBuild = existsSync(uiBuildPath);
const hasUiIndex = existsSync(uiIndexPath);

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
		executionMiddleware.use({}),
	],
);

const loader = new server.FileLoader("/");
if (env.NODE_ENV !== "test") {
	loader.load("./routes", { fileBasedRouting: false });
}
export const fileRouter = loader.export();

if (hasUiBuild) {
	server.path("/", (path) => path.static(uiBuildPath));
}

server.notFound(async (ctr) => {
	const STATIC_EXT = /\.(js|mjs|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map|json|txt|xml|webp|avif|mp4|webm)(\?.*)?$/i;
	if (!ctr.url.path.startsWith("/api") && !STATIC_EXT.test(ctr.url.path) && hasUiIndex) {
		return ctr.status(200, "OK").printFile(uiIndexPath, { addTypes: true });
	}

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

			// Restore last update-check result into memory so the Admin UI has it immediately
			const lastCheck = await getUpdateLastCheck();
			if (lastCheck) await reconcileUpdateState(lastCheck);

			startSystemCrons({ prisma, executeFunction, performGitPull });
		})
		.catch((err) => logger.error(err, "Server failed to start"));
}
