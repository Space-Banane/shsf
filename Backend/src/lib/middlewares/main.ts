import { Middleware } from "rjweb-server";
import { createLogger } from "../logger";
import { env } from "../env";
import { IGNORE_PATHS, INJECT_HEADERS } from "../static";

const log = createLogger("HTTP");

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const mainMiddleware = new Middleware<{}, {}>("Main Middleware", "1.0.0")
	.load(() => {
		log.info("Main middleware loaded");
	})
	.httpRequest(async (_config, _server, _context, ctr) => {
		if (env.REQUEST_DEBUGGING && !IGNORE_PATHS.some((p) => ctr.url.href.startsWith(p))) {
			log.info(
				{ method: ctr.url.method, url: ctr.url.href, ip: ctr.client.ip.usual() },
				"Received request",
			);
		}

		for (const [header, value] of Object.entries(INJECT_HEADERS)) {
			ctr.headers.set(header, value);
		}
	})
	.httpRequestFinish(async (_config, _server, _context, ctr, ms) => {
		if (env.RESPONSE_DEBUGGING && !IGNORE_PATHS.some((p) => ctr.url.href.startsWith(p))) {
			log.info(
				{ method: ctr.url.method, url: ctr.url.href, duration: ms.toFixed(2) },
				"Sent response",
			);
		}
	})
	.export();
