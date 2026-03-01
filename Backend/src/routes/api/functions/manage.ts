import { randomUUID } from "crypto";
import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { cleanupFunctionContainer, executeFunction } from "../../../lib/Runner";
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
];

// Create Docker client instance for container management
const docker = new Docker();

export = new fileRouter.Path("/")
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
									ffmpeg_install: {
										type: "boolean",
										description: "Install ffmpeg in container",
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
						startup_file: z.string().min(1).max(256),
						docker_mount: z.boolean().optional(),
						ffmpeg_install: z.boolean().optional(),
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
						startup_file: data.startup_file,
						tags: data.settings?.tags?.join(",") || "",
						allow_http: data.settings?.allow_http,
						max_ram: data.settings?.max_ram,
						timeout: data.settings?.timeout,
						secure_header: data.settings?.secure_header,
						retry_on_failure: data.settings?.retry_on_failure,
						max_retries: data.settings?.retry_count,
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
						ffmpeg_install: data.ffmpeg_install || false,
						cors_origins: data.cors_origins,
						executionAlias: data.executionAlias,
						files: {
							// create first file when function is created.
							create: {
								name: data.startup_file,
								content: (await getFirstFileByLanguage(data.image.split(":")[0])) ?? "",
							},
						},
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
		http.onRequest(async (ctr) => {
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
		http.onRequest(async (ctr) => {
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
		http.onRequest(async (ctr) => {
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
		http.onRequest(async (ctr) => {
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
		http.onRequest(async (ctr) => {
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
					startup_file: z.string().min(1).max(256).optional(),
					executionAlias: z
						.string()
						.min(8)
						.max(128)
						.regex(/^[a-zA-Z0-9-_]+$/)
						.optional(), // Only allow alphanumeric, hyphens, and underscores
					docker_mount: z.boolean().optional(),
					ffmpeg_install: z.boolean().optional(),
					settings: z
						.object({
							max_ram: z.number().min(128).max(1024).optional(),
							timeout: z.number().positive().min(1).max(500).optional(),
							allow_http: z.boolean().optional(),
							secure_header: z.string().min(1).max(256).optional().or(z.null()),
							tags: z.array(z.string().min(1).max(32)).optional(),
							retry_on_failure: z.boolean().optional(),
							retry_count: z.number().min(1).max(10).positive().optional(),
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
					cors_origins: z.string().max(2048).optional(),
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

			const updatedData: any = {
				...(data.name && { name: data.name }),
				...(data.description && { description: data.description }),
				...(data.image && { image: data.image }),
				...(data.startup_file && { startup_file: data.startup_file }),
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
				...(data.ffmpeg_install !== undefined && {
					ffmpeg_install: data.ffmpeg_install,
				}),
				...(data.cors_origins !== undefined && {
					cors_origins: data.cors_origins,
				}),
				...(data.executionAlias !== undefined && {
					executionAlias: data.executionAlias,
				}),
			};

			// Track if relaunch is triggered
			let relaunchTriggered = false;

			// If image is being changed, we need to recreate the container; Or docker_mount/ffmpeg_install changed
			if (
				(data.image && data.image !== existingFunction.image) ||
				(data.docker_mount !== undefined &&
					data.docker_mount !== existingFunction.docker_mount) ||
				(data.ffmpeg_install !== undefined &&
					data.ffmpeg_install !== existingFunction.ffmpeg_install)
			) {
				relaunchTriggered = true; // Set flag regardless of container existence
				// Check if a container exists for this function before cleanup
				try {
					const containers = await docker.listContainers({
						all: true,
						filters: {
							label: [`functionId=${functionId}`],
						},
					});
					if (containers.length > 0) {
						if (data.image && data.image !== existingFunction.image) {
							console.log(
								`[SHSF] Function ${functionId} image changing from ${existingFunction.image} to ${data.image}, container will be recreated`,
							);
						} else if (
							data.docker_mount !== undefined &&
							data.docker_mount !== existingFunction.docker_mount
						) {
							console.log(
								`[SHSF] Function ${functionId} docker_mount changing from ${existingFunction.docker_mount} to ${data.docker_mount}, container will be recreated`,
							);
						} else if (
							data.ffmpeg_install !== undefined &&
							data.ffmpeg_install !== existingFunction.ffmpeg_install
						) {
							console.log(
								`[SHSF] Function ${functionId} ffmpeg_install changing from ${existingFunction.ffmpeg_install} to ${data.ffmpeg_install}, container will be recreated`,
							);
						}
						// Clean up existing container to force recreation with new image, docker_mount, or ffmpeg_install change
						await cleanupFunctionContainer(functionId);
						// On the next run, the container will be recreated with the new image and new mounts.
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
	);
