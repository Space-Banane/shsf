import { randomUUID } from "crypto";
import {
	API_KEY_HEADER,
	COOKIE,
	fileRouter,
	prisma,
	REACT_APP_API_URL,
	UI_URL,
} from "../..";
import { checkAuthentication } from "../../lib/Authentication";
import {
	buildPayloadFromGET,
	buildPayloadFromPOST,
	cleanupFunctionContainer,
	executeFunction,
	installDependencies,
} from "../../lib/Runner";
import Docker from "dockerode";
import { env } from "process";
import { Cookie } from "rjweb-server";
import { Function, FunctionFile } from "@prisma/client";

const Images: string[] = [
	// Python versions
	"python:3.9",
	"python:3.10",
	"python:3.11",
	"python:3.12",
	"python:3.13",
	"python:3.14",
	"python:3.15",
];

// Create Docker client instance for container management
const docker = new Docker();

// Helper function for HTTP execution permission (guest/auth logic)
async function checkHttpExecutionPermission(
	ctr: any,
	functionData: {
		files: FunctionFile[];
		namespace: { id: number; name: string };
	} & Function,
	namespaceId: number,
	functionId: string,
) {
	// Returns: { state: boolean, reason: string, redirect?: string }
	// Handles secure_header, x-access-key, guest users/cookies, and sets cookies if needed
	let permissionToExecute: {
		state: boolean;
		reason: string;
		redirect?: string;
	} = {
		state: true,
		reason: "",
	};

	// Secure header check
	if (functionData.secure_header) {
		if (!ctr.headers.has("x-secure-header")) {
			permissionToExecute = { state: false, reason: "Missing secure header" };
		} else {
			const secureHeader = ctr.headers.get("x-secure-header");
			if (secureHeader !== functionData.secure_header) {
				permissionToExecute = { state: false, reason: "Invalid secure header" };
			}
		}
	}

	// API key check
	if (ctr.headers.has("x-access-key")) {
		const accessKey = ctr.headers.get("x-access-key") || "";
		const authState = await checkAuthentication(null, accessKey);
		if (authState.success && authState.method === "apiKey") {
			if (authState.user.id === functionData.userId) {
				permissionToExecute = {
					state: true,
					reason: "Provided API Key and owns the function",
				};
			} else {
				permissionToExecute = {
					state: false,
					reason: "Provided Access Token, but does not own the function",
				};
			}
		} else {
			permissionToExecute = {
				state: false,
				reason: "Provided Access Token, but it's invalid",
			};
		}
	}

	// Guest user logic
	const guests = await prisma.guestUser.findMany({
		where: {
			permittedFunctions: { array_contains: [functionData.id] },
			guestOwnerId: functionData.userId,
		},
	});
	if (guests.length > 0) {
		permissionToExecute = {
			state: false,
			reason: "Function has guest users assigned, authentication required now",
		};
		// Check for guest cookie
		const guestCookie = ctr.cookies.get(
			`shsf_guest_${namespaceId}_${functionId}`,
		);
		if (guestCookie) {
			const guestSession = await prisma.guestSession.findFirst({
				where: { hash: guestCookie },
				include: { guestUser: true },
			});
			if (guestSession) {
				const now = new Date();
				if (guestSession.expiresAt < now) {
					permissionToExecute = {
						state: false,
						reason: "Guest session has expired",
					};
					await prisma.guestSession.delete({ where: { id: guestSession.id } });
					ctr.cookies.set(
						`shsf_guest_${namespaceId}_${functionId}`,
						new Cookie("", {
							domain: REACT_APP_API_URL.replace("https://", "")
								.replace("http://", "")
								.replace("/", ""),
							expires: new Date(Date.now()),
						}),
					);
					permissionToExecute.redirect = undefined;
				} else if (!guests.map((g) => g.id).includes(guestSession.guestUser.id)) {
					permissionToExecute = {
						state: false,
						reason:
							"Guest user does not have permission to access this function. [FORCE RELOAD]",
					};
					ctr.cookies.set(
						`shsf_guest_${namespaceId}_${functionId}`,
						new Cookie("", {
							domain: REACT_APP_API_URL.replace("https://", "")
								.replace("http://", "")
								.replace("/", ""),
							expires: new Date(Date.now()),
						}),
					);
					permissionToExecute.redirect = `${REACT_APP_API_URL}/api/exec/${namespaceId}/${functionId}`;
				} else {
					permissionToExecute = { state: true, reason: "Valid guest cookie" };
				}
			} else {
				permissionToExecute = { state: false, reason: "Invalid guest cookie" };
				ctr.cookies.set(
					`shsf_guest_${namespaceId}_${functionId}`,
					new Cookie("", {
						domain: REACT_APP_API_URL.replace("https://", "")
							.replace("http://", "")
							.replace("/", ""),
						expires: new Date(Date.now()),
					}),
				);
			}
		} else {
			permissionToExecute = { state: false, reason: "Missing guest cookie" };
			permissionToExecute.redirect =
				UI_URL +
				"/guest-access?nsp=" +
				functionData.namespaceId +
				"&func=" +
				functionData.executionId;
		}
	}

	return permissionToExecute;
}

