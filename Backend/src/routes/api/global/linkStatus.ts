import { fileRouter } from "../../..";
import { getLinkStatus, setLinkStatus } from "../../../lib/DataManager";
import { OpenAPITags } from "../../../lib/openapi";

export = new fileRouter.Path("/").http(
	"GET",
	"/api/global/link-status",
	(http) =>
		http
			.ratelimit((limit) => limit.hits(10).window(5000).penalty(50))
			.document({
				description: "Returns the link status of this instance.",
				tags: ["Global"] as OpenAPITags[],
				operationId: "getLinkStatus",
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
				},
			})
			.onRequest(async (ctr) => {
				const linkStatus = await getLinkStatus();
				return ctr.print({
					status: "OK",
					...linkStatus,
				});
			}),
);
