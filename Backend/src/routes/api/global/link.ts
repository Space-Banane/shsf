import { fileRouter, INSTANCE_SECRET, prisma } from "../../..";
import { getLinkLock, getLinkStatus, getUUID, setLinkStatus } from "../../../lib/DataManager";
import { OpenAPITags } from "../../../lib/openapi";

export = new fileRouter.Path("/")
	/**
	 * GET /api/global/linkable
	 * Returns whether this instance is currently open for linking.
	 * An instance is linkable when the link lock is not set AND it is not already linked.
	 */
	.http("GET", "/api/global/linkable", (http) =>
		http
			.ratelimit((limit) => limit.hits(10).window(5000).penalty(50))
			.document({
				description:
					"Returns whether this instance is currently open for linking (not locked and not already linked).",
				tags: ["Global"] as OpenAPITags[],
				operationId: "getLinkable",
				responses: {
					200: {
						description: "Returns the linkable status of this instance.",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										linkable: {
											type: "boolean",
											description:
												"True if this instance accepts a link request right now.",
										},
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const [linkLock, linkStatus] = await Promise.all([
					getLinkLock(),
					getLinkStatus(),
				]);

				// Linkable = feature is not locked/disabled AND no user is already linked
				const linkable = !linkLock && !linkStatus.linked;

				return ctr.print({ status: "OK", linkable });
			}),
	)

	/**
	 * POST /api/global/link
	 * Links an external user to this instance.
	 * Requires the instance secret and the email of a local Admin user.
	 * Only one user may be linked at a time.
	 */
	.http("POST", "/api/global/link", (http) =>
		http
			.ratelimit((limit) => limit.hits(5).window(10000).penalty(500))
			.document({
				description:
					"Links a remote user to this instance. Requires the instance secret and the email of a local Admin user.",
				tags: ["Global"] as OpenAPITags[],
				operationId: "linkInstance",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["secret", "email"],
								properties: {
									secret: {
										type: "string",
										description: "The INSTANCE_SECRET of this instance.",
									},
									email: {
										type: "string",
										description: "Email address of the local Admin user authorising the link.",
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "Instance linked successfully.",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										message: { type: "string" },
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						secret: z.string().min(1),
						email: z.string().email(),
					}),
				);

				if (!data)
					return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

				// 1. Verify instance secret
				if (data.secret !== INSTANCE_SECRET) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						message: "Invalid instance secret.",
					});
				}

				// 2. Check if linking is currently allowed
				const [linkLock, linkStatus] = await Promise.all([
					getLinkLock(),
					getLinkStatus(),
				]);

				if (linkLock) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: "FAILED",
						message: "Linking is currently disabled for this instance.",
					});
				}

				if (linkStatus.linked) {
					return ctr.status(ctr.$status.CONFLICT).print({
						status: "FAILED",
						message: "This instance is already linked to a user. Unlink first.",
					});
				}

				// 3. Verify the email belongs to a local Admin user
				const user = await prisma.user.findUnique({
					where: { email: data.email },
				});

				if (!user) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: "FAILED",
						message: "No user with that email address was found on this instance.",
					});
				}

				if (user.role !== "Admin") {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: "FAILED",
						message: "The specified user does not have the Admin role on this instance.",
					});
				}

				// 4. Save the link
				await setLinkStatus({ linked: true, global_user_email: data.email });

				return ctr.print({
					status: "OK",
					message: `Instance successfully linked to ${data.email}.`,
				});
			}),
	)

	/**
	 * POST /api/global/unlink
	 * Removes the link between the external user and this instance.
	 * Requires the email that was used to link and the instance UUID.
	 */
	.http("POST", "/api/global/unlink", (http) =>
		http
			.ratelimit((limit) => limit.hits(5).window(10000).penalty(500))
			.document({
				description:
					"Unlinks the currently linked remote user from this instance. Requires the linked email and the instance UUID.",
				tags: ["Global"] as OpenAPITags[],
				operationId: "unlinkInstance",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["email", "instance_id"],
								properties: {
									email: {
										type: "string",
										description: "The email address that was used to link this instance.",
									},
									instance_id: {
										type: "string",
										description: "The UUID of this instance.",
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "Instance unlinked successfully.",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										message: { type: "string" },
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						email: z.string().email(),
						instance_id: z.string().min(1),
					}),
				);

				if (!data)
					return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

				// 1. Verify current link status
				const linkStatus = await getLinkStatus();

				if (!linkStatus.linked) {
					return ctr.status(ctr.$status.CONFLICT).print({
						status: "FAILED",
						message: "This instance is not currently linked.",
					});
				}

				// 2. Verify the email matches the linked user
				if (linkStatus.global_user_email !== data.email) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						message: "The provided email does not match the linked user.",
					});
				}

				// 3. Verify the instance ID matches
				const instanceUUID = await getUUID();

				if (!instanceUUID || instanceUUID.trim() !== data.instance_id.trim()) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						message: "The provided instance ID does not match this instance.",
					});
				}

				// 4. Remove the link
				await setLinkStatus({ linked: false });

				return ctr.print({
					status: "OK",
					message: "Instance successfully unlinked.",
				});
			}),
	);
