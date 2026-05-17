import { randomUUID } from "crypto";
import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import {
	cleanupFunctionContainer,
	executeFunction,
	deleteContainerForFunction,
} from "../../../lib/Runner";
import Docker from "dockerode";
import { getFirstFileByLanguage } from "../../../lib/LangOps";

const Images: string[] = [
	// Python versions
	"python:3.9",
	"python:3.10",
	"python:3.11",
	"python:3.12",
	"python:3.13",
	"python:3.14",
	"python:3.15",
	"golang:1.20",
	"golang:1.21",
	"golang:1.22",
	"golang:1.23",
	"mcr.microsoft.com/dotnet/sdk:8.0",
	"mcr.microsoft.com/dotnet/sdk:9.0",
	"mcr.microsoft.com/dotnet/sdk:10.0",
];
const deprecatedImages: string[] = [
	"python:3.9",
	"python:3.10",
	"golang:1.20",
	"golang:1.21",
];

function isDotnetImage(image: string): boolean {
	return image.startsWith("mcr.microsoft.com/dotnet/sdk:");
}

function getImageFamily(image: string): string {
	return isDotnetImage(image) ? "dotnet" : image.split(":")[0];
}

// Create Docker client instance for container management
const docker = new Docker();

export = new fileRouter.Path("/")
	.http("GET", "/api/function/deprecatedImages", (http) =>
		http
			.document({
				description: "Get list of deprecated runtime images",
				tags: ["Functions"],
				operationId: "getDeprecatedImages",
				responses: {
					200: {
						description: "List of deprecated images",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: {
											type: "array",
											items: { type: "string" },
										},
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				return ctr.print({
					status: "OK",
					data: deprecatedImages,
				});
			}),
	)
	.http("POST", "/api/function", (http) =>
		http
			.document({
				description: "Create a new serverless function in a namespace",
				tags: ["Functions"],
				operationId: "createFunction",
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: [
									"name",
									"description",
									"image",
									"startup_file",
									"namespaceId",
								],
								properties: {
									name: {
										type: "string",
										description: "Function name",
									},
									description: {
										type: "string",
										description: "Function description",
									},
									image: {
										type: "string",
										description: "Docker image tag",
									},
									startup_file: {
										type: "string",
										description: "Startup file name",
									},
									docker_mount: {
										type: "boolean",
										description: "Enable Docker mount",
									},
									network_restricted: {
										type: "boolean",
										description: "Disable outbound network access for the function container",
									},
									ffmpeg_install: {
										type: "boolean",
										description: "Install ffmpeg in container",
									},
									opencv_install: {
										type: "boolean",
										description: "Install opencv in container",
									},
									executionAlias: {
										type: "string",
										description: "Custom execution alias",
									},
									imported: {
										type: "boolean",
										description: "Marks the function as imported",
									},
									settings: {
										type: "object",
										properties: {
											max_ram: { type: "number", description: "Max RAM (MB)" },
											timeout: { type: "number", description: "Timeout (seconds)" },
											allow_http: { type: "boolean", description: "Allow HTTP requests" },
											secure_header: {
												type: "string",
												description: "Secure header value",
											},
											tags: {
												type: "array",
												items: { type: "string" },
												description: "Tags",
											},
											retry_on_failure: {
												type: "boolean",
												description: "Retry on failure",
											},
											retry_count: { type: "number", description: "Retry count" },
											cache_enabled: {
												type: "boolean",
												description: "Enable response caching for non-stream execution",
											},
											cache_ttl: {
												type: "number",
												description: "Cache TTL in seconds (1-86400)",
											},
										},
									},
									environment: {
										type: "array",
										items: {
											type: "object",
											properties: {
												name: { type: "string", description: "Env var name" },
												value: { type: "string", description: "Env var value" },
											},
										},
										description: "Environment variables",
									},
									namespaceId: {
										type: "number",
										description: "Namespace ID",
									},
									cors_origins: {
										type: "string",
										description: "Allowed CORS origins",
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "Function created successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: {
											type: "object",
											properties: {
												id: { type: "number", description: "Created function ID" },
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
				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						name: z.string().min(1).max(128),
						description: z.string().min(3).max(128),
						image: z.enum(Images as any),
						startup_file: z.string().max(256),
						docker_mount: z.boolean().optional(),
						network_restricted: z.boolean().optional(),
						ffmpeg_install: z.boolean().optional(),
						opencv_install: z.boolean().optional(),
						executionAlias: z
							.string()
							.min(8)
							.max(128)
							.regex(/^[a-zA-Z0-9-_]+$/)
							.optional(), // Only allow alphanumeric, hyphens, and underscores
						imported: z.boolean().optional(),
						settings: z
							.object({
								max_ram: z.number().min(128).max(1024).optional(),
								timeout: z.number().positive().min(1).max(300).optional(), // Increased max timeout to 300 seconds : 5 minutes
								allow_http: z.boolean().optional(),
								secure_header: z.string().min(1).max(256).optional(),
								tags: z.array(z.string().min(1).max(32)).optional(),
								retry_on_failure: z.boolean().optional(),
								retry_count: z.number().min(1).max(10).positive().optional(),
								cache_enabled: z.boolean().optional(),
								cache_ttl: z.number().min(1).max(86400).optional(),
							})
							.optional(),
						environment: z
							.array(
								z
									.object({
										name: z.string().min(1).max(128),
										value: z.string().min(1).max(256),
									})
									.optional(),
							)
							.optional(),
						namespaceId: z.number(),
						cors_origins: z.string().max(2048).optional(), // Accept CORS origins as string
					}),
				);

				if (!data) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: error.toString(),
					});
				}

				if (!Images.includes(data.image)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid image",
					});
				}

				if (deprecatedImages.includes(data.image)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: `The selected runtime image (${data.image}) is deprecated and cannot be used for new functions. Please choose a different image.`,
					});
				}

				if (!isDotnetImage(data.image) && !data.startup_file.trim()) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Startup file is required for this runtime",
					});
				}

				const normalizedStartupFile = isDotnetImage(data.image)
					? ""
					: data.startup_file.trim();

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

				const namespace = await prisma.namespace.findFirst({
					where: {
						id: data.namespaceId,
						userId: authCheck.user.id,
					},
				});
				if (!namespace) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Namespace not found",
					});
				}

				const existingFunction = await prisma.function.findFirst({
					where: {
						name: data.name,
						namespaceId: data.namespaceId,
						userId: authCheck.user.id,
					},
				});
				if (existingFunction) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Function with this name already exists in this namespace",
					});
				}

				// Check for duplicate executionAlias before creating
				if (data.executionAlias) {
					const aliasExists = await prisma.function.findFirst({
						where: {
							executionAlias: data.executionAlias,
						},
					});
					if (aliasExists) {
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: 400,
							message: "Function with this executionAlias already exists",
						});
					}
				}

				const out = await prisma.function.create({
					data: {
						description: data.description,
						namespaceId: data.namespaceId,
						name: data.name,
						image: data.image,
						startup_file: normalizedStartupFile,
						tags: data.settings?.tags?.join(",") || "",
						allow_http: data.settings?.allow_http,
						max_ram: data.settings?.max_ram,
						timeout: data.settings?.timeout,
						secure_header: data.settings?.secure_header,
						retry_on_failure: data.settings?.retry_on_failure,
						max_retries: data.settings?.retry_count,
						cache_enabled: data.settings?.cache_enabled ?? false,
						cache_ttl: data.settings?.cache_ttl ?? 60,
						imported: data.imported ?? false,
						env: data.environment
							? JSON.stringify(
									data.environment.map((env) => ({
										name: env!.name,
										value: env!.value,
									})),
								)
							: undefined,
						userId: authCheck.user.id,
						executionId: randomUUID(),
						docker_mount: data.docker_mount || false,
						network_restricted: data.network_restricted || false,
						ffmpeg_install: data.ffmpeg_install || false,
						opencv_install: data.opencv_install || false,
						cors_origins: data.cors_origins,
						executionAlias: data.executionAlias,
						...(normalizedStartupFile
							? {
									files: {
										create: {
											name: normalizedStartupFile,
											content:
												(await getFirstFileByLanguage(
													getImageFamily(data.image),
													normalizedStartupFile,
												)) ?? "",
										},
									},
							  }
							: {}),
					},
				});

				return ctr.print({
					status: "OK",
					data: {
						id: out.id,
					},
				});
			}),
	)
	.http("DELETE", "/api/function/{id}", (http) =>
		http
			.document({
				description: "Delete a serverless function",
				tags: ["Functions"],
				operationId: "deleteFunction",
				responses: {
					200: {
						description: "Function deleted successfully",
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
					401: { description: "Unauthorized" },
					404: { description: "Function not found" },
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

				const id = ctr.params.get("id");
				if (!id) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Missing function id",
					});
				}
				const functionId = parseInt(id);
				if (isNaN(functionId)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid function id",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						id: functionId,
						userId: authCheck.user.id,
					},
				});
				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				// Delete the function from database
				await prisma.function.delete({
					where: {
						id: functionData.id,
					},
				});

				// Clean up the container and associated files
				await cleanupFunctionContainer(functionId);

				return ctr.print({
					status: "OK",
					message: "Function deleted",
				});
			}),
	)
	.http("GET", "/api/functions", (http) =>
		http
			.document({
				description: "Get all serverless functions for the current user",
				tags: ["Functions"],
				operationId: "getFunctions",
				responses: {
					200: {
						description: "List of functions",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: {
											type: "array",
											items: {
												type: "object",
												properties: {
													id: { type: "number" },
													name: { type: "string" },
													description: { type: "string" },
													image: { type: "string" },
													cache_enabled: {
														type: "boolean",
														description: "Whether response caching is enabled",
													},
													cache_ttl: {
														type: "number",
														description: "Cache TTL in seconds",
													},
													namespace: {
														type: "object",
														properties: {
															id: { type: "number" },
															name: { type: "string" },
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
					401: { description: "Unauthorized" },
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

				const functions = await prisma.function.findMany({
					where: {
						userId: authCheck.user.id,
					},
					include: {
						namespace: {
							select: {
								name: true,
								id: true,
							},
						},
					},
				});

				return ctr.print({
					status: "OK",
					data: functions,
				});
			}),
	)
	.http("GET", "/api/function/{id}", (http) =>
		http
			.document({
				description: "Get detailed information about a function",
				tags: ["Functions"],
				operationId: "getFunction",
				responses: {
					200: {
						description: "Function details",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: {
											type: "object",
											properties: {
												id: { type: "number" },
												name: { type: "string" },
												description: { type: "string" },
												image: { type: "string" },
												startup_file: { type: "string" },
												cache_enabled: {
													type: "boolean",
													description: "Whether response caching is enabled",
												},
												cache_ttl: {
													type: "number",
													description: "Cache TTL in seconds",
												},
												namespace: {
													type: "object",
													properties: {
														id: { type: "number" },
														name: { type: "string" },
													},
												},
											},
										},
									},
								},
							},
						},
					},
					401: { description: "Unauthorized" },
					404: { description: "Function not found" },
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

				const id = ctr.params.get("id");
				if (!id) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Missing function id",
					});
				}
				const functionId = parseInt(id);
				if (isNaN(functionId)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid function id",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						id: functionId,
						userId: authCheck.user.id,
					},
					include: {
						namespace: {
							select: {
								name: true,
								id: true,
							},
						},
					},
				});
				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				return ctr.print({
					status: "OK",
					data: functionData,
				});
			}),
	)
	.http("GET", "/api/function/{id}/logs", (http) =>
		http
			.document({
				description: "Get execution logs for a function",
				tags: ["Functions"],
				operationId: "getFunctionLogs",
				responses: {
					200: {
						description: "Function execution logs",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: {
											type: "array",
											items: {
												type: "object",
												properties: {
													id: { type: "number" },
													functionId: { type: "number" },
													output: { type: "string" },
													error: { type: "string", nullable: true },
													status: { type: "string" },
													duration: { type: "number" },
													createdAt: { type: "string", format: "date-time" },
												},
											},
										},
									},
								},
							},
						},
					},
					401: { description: "Unauthorized" },
					404: { description: "Function not found" },
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

				const id = ctr.params.get("id");
				if (!id) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Missing function id",
					});
				}
				const functionId = parseInt(id);
				if (isNaN(functionId)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid function id",
					});
				}

				const logs = await prisma.triggerLog.findMany({
					where: {
						functionId: functionId,
						createdAt: {
							gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days
						},
					},
					take: 50,
					orderBy: {
						createdAt: "desc",
					},
				});
				if (!logs) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "No logs found",
					});
				}

				return ctr.print({
					status: "OK",
					data: logs,
				});
			}),
	)
	.http("PATCH", "/api/function/{id}", (http) =>
		http
			.document({
				description: "Update function details or settings",
				tags: ["Functions"],
				operationId: "updateFunction",
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									name: { type: "string", description: "Function name" },
									description: { type: "string", description: "Function description" },
									image: { type: "string", description: "Docker image tag" },
									startup_file: { type: "string", description: "Startup file name" },
									docker_mount: { type: "boolean", description: "Enable Docker mount" },
									network_restricted: {
										type: "boolean",
										description: "Disable outbound network access for the function container",
									},
									ffmpeg_install: { type: "boolean", description: "Install ffmpeg" },
									opencv_install: { type: "boolean", description: "Install opencv" },
									executionAlias: { type: "string" },
									settings: {
										type: "object",
										properties: {
											max_ram: { type: "number" },
											timeout: { type: "number" },
											allow_http: { type: "boolean" },
											secure_header: { type: "string" },
											tags: { type: "array", items: { type: "string" } },
											retry_on_failure: { type: "boolean" },
											retry_count: { type: "number" },
											cache_enabled: {
												type: "boolean",
												description: "Enable response caching for non-stream execution",
											},
											cache_ttl: {
												type: "number",
												description: "Cache TTL in seconds (1-86400)",
											},
										},
									},
									environment: {
										type: "array",
										items: {
											type: "object",
											properties: {
												name: { type: "string" },
												value: { type: "string" },
											},
										},
									},
									cors_origins: { type: "string" },
									namespaceId: {
										type: "number",
										description: "Target namespace to move the function into",
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "Function updated successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: { type: "object" },
										relaunch: {
											type: "string",
											description: "Informs if container relaunch started",
										},
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const id = ctr.params.get("id");
				if (!id) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Missing function id",
					});
				}
				const functionId = parseInt(id);
				if (isNaN(functionId)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid function id",
					});
				}

				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						name: z.string().min(1).max(128).optional(),
						description: z.string().min(3).max(128).optional(),
						image: z.enum(Images as any).optional(),
						startup_file: z.string().max(256).optional(),
						executionAlias: z
							.string()
							.min(8)
							.max(128)
							.regex(/^[a-zA-Z0-9-_]+$/)
							.optional(), // Only allow alphanumeric, hyphens, and underscores
						docker_mount: z.boolean().optional(),
						network_restricted: z.boolean().optional(),
						ffmpeg_install: z.boolean().optional(),
						opencv_install: z.boolean().optional(),
						settings: z
							.object({
								max_ram: z.number().min(128).max(1024).optional(),
								timeout: z.number().positive().min(1).max(500).optional(),
								allow_http: z.boolean().optional(),
								secure_header: z.string().min(1).max(256).optional().or(z.null()),
								tags: z.array(z.string().min(1).max(32)).optional(),
								retry_on_failure: z.boolean().optional(),
								retry_count: z.number().min(1).max(10).positive().optional(),
								cache_enabled: z.boolean().optional(),
								cache_ttl: z.number().min(1).max(86400).optional(),
							})
							.optional(),
						environment: z
							.array(
								z.object({
									name: z.string().min(1).max(128),
									value: z.string().min(1).max(256),
								}),
							)
							.optional(),
						cors_origins: z.string().max(2048).optional(),
						namespaceId: z.number().optional(),
					}),
				);

				if (!data) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: error.toString(),
					});
				}

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

				const existingFunction = await prisma.function.findFirst({
					where: {
						id: functionId,
						userId: authCheck.user.id,
					},
				});

				if (!existingFunction) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				const nextImage = data.image ?? existingFunction.image;

				if (
					data.startup_file !== undefined &&
					!isDotnetImage(nextImage) &&
					!data.startup_file.trim()
				) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Startup file is required for this runtime",
					});
				}

				// Check for duplicate executionAlias before updating
				if (data.executionAlias !== undefined) {
					const aliasExists = await prisma.function.findFirst({
						where: {
							executionAlias: data.executionAlias,
							// Exclude current function
							NOT: { id: functionId },
						},
					});
					if (aliasExists) {
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: 400,
							message: "Another function with this executionAlias already exists",
						});
					}
				}

				let namespaceChange: number | undefined;
				if (data.namespaceId !== undefined) {
					const namespaceRecord = await prisma.namespace.findFirst({
						where: {
							id: data.namespaceId,
							userId: authCheck.user.id,
						},
					});
					if (!namespaceRecord) {
						return ctr.status(ctr.$status.NOT_FOUND).print({
							status: 404,
							message: "Namespace not found",
						});
					}
					const targetName = data.name?.trim() || existingFunction.name;
					const nameConflict = await prisma.function.findFirst({
						where: {
							namespaceId: namespaceRecord.id,
							name: targetName,
							userId: authCheck.user.id,
							NOT: { id: functionId },
						},
					});
					if (nameConflict) {
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: 400,
							message:
								"Another function with this name already exists in the target namespace",
						});
					}
					namespaceChange = namespaceRecord.id;
				}

				const normalizedStartupFile =
					data.startup_file !== undefined
						? isDotnetImage(nextImage)
							? ""
							: data.startup_file.trim()
						: undefined;

				const updatedData: any = {
					...(data.name && { name: data.name }),
					...(data.description && { description: data.description }),
					...(data.image && { image: data.image }),
					...(normalizedStartupFile !== undefined && {
						startup_file: normalizedStartupFile,
					}),
					...(data.settings?.tags && {
						tags: data.settings.tags.join(","),
					}),
					...(data.settings?.allow_http !== undefined && {
						allow_http: data.settings.allow_http,
					}),
					...(data.settings?.max_ram && { max_ram: data.settings.max_ram }),
					...(data.settings?.timeout && { timeout: data.settings.timeout }),
					...(data.settings?.secure_header !== undefined && {
						secure_header: data.settings.secure_header,
					}),
					...(data.settings?.retry_on_failure !== undefined && {
						retry_on_failure: data.settings.retry_on_failure,
					}),
					...(data.settings?.retry_count && {
						max_retries: data.settings.retry_count,
					}),
					...(data.settings?.cache_enabled !== undefined && {
						cache_enabled: data.settings.cache_enabled,
					}),
					...(data.settings?.cache_ttl && {
						cache_ttl: data.settings.cache_ttl,
					}),
					...(data.environment && {
						env: JSON.stringify(
							data.environment.map((env) => ({
								name: env!.name,
								value: env!.value,
							})),
						),
					}),
					...(data.docker_mount !== undefined && {
						docker_mount: data.docker_mount,
					}),
					...(data.network_restricted !== undefined && {
						network_restricted: data.network_restricted,
					}),
					...(data.ffmpeg_install !== undefined && {
						ffmpeg_install: data.ffmpeg_install,
					}),
					...(data.opencv_install !== undefined && {
						opencv_install: data.opencv_install,
					}),
					...(data.cors_origins !== undefined && {
						cors_origins: data.cors_origins,
					}),
					...(data.executionAlias !== undefined && {
						executionAlias: data.executionAlias,
					}),
					...(namespaceChange !== undefined && {
						namespaceId: namespaceChange,
					}),
				};

				// Track if relaunch is triggered
				let relaunchTriggered = false;

				// If configuration changes require container recreation
				const changes: string[] = [];
				if (data.image && data.image !== existingFunction.image) {
					changes.push(`image: ${existingFunction.image} -> ${data.image}`);
					if (getImageFamily(data.image) !== getImageFamily(existingFunction.image)) {
						// We prohibit language changes due to absolute nightmares of edge cases.
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: 400,
							message:
								"Changing the language (base image) of a function is not allowed. Please create a new function for this.",
						});
					}
					if (deprecatedImages.includes(data.image)) {
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: 400,
							message: `The selected runtime image (${data.image}) is deprecated and cannot be used. Please choose a different image.`,
						});
					}
				}
				if (
					data.docker_mount !== undefined &&
					data.docker_mount !== existingFunction.docker_mount
				) {
					changes.push(
						`docker_mount: ${existingFunction.docker_mount} -> ${data.docker_mount}`,
					);
				}
				if (
					data.network_restricted !== undefined &&
					data.network_restricted !== existingFunction.network_restricted
				) {
					changes.push(
						`network_restricted: ${existingFunction.network_restricted} -> ${data.network_restricted}`,
					);
				}
				if (
					data.ffmpeg_install !== undefined &&
					data.ffmpeg_install !== existingFunction.ffmpeg_install
				) {
					changes.push(
						`ffmpeg_install: ${existingFunction.ffmpeg_install} -> ${data.ffmpeg_install}`,
					);
				}
				if (
					data.opencv_install !== undefined &&
					data.opencv_install !== existingFunction.opencv_install
				) {
					changes.push(
						`opencv_install: ${existingFunction.opencv_install} -> ${data.opencv_install}`,
					);
				}

				if (changes.length > 0) {
					relaunchTriggered = true; // Set flag regardless of container existence

					// Check if a container exists for this function before cleanup
					try {
						const container = await docker.getContainer(`shsf_func_${functionId}`);
						if (await container.inspect()) {
							console.log(
								`[SHSF] Function ${functionId} configuration changed (${changes.join(", ")}). Container will be recreated.`,
							);

							// Clean up existing container to force recreation
							if (data.image && data.image !== existingFunction.image) {
								await deleteContainerForFunction(functionId);
							} else {
								await cleanupFunctionContainer(functionId);
							}
						}
					} catch (err) {
						console.error(
							`[SHSF] Error checking/cleaning up container for function ${functionId}:`,
							err,
						);
					}
				}

				const updatedFunction = await prisma.function.update({
					where: {
						id: functionId,
					},
					data: updatedData,
				});

				// UI confirmation: inform if relaunch started
				type PatchFunctionResponse = {
					status: string;
					data: typeof updatedFunction;
					relaunch?: string;
				};

				const response: PatchFunctionResponse = {
					status: "OK",
					data: updatedFunction,
					...(relaunchTriggered && {
						relaunch:
							"Container relaunch started (will be recreated on next execution).",
					}),
				};

				return ctr.print(response);
			}),
	)
	.http("GET", "/api/function/{id}/isDeprecated", (http) =>
		http
			.document({
				description: "Check if the function's runtime image is deprecated",
				tags: ["Functions"],
				operationId: "isFunctionDeprecated",
				responses: {
					200: {
						description: "Deprecation status",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: {
											type: "object",
											properties: {
												isDeprecated: { type: "boolean" },
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
					return ctr.print({
						status: 401,
						message: authCheck.message,
					});
				}

				const id = ctr.params.get("id");
				if (!id) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Missing function id",
					});
				}
				const functionId = parseInt(id);
				if (isNaN(functionId)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid function id",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						id: functionId,
						userId: authCheck.user.id,
					},
				});
				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				const isDeprecated = deprecatedImages.includes(functionData.image);

				return ctr.print({
					status: "OK",
					data: {
						isDeprecated,
					},
				});
			}),
	);
