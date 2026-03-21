import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import {
	getLoggingConfigFromData,
	LoggingConfig,
	setLoggingConfig,
} from "../../../lib/FunctionLogging";
import { OpenAPITags } from "../../../lib/openapi";

export = new fileRouter.Path("/")
	// GET /api/function/{id}/logging — Get logging configuration for a function
	.http("GET", "/api/function/{id}/logging", (http) =>
		http
			.document({
				description: "Get logging configuration for a function",
				tags: ["Functions"] as OpenAPITags[],
				operationId: "getFunctionLoggingConfig",
				parameters: [
					{
						in: "path",
						name: "id",
						required: true,
						schema: {
							type: "integer",
						},
						description: "ID of the function",
					},
				],
				responses: {
					200: {
						description: "Logging configuration fetched successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: {
											type: "object",
											properties: {
												enabled: { type: "boolean" },
												hide_payload_headers: { type: "boolean" },
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
						status: "ERROR",
						message: "Unauthorized",
					});
				}

				const id = ctr.params.get("id");
				if (!id || isNaN(parseInt(id))) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "ERROR",
						message: "Invalid function ID",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: { id: parseInt(id), userId: authCheck.user.id },
				});
				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: "ERROR",
						message: "Function not found",
					});
				}

				const config = await getLoggingConfigFromData(functionData.logging);

				return ctr.print({
					status: "OK",
					data: {
						enabled: config.enabled,
						hide_payload_headers:
							config.enabled && config.hide_payload_headers
								? config.hide_payload_headers
								: false,
					},
				});
			}),
	)

	// PATCH /api/function/{id}/logging — Update logging configuration for a function
	.http("PATCH", "/api/function/{id}/logging", (http) =>
		http
			.document({
				description: "Update logging configuration for a function",
				tags: ["Functions"] as OpenAPITags[],
				operationId: "updateFunctionLoggingConfig",
                parameters: [
					{
						in: "path",
						name: "id",
						required: true,
						schema: {
							type: "integer",
						},
						description: "ID of the function",
					},
				],
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									enabled: { type: "boolean" },
									hide_payload_headers: { type: "boolean" },
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "Logging configuration updated successfully",
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
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);
				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "ERROR",
						message: "Unauthorized",
					});
				}

				const [body] = await ctr.bindBody((z) =>
					z.object({
						enabled: z.boolean().optional(),
						hide_payload_headers: z.boolean().optional(),
					}),
				);

				if (!body) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "ERROR",
						message: "Invalid request body",
					});
				}

				const id = ctr.params.get("id");
				if (!id || isNaN(parseInt(id))) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "ERROR",
						message: "Invalid function ID",
					});
				}
				const functionId = parseInt(id);

				const functionData = await prisma.function.findFirst({
					where: { id: functionId, userId: authCheck.user.id },
				});
				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: "ERROR",
						message: "Function not found",
					});
				}

				const currentConfig = await getLoggingConfigFromData(functionData.logging);

				const newConfig: LoggingConfig =
					body.enabled === false
						? { enabled: false }
						: {
								enabled: true,
								hide_payload_headers:
									body.hide_payload_headers ??
									(currentConfig.enabled ? currentConfig.hide_payload_headers : false),
								logs_last_cleared: currentConfig.enabled
									? currentConfig.logs_last_cleared
									: undefined,
								last_log_deleted: currentConfig.enabled
									? currentConfig.last_log_deleted
									: undefined,
							};

				await setLoggingConfig(functionId, newConfig);

				return ctr.print({
					status: "OK",
					message: "Logging configuration updated successfully",
				});
			}),
	)

	// DELETE /api/function/{id}/logs — Delete all logs for a function
	.http("DELETE", "/api/function/{id}/logs", (http) =>
		http
			.document({
				description: "Delete all logs for a function",
				tags: ["Functions"] as OpenAPITags[],
				operationId: "deleteAllFunctionLogs",
                parameters: [
					{
						in: "path",
						name: "id",
						required: true,
						schema: {
							type: "integer",
						},
						description: "ID of the function",
					},
				],
				responses: {
					200: {
						description: "All logs deleted successfully",
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
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);
				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "ERROR",
						message: "Unauthorized",
					});
				}

				const id = ctr.params.get("id");
				if (!id || isNaN(parseInt(id))) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "ERROR",
						message: "Invalid function ID",
					});
				}
				const functionId = parseInt(id);

				const functionData = await prisma.function.findFirst({
					where: { id: functionId, userId: authCheck.user.id },
				});
				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: "ERROR",
						message: "Function not found",
					});
				}

				await prisma.triggerLog.deleteMany({
					where: { functionId: functionId },
				});

				// Update logs_last_cleared in config
				const currentConfig = await getLoggingConfigFromData(functionData.logging);
				if (currentConfig.enabled) {
					await setLoggingConfig(functionId, {
						...currentConfig,
						logs_last_cleared: new Date(),
					});
				}

				return ctr.print({
					status: "OK",
					message: "All logs deleted successfully",
				});
			}),
	)

	// DELETE /api/function/{id}/logs/{logId} — Delete a specific log by ID
	.http("DELETE", "/api/function/{id}/logs/{logId}", (http) =>
		http
			.document({
				description: "Delete a specific log by ID",
				tags: ["Functions"] as OpenAPITags[],
				operationId: "deleteSpecificFunctionLog",
                parameters: [
					{
						in: "path",
						name: "id",
						required: true,
						schema: {
							type: "integer",
						},
						description: "ID of the function",
					},
				],
				responses: {
					200: {
						description: "Log deleted successfully",
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
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);
				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "ERROR",
						message: "Unauthorized",
					});
				}

				const id = ctr.params.get("id");
				const logId = ctr.params.get("logId");
				if (!id || isNaN(parseInt(id)) || !logId || isNaN(parseInt(logId))) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "ERROR",
						message: "Invalid function ID or log ID",
					});
				}
				const functionId = parseInt(id);
				const triggerLogId = parseInt(logId);

				const functionData = await prisma.function.findFirst({
					where: { id: functionId, userId: authCheck.user.id },
				});
				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: "ERROR",
						message: "Function not found",
					});
				}

				const log = await prisma.triggerLog.findFirst({
					where: { id: triggerLogId, functionId: functionId },
				});
				if (!log) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: "ERROR",
						message: "Log not found",
					});
				}

				await prisma.triggerLog.delete({
					where: { id: triggerLogId },
				});

				// Optionally store the last deleted log in config (as per LoggingConfigEnabled interface)
				const currentConfig = await getLoggingConfigFromData(functionData.logging);
				if (currentConfig.enabled) {
					await setLoggingConfig(functionId, {
						...currentConfig,
						last_log_deleted: log,
					});
				}

				return ctr.print({
					status: "OK",
					message: "Log deleted successfully",
				});
			}),
	);
