import { env } from "process";
import { fileRouter, VERSION } from "../../..";
import { GlobalAuthCheck } from "../../../lib/Authentication";
import { OpenAPITags } from "../../../lib/openapi";

export = new fileRouter.Path("/").http("GET", "/api/global/uiUrl", (http) =>
	http
		.ratelimit((limit) => limit.hits(20).window(5000).penalty(100))
		.document({
			description:
				"Returns the UI URL of this SHSF instance. Called by SHSF.dev to display the instance UI URL. Authenticated via instance secret and linked user email.",
			tags: ["Global"] as OpenAPITags[],
			operationId: "getGlobalUIUrl",
			parameters: [
				{
					name: "x-shsf-insect",
					in: "header",
					required: true,
					description: "The instance secret.",
					schema: { type: "string" },
				},
				{
					name: "x-shsf-address",
					in: "header",
					required: true,
					description: "The linked user email address.",
					schema: { type: "string" },
				},
			],
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
			const secret = ctr.headers.get("x-shsf-insect");
			const email = ctr.headers.get("x-shsf-address");

			const authCheck = await GlobalAuthCheck(secret);

			if (!authCheck.success) {
				return ctr.status(ctr.$status.UNAUTHORIZED).print({
					status: 401,
					message: authCheck.message,
				});
			}

			if (!email || email !== authCheck.linked_email) {
				return ctr.status(ctr.$status.UNAUTHORIZED).print({
					status: 401,
					message: "Invalid or mismatched address.",
				});
			}

			return ctr.print({
				status: "OK",
				uiUrl: env.UI_URL,
			});
		}),
);
