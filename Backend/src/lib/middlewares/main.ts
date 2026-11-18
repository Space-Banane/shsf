import { Middleware } from "rjweb-server";
import { createLogger } from "../logger";
import { env } from "../env";
import { IGNORE_PATHS, IMMUTABLE_CACHE_CONTROL, INJECT_HEADERS, isHashedAssetPath, requestLogUrl } from "../static";

const log = createLogger("HTTP");

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const mainMiddleware = new Middleware<{}, {}>("Main Middleware", "1.0.0")
	.load(() => {
		log.info("Main middleware loaded");
	})
	.httpRequest(async (_config, _server, _context, ctr) => {
		if (env.REQUEST_DEBUGGING && !IGNORE_PATHS.some((p) => ctr.url.href.startsWith(p))) {
			log.info(
				{ method: ctr.url.method, url: requestLogUrl(ctr.url), ip: ctr.client.ip.usual() },
				"Received request",
			);
		}

		for (const [header, value] of Object.entries(INJECT_HEADERS)) {
			ctr.headers.set(header, value);
		}

		if (isHashedAssetPath(ctr.url.path)) {
			ctr.headers.set("Cache-Control", IMMUTABLE_CACHE_CONTROL);
		}
	})
	.httpRequestFinish(async (_config, _server, _context, ctr, ms) => {
		if (env.RESPONSE_DEBUGGING && !IGNORE_PATHS.some((p) => ctr.url.href.startsWith(p))) {
			log.info(
				{ method: ctr.url.method, url: requestLogUrl(ctr.url), duration: ms.toFixed(2) },
				"Sent response",
			);
		}
	})
	.export();
