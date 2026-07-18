import { API_KEY_HEADER, COOKIE, fileRouter, INSTANCE_SECRET } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { getLinkStatus } from "../../../lib/DataManager";
import { OpenAPITags } from "../../../lib/openapi";

export = new fileRouter.Path("/").http(
	"GET",
	"/api/global/link-status",
	(http) =>
		http
			.ratelimit((limit) => limit.hits(10).window(5000).penalty(50))
			.document({
				description:
					"Returns the link status of this instance. Requires an authenticated Admin session/API key, or the instance secret via the x-shsf-insect header.",
				tags: ["Global"] as OpenAPITags[],
				operationId: "getLinkStatus",
				parameters: [
					{
						name: "x-shsf-insect",
						in: "header",
						required: false,
						description:
							"The instance secret. Alternative to session/API key authentication.",
						schema: { type: "string" },
					},
				],
				responses: {
					200: {
						description: "Returns the link status of this instance.",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string", description: "Status of the operation." },
										linked: {
											type: "boolean",
											description:
												"Whether this instance is linked to a global user account.",
										},
										global_user_email: {
											type: "string",
											description:
												"The email of the linked global user (only present when linked is true).",
										},
									},
								},
							},
						},
					},
					401: { description: "Authentication failed." },
					403: { description: "Authenticated user is not an Admin." },
				},
			})
			.onRequest(async (ctr) => {
				const secretHeader = ctr.headers.get("x-shsf-insect");
				const secretOk =
					typeof secretHeader === "string" && secretHeader === INSTANCE_SECRET;

				if (!secretOk) {
					const authCheck = await checkAuthentication(
						ctr.cookies.get(COOKIE),
						ctr.headers.get(API_KEY_HEADER),
					);

					if (!authCheck.success) {
						return ctr.status(ctr.$status.UNAUTHORIZED).print({
							status: 401,
							message: authCheck.message,
						});
					}

					if (authCheck.user.role !== "Admin") {
						return ctr.status(ctr.$status.FORBIDDEN).print({
							status: 403,
							message: "Admins only.",
						});
					}
				}

				const linkStatus = await getLinkStatus();
				return ctr.print({
					status: "OK",
					...linkStatus,
				});
			}),
);
