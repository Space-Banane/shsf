import { API_KEY_HEADER, COOKIE, fileRouter } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { OpenAPITags } from "../../../lib/openapi";

export = new fileRouter.Path("/").http(
	"GET",
	"/api/account/getUserInfo",
	(http) =>
		http
			.document({
				description:
					"Get information about the authenticated user (session or API key).",
				tags: ["User"] as OpenAPITags[],
				operationId: "getUserInfo",
				responses: {
					200: {
						description: "User info successfully retrieved",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										user: { type: "object" },
										session: { type: ["object", "null"] },
										apiKey: { type: ["object", "null"] },
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);

				if (!authCheck.success) {
					return ctr.print({
						status: 401,
						message: authCheck.message,
					});
				}

				return ctr.print({
					status: "OK",
					user: {
						...authCheck.user,
						password: undefined,
						openRouterKey: undefined,
					},
					session: authCheck.method === "session" ? authCheck.session : null,
					apiKey: authCheck.method === "apiKey" ? authCheck.apiKey : null,
				});
			}),
);
