import { fileRouter, INSTANCE_SECRET, prisma } from "../../..";
import { OpenAPITags } from "../../../lib/openapi";

export = new fileRouter.Path("/")
	/**
	 * POST /api/global/stats
	 * Returns aggregate statistics for this SHSF instance.
	 * Requires the instance secret and the email of a local Admin user
	 * (same auth model as /api/global/link, designed to be called by shsf.dev).
	 */
	.http("POST", "/api/global/stats", (http) =>
		http
			.ratelimit((limit) => limit.hits(10).window(10000).penalty(200))
			.document({
				description:
					"Returns aggregate statistics for this SHSF instance. Requires the instance secret and an Admin email. Intended to be called by shsf.dev.",
				tags: ["Global"] as OpenAPITags[],
				operationId: "getInstanceStats",
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
						description: "Instance statistics retrieved successfully.",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										stats: {
											type: "object",
											properties: {
												functionCount: {
													type: "number",
													description:
														"Total number of functions across the entire instance.",
												},
												userCount: {
													type: "number",
													description: "Total number of registered users.",
												},
												namespaceCount: {
													type: "number",
													description:
														"Total number of namespaces across the entire instance.",
												},
												totalRamAllocated: {
													type: "number",
													description: "Sum of max_ram (MB) across all functions.",
												},
											},
										},
									},
								},
							},
						},
					},
					400: { description: "Missing or invalid request body." },
					401: { description: "Invalid instance secret." },
					403: { description: "Provided email does not belong to an Admin user." },
					404: { description: "No user found with the provided email." },
				},
			})
			.onRequest(async (ctr) => {
				const secret = ctr.headers.get("x-shsf-insect");
				const email = ctr.headers.get("x-shsf-address");

				// 0. Verify required headers are present
				if (!secret || !email) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "FAILED",
						message: "Missing required headers: x-shsf-insect and x-shsf-address.",
					});
				}

                if (typeof secret !== "string" || typeof email !== "string") {
                    return ctr.status(ctr.$status.BAD_REQUEST).print({
                        status: "FAILED",
                        message: "Invalid header types: x-shsf-insect and x-shsf-address must be strings.",
                    });
                }

				// 1. Verify instance secret
				if (secret !== INSTANCE_SECRET) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						message: "Invalid instance secret.",
					});
				}

				// 2. Verify the email belongs to a local Admin user
				const user = await prisma.user.findUnique({
					where: { email: email },
					select: { id: true, role: true },
				});

				if (!user) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: "FAILED",
						message: "No user found with the provided email.",
					});
				}

				if (user.role !== "Admin") {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: "FAILED",
						message: "The provided email does not belong to an Admin user.",
					});
				}

				// 3. Gather aggregate stats in parallel
				try {
					const [functionCount, userCount, namespaceCount, ramAggregate] =
						await Promise.all([
							prisma.function.count(),
							prisma.user.count(),
							prisma.namespace.count(),
							prisma.function.aggregate({ _sum: { max_ram: true } }),
						]);

					return ctr.print({
						status: "OK",
						stats: {
							functionCount,
							userCount,
							namespaceCount,
							totalRamAllocated: ramAggregate._sum.max_ram ?? 0,
						},
					});
				} catch (err) {
					return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
						status: "FAILED",
						message: "Failed to retrieve global statistics.",
						details: err instanceof Error ? err.message : String(err),
					});
				}
			}),
	);
