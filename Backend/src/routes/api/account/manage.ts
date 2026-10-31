import * as bcrypt from "bcrypt";
import { API_KEY_HEADER, COOKIE, fileRouter, INSTANCE_SECRET, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import {
	parseStoredEnvironmentVariables,
	serializeEnvironmentVariables,
} from "../../../lib/EnvironmentVariables";
import { cleanupFunctionContainer } from "../../../lib/Runner";
import { OpenAPITags } from "../../../lib/openapi";
import {
	DEFAULT_AI_PROVIDER_ENDPOINT,
	DEFAULT_AI_PROVIDER_MODEL,
	getAIProvider,
	normalizeAIProviderEndpoint,
	parseAIProviderCapabilities,
	parseAIProviderIgnoreInvalidModels,
	parseAIProviderIgnoreTlsErrors,
	validateAIProvider,
} from "../../../lib/AIProvider";
import { encryptSecret } from "../../../lib/GitOps";
import { getAllowAIProviderInternal } from "../../../lib/DataManager";
import { env } from "../../../lib/env";
import {
	getLogAnalysisAvailability,
	resolveOpenRouterKey,
	validateLogAnalysisModel,
} from "../../../lib/LogAnalysis";
import { DecisionsError } from "../../../lib/OpenRouterDecisions";

export = new fileRouter.Path("/")
	.http("GET", "/api/account/settings", (http) =>
		http
			.document({
				description: "Get account-level settings",
				tags: ["User"] as OpenAPITags[],
				operationId: "getAccountSettings",
				responses: {
					200: {
						description: "Settings retrieved successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: {
											type: "object",
											properties: {
												accountEnvironment: {
													type: "array",
													items: {
														type: "object",
														properties: {
															name: { type: "string" },
															value: { type: "string" },
														},
													},
												},
											},
										},
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
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						message: authCheck.message,
					});
				}

				return ctr.print({
					status: "OK",
					data: {
						accountEnvironment: parseStoredEnvironmentVariables(
							authCheck.user.account_env,
						),
						aiProvider: authCheck.user.aiProviderApiKey || authCheck.user.openRouterKey ? {
							endpoint: authCheck.user.aiProviderEndpoint ?? DEFAULT_AI_PROVIDER_ENDPOINT,
							model: authCheck.user.aiProviderModel ?? DEFAULT_AI_PROVIDER_MODEL,
							capabilities: parseAIProviderCapabilities(authCheck.user.aiProviderCapabilities),
							ignoreTlsErrors: parseAIProviderIgnoreTlsErrors(authCheck.user.aiProviderCapabilities),
							ignoreInvalidModels: parseAIProviderIgnoreInvalidModels(authCheck.user.aiProviderCapabilities),
						} : null,
						logAnalysis: getLogAnalysisAvailability(authCheck.user, env.OPENROUTER_API_KEY, INSTANCE_SECRET),
					},
				});
			}),
	)
	.http("PATCH", "/api/account/settings", (http) =>
		http
			.document({
				description: "Update account settings (OpenRouter API key, account env vars)",
				tags: ["User"] as OpenAPITags[],
				operationId: "updateOpenRouterKey",
				requestBody: {
					content: {
						"application/json": {
							schema: { type: "object" },
						},
					},
				},
				responses: {
					200: {
						description: "Settings updated successfully",
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
						aiProvider: z.object({
							endpoint: z.string().url().max(1024).refine((value) => {
								const protocol = new URL(value).protocol;
								return protocol === "https:" || protocol === "http:";
							}, "Endpoint must use HTTP or HTTPS"),
							model: z.string().min(1).max(256),
							apiKey: z.string().min(1).max(4096).optional(),
							capabilities: z.object({ tools: z.boolean(), json: z.boolean() }),
							ignoreTlsErrors: z.boolean().default(false),
							ignoreInvalidModels: z.boolean().default(false),
						}).nullable().optional(),
						openRouterKey: z.string().max(512).nullable().optional(), // Backward-compatible API input.
						logAnalysis: z.object({
							enabled: z.boolean(),
							model: z.string().trim().max(256).optional(),
						}).optional(),
						accountEnvironment: z
							.array(
								z.object({
									name: z.string().min(1).max(128),
									value: z.string().max(256),
								}),
							)
							.optional(),
					}),
				);

				if (!data) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "FAILED",
						message: error.toString(),
					});
				}

				const updatePayload: {
					openRouterKey?: string | null;
					aiProviderEndpoint?: string | null;
					aiProviderModel?: string | null;
					aiProviderApiKey?: string | null;
					aiProviderCapabilities?: string | null;
					account_env?: string | null;
					logAnalysisEnabled?: boolean;
					logAnalysisModel?: string | null;
				} = {};
				if (data.aiProvider !== undefined) {
					if (data.aiProvider === null) {
						updatePayload.aiProviderEndpoint = null;
						updatePayload.aiProviderModel = null;
						updatePayload.aiProviderApiKey = null;
						updatePayload.aiProviderCapabilities = null;
						updatePayload.openRouterKey = null;
					} else {
						let endpoint: string;
						let apiKey: string;
						const model = data.aiProvider.model.trim();
						try {
							endpoint = normalizeAIProviderEndpoint(data.aiProvider.endpoint, await getAllowAIProviderInternal());
							const existingProvider = data.aiProvider.apiKey ? null : getAIProvider(authCheck.user, undefined, INSTANCE_SECRET);
							apiKey = data.aiProvider.apiKey ?? (existingProvider?.endpoint === endpoint ? existingProvider.apiKey : "");
							if (!apiKey) throw new Error("Enter an API key before saving a provider.");
							if (!model) throw new Error("Enter a model before saving a provider.");
							await validateAIProvider({ ...data.aiProvider, endpoint, model, apiKey });
						} catch (error) {
							return ctr.status(ctr.$status.BAD_REQUEST).print({
								status: "FAILED",
								message: error instanceof Error ? error.message : "AI provider validation failed.",
							});
						}
						updatePayload.aiProviderEndpoint = endpoint;
						updatePayload.aiProviderModel = data.aiProvider.model.trim();
						updatePayload.aiProviderApiKey = encryptSecret(apiKey, INSTANCE_SECRET);
						// Store the TLS option alongside existing provider options; legacy JSON keeps verification enabled.
						updatePayload.aiProviderCapabilities = JSON.stringify({
							...data.aiProvider.capabilities,
							ignoreTlsErrors: data.aiProvider.ignoreTlsErrors,
							ignoreInvalidModels: data.aiProvider.ignoreInvalidModels,
						});
						updatePayload.openRouterKey = null;
					}
				}
				if (data.openRouterKey !== undefined) {
					// Legacy clients retain the OpenRouter default but now store credentials encrypted.
					updatePayload.openRouterKey = null;
					updatePayload.aiProviderEndpoint = DEFAULT_AI_PROVIDER_ENDPOINT;
					updatePayload.aiProviderModel = DEFAULT_AI_PROVIDER_MODEL;
					updatePayload.aiProviderApiKey = data.openRouterKey ? encryptSecret(data.openRouterKey, INSTANCE_SECRET) : null;
					updatePayload.aiProviderCapabilities = data.openRouterKey ? JSON.stringify({ tools: true, json: true }) : null;
				}
				if (data.logAnalysis !== undefined) {
					const model = data.logAnalysis.model ?? authCheck.user.logAnalysisModel ?? "";
					if (data.logAnalysis.enabled) {
						const key = resolveOpenRouterKey(authCheck.user, env.OPENROUTER_API_KEY, INSTANCE_SECRET);
						const problem = !model
							? "Enter a Decisions-compatible model before enabling log analysis."
							: !key
								? "Add an OpenRouter API key under AI generation (or ask your admin to set OPENROUTER_API_KEY) before enabling log analysis."
								: null;
						if (problem) {
							return ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: problem });
						}
						try {
							await validateLogAnalysisModel(key!.apiKey, model);
						} catch (error) {
							return ctr.status(ctr.$status.BAD_REQUEST).print({
								status: "FAILED",
								message: `Log analysis check failed: ${error instanceof DecisionsError ? error.message : "OpenRouter could not be reached."}`,
							});
						}
					}
					updatePayload.logAnalysisEnabled = data.logAnalysis.enabled;
					updatePayload.logAnalysisModel = model || null;
				}
				if (data.accountEnvironment !== undefined) {
					updatePayload.account_env = serializeEnvironmentVariables(
						data.accountEnvironment,
					);
				}

				if (Object.keys(updatePayload).length === 0) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "FAILED",
						message: "No settings to update",
					});
				}

				const updatedUser = await prisma.user.update({
					where: { id: authCheck.user.id },
					data: updatePayload,
				});

				return ctr.print({
					status: "OK",
					message: "Settings updated successfully",
					data: {
						accountEnvironment: parseStoredEnvironmentVariables(
							updatedUser.account_env,
						),
						logAnalysis: getLogAnalysisAvailability(updatedUser, env.OPENROUTER_API_KEY, INSTANCE_SECRET),
					},
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
						account_env: userData.account_env,
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
