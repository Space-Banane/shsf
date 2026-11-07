import { fileRouter, prisma } from "..";
import { OpenAPITags } from "../lib/openapi";

// Readiness probe used by the self-updater. Unlike /health it proves the
// database answers; migrations already ran, because the container CMD runs
// `prisma migrate deploy` before starting this process.
export = new fileRouter.Path("/").http("GET", "/ready", (http) =>
	http
		.document({
			description: "Readiness check. 200 once the server can reach its database, 503 otherwise.",
			tags: ["System"] as OpenAPITags[],
			operationId: "getReady",
			responses: {
				200: { description: "Ready" },
				503: { description: "Database unreachable" },
			},
		})
		.onRequest(async (ctr) => {
			try {
				await prisma.$queryRaw`SELECT 1`;
				return ctr.print({ status: "OK" });
			} catch {
				return ctr.status(ctr.$status.SERVICE_UNAVAILABLE).print({ status: "FAILED" });
			}
		}),
);
