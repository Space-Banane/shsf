import { randomUUID } from "crypto";
import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../..";
import { checkAuthentication } from "../../lib/Authentication";
import {
	buildPayloadFromGET,
	buildPayloadFromPOST,
	executeFunction,
} from "../../lib/Runner";
import Docker from "dockerode";
import * as fs from "fs";
import * as path from "path";
import { Readable } from "stream";

const Images: string[] = [
	// Python versions
	"python:2.9",
	"python:3.0",
	"python:3.1",
	"python:3.2",
	"python:3.3",
	"python:3.4",
	"python:3.5",
	"python:3.6",
	"python:3.7",
	"python:3.8",
	"python:3.9",
	"python:3.10",
	"python:3.11",
	"python:3.12",
	// Node.js versions
	"node:16",
	"node:17",
	"node:18",
	"node:19",
	"node:20",
	"node:21",
	"node:22",
];

export = new fileRouter.Path("/")
	.http("POST", "/api/function", (http) =>
		http.onRequest(async (ctr) => {
			const [data, error] = await ctr.bindBody((z) =>
				z.object({
					name: z.string().min(1).max(128),
					description: z.string().min(3).max(128),
					image: z.enum(Images as any),
					startup_file: z.string().min(1).max(256).optional(),
					settings: z
						.object({
							max_ram: z.number().min(128).max(1024).optional(),
							timeout: z.number().positive().min(1).max(300).optional(), // Increased max timeout to 300 seconds : 5 minutes
							allow_http: z.boolean().optional(),
							secure_header: z.string().min(1).max(256).optional(),
							priority: z.number().min(1).max(10).positive().optional(),
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
								.optional()
						)
						.optional(),
					namespaceId: z.number(),
				})
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
				ctr.headers.get(API_KEY_HEADER)
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
					priority: data.settings?.priority,
					retry_on_failure: data.settings?.retry_on_failure,
					max_retries: data.settings?.retry_count,
					env: data.environment
						? JSON.stringify(
								data.environment.map((env) => ({
									name: env!.name,
									value: env!.value,
								}))
						  )
						: undefined,
					userId: authCheck.user.id,
					executionId: randomUUID(),
				},
			});

			return ctr.print({
				status: "OK",
				data: {
					id: out.id,
				},
			});
		})
	)
	.http("DELETE", "/api/function/{id}", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER)
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

			await prisma.function.delete({
				where: {
					id: functionData.id,
				},
			});
			return ctr.print({
				status: "OK",
				message: "Function deleted",
			});
		})
	)
	.http("GET", "/api/functions", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER)
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
		})
	)
	.http("GET", "/api/function/{id}", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER)
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
		})
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
					settings: z
						.object({
							max_ram: z.number().min(128).max(1024).optional(),
							timeout: z.number().positive().min(1).max(500).optional(),
							allow_http: z.boolean().optional(),
							secure_header: z.string().min(1).max(256).optional().or(z.null()),
							priority: z.number().min(1).max(10).positive().optional().default(7),
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
								.optional()
						)
						.optional(),
				})
			);

			if (!data) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: error.toString(),
				});
			}

			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER)
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
				...(data.settings?.priority && {
					priority: data.settings.priority,
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
						}))
					),
				}),
			};

			const updatedFunction = await prisma.function.update({
				where: {
					id: functionId,
				},
				data: updatedData,
			});

			return ctr.print({
				status: "OK",
				data: updatedFunction,
			});
		})
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
					.optional()
			);

			// Convert run data to string for passing to executeFunction
			const runPayload = JSON.stringify({
				body: runData?.run || {},
				headers: Object.fromEntries(ctr.headers.entries()),
				queries: Object.fromEntries(ctr.queries.entries()),
				source_ip: ctr.client.ip.usual(),
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
				ctr.headers.get(API_KEY_HEADER)
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
												})
											);
										},
									},
									runPayload
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
											})
										);
										end();
									})
									.catch(async (error) => {
										// Handle errors
										await print(
											JSON.stringify({
												type: "error",
												error: error.message || "Execution failed",
											})
										);
										end();
									});

								ctr.$abort(() => {
									// Handle abort, nothing specific needed as Runner.ts handles cleanup
									end();
								});
							})
					);
				} else {
					// Synchronous mode
					const result = await executeFunction(
						functionId,
						functionData,
						files,
						{ enabled: false },
						runPayload
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
		})
	)
	.http("GET", "/api/exec/{namespaceId}/{functionId}", (http) =>
		http.onRequest(async (ctr) => {
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
					namespace: {
						select: {
							name: true,
							id: true,
						},
					},
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

			if (functionData.secure_header) {
				if (!ctr.headers.has("x-secure-header")) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "Missing secure header",
					});
				}

				const secureHeader = ctr.headers.get("x-secure-header");
				if (secureHeader !== functionData.secure_header) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "Invalid secure header",
					});
				}
			}

			// Build the payload from GET request
			const payload = await buildPayloadFromGET(ctr);

			// Execute with run parameter instead of inject.json
			const result = await executeFunction(
				functionData.id,
				functionData,
				functionData.files,
				{ enabled: false },
				JSON.stringify(payload)
			);

			// Return result if available from main function, otherwise output OK
			return ctr.print(result?.result ?? "OK");
		})
	)
	.http("POST", "/api/exec/{namespaceId}/{functionId}", (http) =>
		http.onRequest(async (ctr) => {
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
					namespace: {
						select: {
							name: true,
							id: true,
						},
					},
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

			if (functionData.secure_header) {
				if (!ctr.headers.has("x-secure-header")) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "Missing secure header",
					});
				}

				const secureHeader = ctr.headers.get("x-secure-header");
				if (secureHeader !== functionData.secure_header) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "Invalid secure header",
					});
				}
			}

			const payload = await buildPayloadFromPOST(ctr);

			const result = await executeFunction(
				functionData.id,
				functionData,
				functionData.files,
				{ enabled: false },
				JSON.stringify(payload)
			);
			return ctr.print(result?.result ?? "OK");
		})
	)
	.http("DELETE", "/api/function/{id}", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER)
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

			await prisma.function.delete({
				where: {
					id: functionData.id,
				},
			});
			if (functionData.image.startsWith("python:")) {
				fs.rmdirSync(`/tmp/shsf/.cache/pip`, {
					maxRetries: 3,
					recursive: true,
					retryDelay: 1000,
				});
			}
			return ctr.print({
				status: "OK",
				message: "Function deleted",
			});
		})
	);