export = new fileRouter.Path("/")
	.http("POST", "/api/function", (http) =>
		http.onRequest(async (ctr) => {
			const [data, error] = await ctr.bindBody((z) =>
				z.object({
					name: z.string().min(1).max(128),
					description: z.string().min(3).max(128),
					image: z.enum(Images as any),
					startup_file: z.string().min(1).max(256).optional(),
					docker_mount: z.boolean().optional(),
					ffmpeg_install: z.boolean().optional(),
					executionAlias: z
						.string()
						.min(8)
						.max(128)
						.regex(/^[a-zA-Z0-9-_]+$/)
						.optional(), // Only allow alphanumeric, hyphens, and underscores
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
	)
	.http("POST", "/api/function/{id}/execute", (http) =>
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

			// Extract optional run parameter from request body
			const [runData] = await ctr.bindBody((z) =>
				z
					.object({
						run: z.any().optional(),
					})
					.optional(),
			);

			// Convert run data to string for passing to executeFunction
			const runPayload = JSON.stringify({
				// if there is a .method we will remove it
				body: runData?.run ? runData.run : {},
				headers: Object.fromEntries(ctr.headers.entries()),
				queries: Object.fromEntries(ctr.queries.entries()),
				raw_body: await ctr.$body().text(),
				source_ip: ctr.client.ip.usual(),
				route: runData?.run
					? runData.run.route
						? runData.run.route
						: "default"
					: "default",
				method: runData?.run
					? runData.run.method
						? runData.run.method
						: "POST"
					: "POST",
			});

			const functionData = await prisma.function.findFirst({
				where: {
					id: functionId,
				},
			});
			if (!functionData) {
				return ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "Function not found",
				});
			}

			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);

			if (!authCheck.success) {
				return ctr.print({
					status: 401,
					message: "Unauthorized",
				});
			}

			const files = await prisma.functionFile.findMany({
				where: {
					functionId: functionData.id,
				},
			});
			if (!files || files.length === 0) {
				return ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "Function has no files",
				});
			}

			// Check execution mode from query parameter
			const streamMode = ctr.queries.get("stream") !== "false";

			try {
				if (streamMode) {
					// Streaming mode
					return ctr.printChunked(
						(print) =>
							new Promise<void>((end) => {
								let output = "";
								executeFunction(
									functionId,
									functionData,
									files,
									{
										enabled: true,
										onChunk: async (text) => {
											output += text;
											// Ensure text is properly stringified before sending
											await print(
												JSON.stringify({
													type: "output",
													content: text,
												}),
											);
										},
									},
									JSON.stringify({ ran_by: "user", ...(typeof runPayload === "object" && runPayload !== null ? runPayload : {}) }),
								)
									.then(async (result) => {
										// Successfully completed - include result if available
										await print(
											JSON.stringify({
												type: "end",
												exitCode: 0,
												output: output,
												result: result?.result,
												took: result?.tooks,
											}),
										);
										end();
									})
									.catch(async (error) => {
										// Handle errors
										await print(
											JSON.stringify({
												type: "error",
												error: error.message || "Execution failed",
											}),
										);
										end();
									});

								ctr.$abort(() => {
									// Handle abort, nothing specific needed as Runner.ts handles cleanup
									end();
								});
							}),
					);
				} else {
					// Synchronous mode
					const result = await executeFunction(
						functionId,
						functionData,
						files,
						{ enabled: false },
						JSON.stringify({ ran_by: "user", ...(typeof runPayload === "object" && runPayload !== null ? runPayload : {}) }),
					);

					return ctr.print({
						status: "OK",
						data: {
							output: result?.logs || "No output",
							exitCode: result?.exit_code || 0,
							result: result?.result,
							took: result?.tooks,
						},
					});
				}
			} catch (error: any) {
				if (error.message === "Timeout") {
					return ctr.status(ctr.$status.REQUEST_TIMEOUT).print({
						status: 408,
						message: "Code execution timed out",
					});
				}
				return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
					status: 500,
					message: "Failed to execute code",
					error: error.message,
				});
			}
		}),
	)
	.http("GET", "/api/exec/{namespaceId}/{functionId}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(2)
					.window(parseInt(env.RATELIMIT!) || 2000)
					.penalty(1000),
			)
			.onRequest(async (ctr) => {
				const namespaceId = parseInt(ctr.params.get("namespaceId") || "");
				const functionId = ctr.params.get("functionId") || "";

				if (isNaN(namespaceId)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid namespace",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						executionId: functionId,
						namespaceId: namespaceId,
					},
					include: {
						namespace: { select: { name: true, id: true } },
						files: true,
					},
				});

				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				if (!functionData.allow_http) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "HTTP execution is not allowed for this function",
					});
				}

				// --- streamlined permission check ---
				const permissionToExecute = await checkHttpExecutionPermission(
					ctr,
					functionData,
					namespaceId,
					functionId,
				);

				if (permissionToExecute.redirect) {
					return ctr
						.status(ctr.$status.TEMPORARY_REDIRECT)
						.redirect(permissionToExecute.redirect);
				}
				if (!permissionToExecute.state) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: permissionToExecute.reason,
					});
				}
				// --- end streamlined ---

				// Build the payload from GET request
				const payload = await buildPayloadFromGET(ctr);

				// Execute with run parameter instead of inject.json
				const result = await executeFunction(
					functionData.id,
					functionData,
					functionData.files,
					{ enabled: false },
					JSON.stringify({ ran_by: "exec", ...(typeof payload === "object" && payload !== null ? payload : {}) }),
				);

				// we might be able to do magic here
				if (typeof result?.result === "object" && result?.result !== null) {
					const out = result.result; // quicker to write and access

					if ("_shsf" in out) {
						const version: "v2" = out._shsf; // always v2 currently
						const headers: { key: string; value: any }[] | null =
							"_headers" in out
								? Object.entries(out._headers).map(([key, value]) => ({
										key,
										value,
									}))
								: null;
						const response_code: number | null = "_code" in out ? out._code : null;
						const response: any | null = "_res" in out ? out._res : null;

						if (response_code === 301 || response_code === 302) {
							// Handle redirects
							ctr.status(response_code);
							if (headers) {
								headers.forEach(({ key, value }) => {
									ctr.headers.set(key, value);
								});
							}
							const link = "_location" in out ? out._location : "/";
							return ctr.redirect(link);
						}

						ctr.status(response_code || 200);

						if (headers) {
							headers.forEach(({ key, value }) => {
								ctr.headers.set(key, value);
							});
						}

						if (response) {
							return ctr.print(response);
						} else {
							return ctr.print("No Function Result :(");
						}
					}
				}

				// Return result if available from main function, otherwise output OK
				return ctr.print(result?.result ?? "No Function Result :(");
			}),
	)
	.http("POST", "/api/exec/{namespaceId}/{functionId}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(2)
					.window(parseInt(env.RATELIMIT!) || 2000)
					.penalty(1000),
			)
			.onRequest(async (ctr) => {
				const namespaceId = parseInt(ctr.params.get("namespaceId") || "");
				const functionId = ctr.params.get("functionId") || "";

				if (isNaN(namespaceId)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid namespace",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						executionId: functionId,
						namespaceId: namespaceId,
					},
					include: {
						namespace: { select: { name: true, id: true } },
						files: true,
					},
				});

				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				if (!functionData.allow_http) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "HTTP execution is not allowed for this function",
					});
				}

				// --- streamlined permission check ---
				const permissionToExecute = await checkHttpExecutionPermission(
					ctr,
					functionData,
					namespaceId,
					functionId,
				);

				if (permissionToExecute.redirect) {
					return ctr
						.status(ctr.$status.TEMPORARY_REDIRECT)
						.redirect(permissionToExecute.redirect);
				}
				if (!permissionToExecute.state) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: permissionToExecute.reason,
					});
				}
				// --- end streamlined ---

				// Build the payload from POST request
				const payload = await buildPayloadFromPOST(ctr);

				const result = await executeFunction(
					functionData.id,
					functionData,
					functionData.files,
					{ enabled: false },
					JSON.stringify({ ran_by: "exec", ...(typeof payload === "object" && payload !== null ? payload : {}) }),
				);

				// we might be able to do magic here
				if (typeof result?.result === "object" && result?.result !== null) {
					const out = result.result; // quicker to write and access

					if ("_shsf" in out) {
						const version: "v2" = out._shsf; // always v2 currently
						const headers: { key: string; value: any }[] | null =
							"_headers" in out
								? Object.entries(out._headers).map(([key, value]) => ({
										key,
										value,
									}))
								: null;
						const response_code: number | null = "_code" in out ? out._code : null;
						const response: any | null = "_res" in out ? out._res : null;

						if (response_code === 301 || response_code === 302) {
							// Handle redirects
							ctr.status(response_code);
							if (headers) {
								headers.forEach(({ key, value }) => {
									ctr.headers.set(key, value);
								});
							}
							const link = "_location" in out ? out._location : "/";
							return ctr.redirect(link);
						}

						ctr.status(response_code || 200);

						if (headers) {
							headers.forEach(({ key, value }) => {
								ctr.headers.set(key, value);
							});
						}

						if (response) {
							return ctr.print(response);
						} else {
							return ctr.print("No Function Result :(");
						}
					}
				}

				return ctr.print(result?.result ?? "No Function Result :(");
			}),
	)
	.http("GET", "/exec/{executionAlias}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(2)
					.window(parseInt(env.RATELIMIT!) || 2000)
					.penalty(1000),
			)
			.onRequest(async (ctr) => {
				const executionAlias = ctr.params.get("executionAlias") || "";

				if (!executionAlias) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid execution alias",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						executionAlias: executionAlias,
					},
					include: {
						namespace: { select: { name: true, id: true } },
						files: true,
					},
				});

				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				if (!functionData.allow_http) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "HTTP execution is not allowed for this function",
					});
				}

				// --- streamlined permission check ---
				const permissionToExecute = await checkHttpExecutionPermission(
					ctr,
					functionData,
					functionData.namespaceId,
					String(functionData.id),
				);

				if (permissionToExecute.redirect) {
					return ctr
						.status(ctr.$status.TEMPORARY_REDIRECT)
						.redirect(permissionToExecute.redirect);
				}
				if (!permissionToExecute.state) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: permissionToExecute.reason,
					});
				}
				// --- end streamlined ---

				// Build the payload from GET request
				const payload = await buildPayloadFromGET(ctr);

				// Execute with run parameter instead of inject.json
				const result = await executeFunction(
					functionData.id,
					functionData,
					functionData.files,
					{ enabled: false },
					JSON.stringify({ ran_by: "exec", ...(typeof payload === "object" && payload !== null ? payload : {}) }),
				);

				// we might be able to do magic here
				if (typeof result?.result === "object" && result?.result !== null) {
					const out = result.result; // quicker to write and access

					if ("_shsf" in out) {
						const version: "v2" = out._shsf; // always v2 currently
						const headers: { key: string; value: any }[] | null =
							"_headers" in out
								? Object.entries(out._headers).map(([key, value]) => ({
										key,
										value,
									}))
								: null;
						const response_code: number | null = "_code" in out ? out._code : null;
						const response: any | null = "_res" in out ? out._res : null;

						if (response_code === 301 || response_code === 302) {
							// Handle redirects
							ctr.status(response_code);
							if (headers) {
								headers.forEach(({ key, value }) => {
									ctr.headers.set(key, value);
								});
							}
							const link = "_location" in out ? out._location : "/";
							return ctr.redirect(link);
						}

						ctr.status(response_code || 200);

						if (headers) {
							headers.forEach(({ key, value }) => {
								ctr.headers.set(key, value);
							});
						}

						if (response) {
							return ctr.print(response);
						} else {
							return ctr.print("No Function Result :(");
						}
					}
				}

				// Return result if available from main function, otherwise output OK
				return ctr.print(result?.result ?? "No Function Result :(");
			}),
	)
	.http("POST", "/exec/{executionAlias}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(2)
					.window(parseInt(env.RATELIMIT!) || 2000)
					.penalty(1000),
			)
			.onRequest(async (ctr) => {
				const executionAlias = ctr.params.get("executionAlias") || "";

				if (!executionAlias) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid execution alias",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						executionAlias: executionAlias,
					},
					include: {
						namespace: { select: { name: true, id: true } },
						files: true,
					},
				});

				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				if (!functionData.allow_http) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "HTTP execution is not allowed for this function",
					});
				}

				// --- streamlined permission check ---
				const permissionToExecute = await checkHttpExecutionPermission(
					ctr,
					functionData,
					functionData.namespaceId,
					String(functionData.id),
				);

				if (permissionToExecute.redirect) {
					return ctr
						.status(ctr.$status.TEMPORARY_REDIRECT)
						.redirect(permissionToExecute.redirect);
				}
				if (!permissionToExecute.state) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: permissionToExecute.reason,
					});
				}
				// --- end streamlined ---

				// Build the payload from POST request
				const payload = await buildPayloadFromPOST(ctr);

				const result = await executeFunction(
					functionData.id,
					functionData,
					functionData.files,
					{ enabled: false },
					JSON.stringify({ ran_by: "exec", ...(typeof payload === "object" && payload !== null ? payload : {}) }),
				);

				// we might be able to do magic here
				if (typeof result?.result === "object" && result?.result !== null) {
					const out = result.result; // quicker to write and access

					if ("_shsf" in out) {
						const version: "v2" = out._shsf; // always v2 currently
						const headers: { key: string; value: any }[] | null =
							"_headers" in out
								? Object.entries(out._headers).map(([key, value]) => ({
										key,
										value,
									}))
								: null;
						const response_code: number | null = "_code" in out ? out._code : null;
						const response: any | null = "_res" in out ? out._res : null;

						if (response_code === 301 || response_code === 302) {
							// Handle redirects
							ctr.status(response_code);
							if (headers) {
								headers.forEach(({ key, value }) => {
									ctr.headers.set(key, value);
								});
							}
							const link = "_location" in out ? out._location : "/";
							return ctr.redirect(link);
						}

						ctr.status(response_code || 200);

						if (headers) {
							headers.forEach(({ key, value }) => {
								ctr.headers.set(key, value);
							});
						}

						if (response) {
							return ctr.print(response);
						} else {
							return ctr.print("No Function Result :(");
						}
					}
				}

				return ctr.print(result?.result ?? "No Function Result :(");
			}),
	)
	.http("GET", "/api/exec/{namespaceId}/{functionId}/{route}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(2)
					.window(parseInt(env.RATELIMIT!) || 2000)
					.penalty(1000),
			)
			.onRequest(async (ctr) => {
				const namespaceId = parseInt(ctr.params.get("namespaceId") || "");
				const functionId = ctr.params.get("functionId") || "";

				if (isNaN(namespaceId)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid namespace",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						executionId: functionId,
						namespaceId: namespaceId,
					},
					include: {
						namespace: { select: { name: true, id: true } },
						files: true,
					},
				});

				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				if (!functionData.allow_http) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "HTTP execution is not allowed for this function",
					});
				}

				// --- streamlined permission check ---
				const permissionToExecute = await checkHttpExecutionPermission(
					ctr,
					functionData,
					namespaceId,
					functionId,
				);

				if (permissionToExecute.redirect) {
					return ctr
						.status(ctr.$status.TEMPORARY_REDIRECT)
						.redirect(permissionToExecute.redirect);
				}
				if (!permissionToExecute.state) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: permissionToExecute.reason,
					});
				}
				// --- end streamlined ---

				// Build the payload from GET request
				const payload = await buildPayloadFromGET(ctr);

				// Execute with run parameter instead of inject.json
				const result = await executeFunction(
					functionData.id,
					functionData,
					functionData.files,
					{ enabled: false },
					JSON.stringify({ ran_by: "exec", ...(typeof payload === "object" && payload !== null ? payload : {}) }),
				);

				// we might be able to do magic here
				if (typeof result?.result === "object" && result?.result !== null) {
					const out = result.result; // quicker to write and access

					if ("_shsf" in out) {
						const version: "v2" = out._shsf; // always v2 currently
						const headers: { key: string; value: any }[] | null =
							"_headers" in out
								? Object.entries(out._headers).map(([key, value]) => ({
										key,
										value,
									}))
								: null;
						const response_code: number | null = "_code" in out ? out._code : null;
						const response: any | null = "_res" in out ? out._res : null;

						if (response_code === 301 || response_code === 302) {
							// Handle redirects
							ctr.status(response_code);
							if (headers) {
								headers.forEach(({ key, value }) => {
									ctr.headers.set(key, value);
								});
							}
							const link = "_location" in out ? out._location : "/";
							return ctr.redirect(link);
						}

						ctr.status(response_code || 200);

						if (headers) {
							headers.forEach(({ key, value }) => {
								ctr.headers.set(key, value);
							});
						}

						if (response) {
							return ctr.print(response);
						} else {
							return ctr.print("No Function Result :(");
						}
					}
				}

				// Return result if available from main function, otherwise output OK
				return ctr.print(result?.result ?? "No Function Result :(");
			}),
	)
	.http("POST", "/api/exec/{namespaceId}/{functionId}/{route}", (http) =>
		http
			.ratelimit((limit) =>
				limit
					.hits(2)
					.window(parseInt(env.RATELIMIT!) || 2000)
					.penalty(1000),
			)
			.onRequest(async (ctr) => {
				const namespaceId = parseInt(ctr.params.get("namespaceId") || "");
				const functionId = ctr.params.get("functionId") || "";

				if (isNaN(namespaceId)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid namespace",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						executionId: functionId,
						namespaceId: namespaceId,
					},
					include: {
						namespace: { select: { name: true, id: true } },
						files: true,
					},
				});

				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				if (!functionData.allow_http) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "HTTP execution is not allowed for this function",
					});
				}

				// --- streamlined permission check ---
				const permissionToExecute = await checkHttpExecutionPermission(
					ctr,
					functionData,
					namespaceId,
					functionId,
				);

				if (permissionToExecute.redirect) {
					return ctr
						.status(ctr.$status.TEMPORARY_REDIRECT)
						.redirect(permissionToExecute.redirect);
				}
				if (!permissionToExecute.state) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: permissionToExecute.reason,
					});
				}
				// --- end streamlined ---

				// Build the payload from POST request
				const payload = await buildPayloadFromPOST(ctr);

				const result = await executeFunction(
					functionData.id,
					functionData,
					functionData.files,
					{ enabled: false },
					JSON.stringify({ ran_by: "exec", ...(typeof payload === "object" && payload !== null ? payload : {}) }),
				);

				// we might be able to do magic here
				if (typeof result?.result === "object" && result?.result !== null) {
					const out = result.result; // quicker to write and access

					if ("_shsf" in out) {
						const version: "v2" = out._shsf; // always v2 currently
						const headers: { key: string; value: any }[] | null =
							"_headers" in out
								? Object.entries(out._headers).map(([key, value]) => ({
										key,
										value,
									}))
								: null;
						const response_code: number | null = "_code" in out ? out._code : null;
						const response: any | null = "_res" in out ? out._res : null;

						if (response_code === 301 || response_code === 302) {
							// Handle redirects
							ctr.status(response_code);
							if (headers) {
								headers.forEach(({ key, value }) => {
									ctr.headers.set(key, value);
								});
							}
							const link = "_location" in out ? out._location : "/";
							return ctr.redirect(link);
						}

						ctr.status(response_code || 200);

						if (headers) {
							headers.forEach(({ key, value }) => {
								ctr.headers.set(key, value);
							});
						}

						if (response) {
							return ctr.print(response);
						} else {
							return ctr.print("No Function Result :(");
						}
					}
				}

				return ctr.print(result?.result ?? "No Function Result :(");
			}),
	)
	.http("POST", "/api/function/{id}/pip-install", (http) =>
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

			// Is this even a Python function?
			if (!functionData.image.startsWith("python")) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Pip install is only available for Python functions",
				});
			}

			const files = await prisma.functionFile.findMany({
				where: {
					functionId: functionData.id,
				},
			});
			if (!files || files.length === 0) {
				return ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "Function has no files",
				});
			}

			// Does the function have a requirements.txt file?
			const hasRequirements = files.find(
				(file) =>
					file.name.toLowerCase() === "requirements.txt" ||
					file.name.toLowerCase().endsWith("/requirements.txt"),
			);
			if (!hasRequirements) {
				return ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "Function has no requirements.txt file",
				});
			}

			// Try to install dependencies
			try {
				const result = await installDependencies(functionId, functionData, files);

				if (result === 404) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message:
							"Function has not been executed yet. Run it first and it will install dependencies automatically on its first ever run! After that, use Pip Install to update dependencies, if you have modified the requirements.txt file.",
					});
				} else if (result === false) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Could not install dependencies or find requirements.txt!",
					});
				}

				return ctr.print({
					status: "OK",
				});
			} catch (error: any) {
				if (error.message === "Timeout") {
					return ctr.status(ctr.$status.REQUEST_TIMEOUT).print({
						status: 408,
						message: "Pip install timed out",
					});
				}
				return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
					status: 500,
					message: "Failed to install dependencies",
					error: error.message,
				});
			}
		}),
	)
	// New route to GET/PATCH CORS origins for a function
	.http("GET", "/api/function/{id}/cors-origins", (http) =>
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

			const fn = await prisma.function.findFirst({
				where: {
					id: functionId,
					userId: authCheck.user.id,
				},
				select: { cors_origins: true },
			});
			if (!fn) {
				return ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "Function not found",
				});
			}
			return ctr.print({
				status: "OK",
				cors_origins: fn.cors_origins,
			});
		}),
	)
	.http("PATCH", "/api/function/{id}/cors-origins", (http) =>
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

			const fn = await prisma.function.findFirst({
				where: {
					id: functionId,
					userId: authCheck.user.id,
				},
			});
			if (!fn) {
				return ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "Function not found",
				});
			}

			await prisma.function.update({
				where: { id: functionId },
				data: { cors_origins: data.cors_origins },
			});

			return ctr.print({
				status: "OK",
				cors_origins: data.cors_origins,
			});
		}),
	);
