import { Middleware } from "rjweb-server";
import { prisma } from "../..";
import { persistFunctionExecutionLog } from "../Runner";
import { createLogger } from "../logger";
import { env } from "../env";

const corsLog = createLogger("CORS");
const httpLog = createLogger("HTTP");

const CORS_DOMAINS: string[] = [];

export function initCorsDomains(domains: string[]) {
	CORS_DOMAINS.length = 0;
	CORS_DOMAINS.push(...domains);
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const corsMiddleware = new Middleware<{}, {}>("Custom CORS", "1.0.3")
	.load(() => {
		corsLog.info("Custom CORS locked and loaded");
	})
	.httpRequest(async (_config, _server, _context, ctr, end) => {
		httpLog.info(
			`[${ctr.headers.get("x-shsf-dev") === "true" ? "shsf.dev" : "direct"}] ${ctr.client.ip} [${ctr.url.method}] ${ctr.url.href}`,
		);

		if (env.RATELIMIT === 0) {
			ctr.skipRateLimit();
		}

		if (ctr.url.href === "/api/openapi.json") {
			corsLog.debug("OpenAPI schema requested, skipping CORS checks");
			ctr.headers.set("Content-Type", "application/json");
			ctr.headers.set("Access-Control-Allow-Origin", "*");
			return;
		}

		const origin = ctr.headers.get("origin");

		if (origin && !CORS_DOMAINS.includes(origin)) {
			let allowRequest = false;
			corsLog.debug({ origin }, "Origin not in allowlist (provisional)");

			if (ctr.url.path.startsWith("/api/exec/")) {
				corsLog.debug("Function execution detected, checking custom CORS");

				const execId = ctr.url.path.split("/")[4];
				const func = await prisma.function.findFirst({
					where: { executionId: execId },
				});
				if (func && func.cors_origins) {
					const allowedOrigins = func.cors_origins
						.split(",")
						.map((o) => o.trim())
						.filter((o) => o.length > 0);
					if (allowedOrigins.includes(origin)) {
						corsLog.debug({ origin, execId }, "Custom CORS: allowing origin");
						allowRequest = true;
					}
				} else {
					corsLog.debug({ execId }, "No custom CORS origins for function");
				}
			}

			if (!allowRequest) {
				corsLog.warn({ origin }, "CORS denied (final)");
				if (ctr.url.path.startsWith("/api/exec/")) {
					const execId = ctr.url.path.split("/")[4];
					const func = await prisma.function.findFirst({
						where: { executionId: execId },
					});
					if (func) {
						corsLog.warn({ funcId: func.id, funcName: func.name, origin }, "Logging denied origin for exec function");
						await persistFunctionExecutionLog({
							functionId: func.id,
							functionData: func,
							logs: `Denied origin: ${origin}`,
							output: JSON.stringify({
								status: "FAILED",
								message: "SERVER CORS Policy: This origin is not allowed access",
							}),
							payload: JSON.stringify({
								ran_by: "exec",
								method: ctr.url.method,
								route: "default",
								source_ip: ctr.client.ip.usual(),
								origin,
							}),
							exit_code: 403,
							tooks: [
								{
									description: "HTTP execution blocked before runtime",
									value: 0,
									timestamp: Date.now(),
								},
							],
							error_type: "cors_denied",
							force: true,
						});
					} else {
						corsLog.warn({ execId, origin }, "Could not find function for exec ID to log denied origin");
					}
				}
				return end(
					ctr.status(ctr.$status.FORBIDDEN).print({
						status: "FAILED",
						message: "SERVER CORS Policy: This origin is not allowed access",
					}),
				);
			}
		}

		const allowedHeaders =
			ctr.headers.get("access-control-request-headers") || "content-type, x-*";
		const allowedMethods = "GET, POST, PUT, DELETE, OPTIONS, PATCH";
		const allowCredentials = "true";
		const controlMaxAge = "86400";

		if (origin) {
			if (ctr.url.method === "OPTIONS") {
				ctr.headers.set("Access-Control-Max-Age", controlMaxAge);
				ctr.headers.set("Content-Length", "0");
				ctr.headers.set("Access-Control-Allow-Origin", origin);
				ctr.headers.set("Access-Control-Allow-Methods", allowedMethods);
				ctr.headers.set("Vary", "Origin");
				ctr.headers.set("Access-Control-Allow-Headers", allowedHeaders);
				ctr.headers.set("Access-Control-Allow-Credentials", allowCredentials);
				corsLog.debug({ origin }, "Preflight handled");
				return end(ctr.status(ctr.$status.NO_CONTENT).print(""));
			}

			ctr.headers.set("Access-Control-Allow-Origin", origin);
			ctr.headers.set("Vary", "Origin");
			ctr.headers.set("Access-Control-Allow-Methods", allowedMethods);
			ctr.headers.set("Access-Control-Allow-Headers", allowedHeaders);
			ctr.headers.set("Access-Control-Allow-Credentials", allowCredentials);
		}
	})
	.export();
