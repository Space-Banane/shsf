import * as bcrypt from "bcrypt";
import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { cleanupFunctionContainer } from "../../../lib/Runner";
import { OpenAPITags } from "../../../lib/openapi";

export = new fileRouter.Path("/")
	.http("PATCH", "/api/account/settings", (http) =>
		http
			.document({
				description: "Update account settings (OpenRouter API key)",
				tags: ["User"] as OpenAPITags[],
				operationId: "updateOpenRouterKey",
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									openRouterKey: {
										type: "string",
										maxLength: 512,
										description: "OpenRouter API key (null or empty string to clear)",
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "Settings updated successfully",
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
			.ratelimit((limit) => limit.hits(10).window(60000).penalty(5000))
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);

				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						message: authCheck.message,
					});
				}

				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						openRouterKey: z.string().max(512).nullable().optional(),
					}),
				);

				if (!data) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "FAILED",
						message: error.toString(),
					});
				}

				const updatePayload: any = {};
				if (data.openRouterKey !== undefined) {
					// null clears the key, empty string also clears it
					updatePayload.openRouterKey =
						data.openRouterKey === "" ? null : data.openRouterKey;
				}

				if (Object.keys(updatePayload).length === 0) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "FAILED",
						message: "No settings to update",
					});
				}

				await prisma.user.update({
					where: { id: authCheck.user.id },
					data: updatePayload,
				});

				return ctr.print({
					status: "OK",
					message: "Settings updated successfully",
				});
			}),
	)
	.http("GET", "/api/account/export", (http) =>
		http
			.document({
				description: "Export all account data as JSON",
				tags: ["User"] as OpenAPITags[],
				operationId: "exportAccountData",
				responses: {
					200: {
						description: "Account export successful",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										user: { type: "object" },
										functions: { type: "array" },
										namespaces: { type: "array" },
										sessions: { type: "array" },
										exportedAt: { type: "string" },
										exportVersion: { type: "string" },
										guestUsers: { type: "array" },
										storages: { type: "array" },
										accessTokens: { type: "array" },
									},
								},
							},
						},
					},
				},
			})
			.ratelimit((limit) => limit.hits(5).window(60000).penalty(10000))
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);

				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						message: authCheck.message,
					});
				}

				// Get all user data
				const userData = await prisma.user.findUnique({
					where: {
						id: authCheck.user.id,
					},
					include: {
						sessions: {
							select: {
								id: true,
								createdAt: true,
								updatedAt: true,
								// Don't include the hash for security
							},
						},
						functions: {
							include: {
								files: true,
								triggers: true,
								TriggerLog: true,
							},
						},
						namespaces: true,
						accessTokens: true,
						guestUsers: true,
						storages: true,
					},
				});

				if (!userData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: "FAILED",
						message: "User not found",
					});
				}

				// Remove sensitive information
				const exportData = {
					user: {
						id: userData.id,
						email: userData.email,
						displayName: userData.displayName,
						createdAt: userData.createdAt,
						updatedAt: userData.updatedAt,
					},
					functions: userData.functions,
					namespaces: userData.namespaces,
					sessions: userData.sessions,
					exportedAt: new Date().toISOString(),
					exportVersion: "1.0",
					guestUsers: userData.guestUsers,
					storages: userData.storages,
					accessTokens: userData.accessTokens,
				};

				// Set headers for file download
				ctr.headers.set("Content-Type", "application/json");
				ctr.headers.set(
					"Content-Disposition",
					`attachment; filename="shsf-account-export-${new Date().toISOString().split("T")[0]}.json"`,
				);
				ctr.headers.set(
					"Content-Length",
					Buffer.byteLength(JSON.stringify(exportData)).toString(),
				);
				ctr.headers.set("X-Content-Type-Options", "nosniff");

				return ctr.print(exportData);
			}),
	)
	.http("DELETE", "/api/account/delete", (http) =>
		http
			.document({
				description: "Delete user account (requires password and confirmation)",
				tags: ["User"] as OpenAPITags[],
				operationId: "deleteAccount",
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["password", "confirmation"],
								properties: {
									password: {
										type: "string",
										minLength: 8,
										maxLength: 120,
										description: "User password",
									},
									confirmation: {
										type: "string",
										enum: ["DELETE_MY_ACCOUNT"],
										description: "Must be 'DELETE_MY_ACCOUNT' to confirm deletion",
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "Account deleted successfully",
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
			.ratelimit((limit) => limit.hits(2).window(60000).penalty(5000))
			.onRequest(async (ctr) => {
				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						password: z.string().min(8).max(120),
						confirmation: z.literal("DELETE_MY_ACCOUNT"),
					}),
				);

				if (!data)
					return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);

				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						message: authCheck.message,
					});
				}

				// Verify password
				if (!authCheck.user.password) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "FAILED",
						message: "No password set for this account",
					});
				}

				const passwordMatch = await bcrypt.compare(
					data.password,
					authCheck.user.password,
				);

				if (!passwordMatch) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						message: "Invalid password",
					});
				}

				// Delete all functions and their data
				const userFunctions = await prisma.function.findMany({
					where: {
						userId: authCheck.user.id,
					},
					select: {
						id: true,
					},
				});

				const functionIds = userFunctions.map((f) => f.id);
				for (const functionId of functionIds) {
					// Clean up Docker container; Also deletes function files
					await cleanupFunctionContainer(functionId);
				}

				// Delete the user; This deletes all related data due to cascading
				await prisma.user.delete({
					where: {
						id: authCheck.user.id,
					},
				});

				// Clear the cookie
				ctr.cookies.delete(COOKIE);

				return ctr.print({
					status: "OK",
					message: "Account deleted successfully",
				});
			}),
	);
