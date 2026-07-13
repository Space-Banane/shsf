import { Middleware } from "rjweb-server";
import { prisma } from "../..";
import { executeLoadedHttpFunction } from "../HttpExecution";
import { createLogger } from "../logger";
import { readRawRequestBodyFromMiddleware } from "./executionBody";

const log = createLogger("execution");

const EXEC_ALIAS_PREFIX = "/exec/";
const EXEC_ID_PREFIX = "/api/exec/";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const executionMiddleware = new Middleware<{}, {}>(
	"Execution Middleware",
	"1.0.0",
)
	.load(() => {
		log.info("Execution middleware loaded");
	})
	.httpRequest(async (_config, _server, _context, ctr, end) => {
		const path = ctr.url.path;
		const method = (ctr.url.method as string).toUpperCase();

		let lookupMode: "alias" | "executionId" | null = null;
		let lookupValue = "";
		let route = "default";

		if (path.startsWith(EXEC_ALIAS_PREFIX)) {
			const rest = path.slice(EXEC_ALIAS_PREFIX.length);
			if (!rest) return;

			const slashIdx = rest.indexOf("/");
			if (slashIdx === -1) {
				lookupMode = "alias";
				lookupValue = rest;
			} else {
				lookupMode = "alias";
				lookupValue = rest.slice(0, slashIdx);
				route = rest.slice(slashIdx + 1).replace(/^\/+|\/+$/g, "") || "default";
			}
		} else if (path.startsWith(EXEC_ID_PREFIX)) {
			const parts = path.slice(EXEC_ID_PREFIX.length).split("/").filter(Boolean);
			if (parts.length < 2) return;

			lookupMode = "executionId";
			lookupValue = parts[1];
			if (parts.length > 2) {
				route = parts.slice(2).join("/");
			}
		} else {
			return;
		}

		if (!lookupMode || !lookupValue) return;

		let decodedValue: string;
		try {
			decodedValue = decodeURIComponent(lookupValue);
		} catch {
			decodedValue = lookupValue;
		}

		const functionData = await prisma.function.findFirst({
			where:
				lookupMode === "alias"
					? { executionAlias: decodedValue }
					: { executionId: decodedValue },
			include: {
				namespace: { select: { name: true, id: true } },
				files: true,
			},
		});

		if (!functionData) {
			return end(
				ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "Function not found",
				}),
			);
		}

		log.debug(
			{ method, alias: decodedValue, route, functionId: functionData.id },
			"Executing function via middleware",
		);

		const isGetLike = method === "GET";
		const capturedRoute = route;
		const capturedMethod = method;

		const result = await executeLoadedHttpFunction({
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			ctr: ctr as any,
			functionData,
			method: isGetLike ? "GET" : "POST",
			namespaceId: functionData.namespaceId,
			permissionFunctionId:
				lookupMode === "alias"
					? String(functionData.id)
					: functionData.executionId,
			executionAliasOrId: decodedValue,
			useCache: capturedRoute === "default",
			dependencies: {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				buildPayloadFromGET: async (c: any) => ({
					headers: Object.fromEntries(c.headers.entries()),
					queries: Object.fromEntries(c.queries.entries()),
					source_ip: c.client.ip.usual(),
					route: capturedRoute,
					method: capturedMethod,
				}),
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				buildPayloadFromPOST: async (c: any) => {
					const rawBody = await readRawRequestBodyFromMiddleware(c);
					return {
						headers: Object.fromEntries(c.headers.entries()),
						queries: Object.fromEntries(c.queries.entries()),
						body: rawBody.toString("utf-8"),
						raw_body: rawBody.toString("binary"),
						source_ip: c.client.ip.usual(),
						route: capturedRoute,
						method: capturedMethod,
					};
				},
			},
		});

		return end(result);
	})
	.export();
