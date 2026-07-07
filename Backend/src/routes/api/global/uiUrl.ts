import { env } from "process";
import { fileRouter } from "../../..";
import { OpenAPITags } from "../../../lib/openapi";

export = new fileRouter.Path("/").http("GET", "/api/global/uiUrl", (http) =>
	http
		.ratelimit((limit) => limit.hits(20).window(5000).penalty(100))
		.document({
			description:
				"Returns the UI URL of this SHSF instance. (usually) called by SHSF.dev to display the instance UI URL. Not Authenticated as it can be easily guessed anyway.",
			tags: ["Global"] as OpenAPITags[],
			operationId: "getGlobalUIUrl",
			responses: {
				200: {
					description: "Returns the version of this SHSF instance.",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
                                    status: { type: "string" },
                                    uiUrl: { type: "string" },
                                }
							},
						},
					},
				},
			},
		})
		.onRequest(async (ctr) => {
			return ctr.print({
				status: "OK",
				uiUrl: env.UI_URL,
			});
		}),
);
