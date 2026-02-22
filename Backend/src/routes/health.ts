import { fileRouter } from "..";
import { OpenAPITags } from "../lib/openapi";

export = new fileRouter.Path("/").http("GET", "/health", (http) =>
	http
		.ratelimit((limit) => limit.hits(1).window(2000).penalty(100))
		.document({
			description: "Health check endpoint. Returns status OK if the server is running.",
			tags: ["System"] as OpenAPITags[],
			operationId: "getHealth",
			responses: {
				200: {
					description: "Server is healthy",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: { type: "string", description: "Always 'OK', as the server is healthy if it can respond to requests." }
								}
							}
						}
					}
				}
			}
		})
		.onRequest(async (ctr) => {
			return ctr.print({
				status: "OK",
			});
		}),
);
