import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../..";
import { checkAuthentication } from "../../lib/Authentication";
import { CronExpressionParser } from "cron-parser";
import { OpenAPITags } from "../../lib/openapi";

async function validateCronExpression(cron: string): Promise<boolean> {
	try {
		CronExpressionParser.parse(cron);
		return true;
	} catch {
		return false;
	}
}

export = new fileRouter.Path("/")
	.http("POST", "/api/functions/{functionId}/triggers", (http) =>
		http
			.document({
				description: "Create a new trigger for a function",
				tags: ["Function Triggers"] as OpenAPITags[],
				operationId: "createFunctionTrigger",
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["name", "cron"],
								properties: {
									name: {
										type: "string",
										description: "Trigger name (max 128 chars)",
									},
									description: {
										type: "string",
										description: "Trigger description (max 256 chars)",
									},
									cron: {
										type: "string",
										description: "Cron expression for scheduling",
									},
									data: {
										type: "string",
										description: "Optional trigger data",
									},
									enabled: {
										type: "boolean",
										description: "Whether the trigger is enabled",
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "Trigger created successfully",
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
						name: z.string().max(128),
						description: z.string().max(256).optional(),
						cron: z.string().max(128),
						data: z.string().optional(),
						enabled: z.boolean().optional(),
					}),
				);

				if (!data) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: error.toString(),
					});
				}

				const id = ctr.params.get("functionId");
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

				const func = await prisma.function.findFirst({
					where: {
						id: functionId,
						userId: authCheck.user.id,
					},
				});

				if (!func) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				// Validate cron expression if provided
				if (data.cron) {
					const isValidCron = await validateCronExpression(data.cron);
					if (!isValidCron) {
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: 400,
							message: "Invalid cron expression",
						});
					}
				}

				const trigger = await prisma.functionTrigger.create({
					data: {
						functionId: func.id,
						name: data.name,
						description: data.description || "",
						cron: data.cron || "{}",
						data: data.data,
						enabled: data.enabled,
					},
				});

				return ctr.print({
					status: "OK",
					data: {
						id: trigger.id,
					},
				});
			}),
	)
	.http("GET", "/api/functions/{functionId}/triggers", (http) =>
		http
			.document({
				description: "List all triggers for a function",
				tags: ["Function Triggers"] as OpenAPITags[],
				operationId: "listFunctionTriggers",
				responses: {
					200: {
						description: "Triggers listed successfully",
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
												// Only basic fields, for brevity
												properties: {
													id: { type: "number" },
													name: { type: "string" },
													description: { type: "string" },
													cron: { type: "string" },
													data: { type: "string" },
													enabled: { type: "boolean" },
													functionId: { type: "number" },
													nextRun: { type: "string", format: "date-time" },
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
					return ctr.print({
						status: 401,
						message: authCheck.message,
					});
				}

				const id = ctr.params.get("functionId");
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
				const func = await prisma.function.findFirst({
					where: {
						id: functionId,
						userId: authCheck.user.id,
					},
				});

				if (!func) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				const triggers = await prisma.functionTrigger.findMany({
					where: {
						functionId: func.id,
					},
				});
				return ctr.print({
					status: "OK",
					data: triggers,
				});
			}),
	)
	.http("GET", "/api/functions/{functionId}/triggers/{triggerId}", (http) =>
		http
			.document({
				description: "Get a specific trigger for a function",
				tags: ["Function Triggers"] as OpenAPITags[],
				operationId: "getFunctionTrigger",
				responses: {
					200: {
						description: "Trigger fetched successfully",
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
												cron: { type: "string" },
												data: { type: "string" },
												enabled: { type: "boolean" },
												functionId: { type: "number" },
												nextRun: { type: "string", format: "date-time" },
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

				const id = ctr.params.get("functionId");
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
				const triggerId = ctr.params.get("triggerId");
				if (!triggerId) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Missing trigger id",
					});
				}
				const triggerIdInt = parseInt(triggerId);
				if (isNaN(triggerIdInt)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid trigger id",
					});
				}
				const func = await prisma.function.findFirst({
					where: {
						id: functionId,
						userId: authCheck.user.id,
					},
				});
				if (!func) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}
				const trigger = await prisma.functionTrigger.findFirst({
					where: {
						id: triggerIdInt,
						functionId: func.id,
					},
				});
				if (!trigger) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Trigger not found",
					});
				}
				return ctr.print({
					status: "OK",
					data: trigger,
				});
			}),
	)
	.http("DELETE", "/api/functions/{functionId}/triggers/{triggerId}", (http) =>
		http
			.document({
				description: "Delete a trigger from a function",
				tags: ["Function Triggers"] as OpenAPITags[],
				operationId: "deleteFunctionTrigger",
				responses: {
					200: {
						description: "Trigger deleted successfully",
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
					return ctr.print({
						status: 401,
						message: authCheck.message,
					});
				}

				const id = ctr.params.get("functionId");
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
				const triggerId = ctr.params.get("triggerId");
				if (!triggerId) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Missing trigger id",
					});
				}
				const triggerIdInt = parseInt(triggerId);
				if (isNaN(triggerIdInt)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid trigger id",
					});
				}
				const func = await prisma.function.findFirst({
					where: {
						id: functionId,
						userId: authCheck.user.id,
					},
				});
				if (!func) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}
				const trigger = await prisma.functionTrigger.findFirst({
					where: {
						id: triggerIdInt,
						functionId: func.id,
					},
				});
				if (!trigger) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Trigger not found",
					});
				}
				await prisma.functionTrigger.delete({
					where: {
						id: trigger.id,
					},
				});
				return ctr.print({
					status: "OK",
					message: "Trigger deleted",
				});
			}),
	)
	.http("PUT", "/api/functions/{functionId}/triggers/{triggerId}", (http) =>
		http
			.document({
				description: "Update a trigger for a function",
				tags: ["Function Triggers"] as OpenAPITags[],
				operationId: "updateFunctionTrigger",
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["name", "cron"],
								properties: {
									name: {
										type: "string",
										description: "Trigger name (max 128 chars)",
									},
									description: {
										type: "string",
										description: "Trigger description (max 256 chars)",
									},
									cron: {
										type: "string",
										description: "Cron expression for scheduling",
									},
									data: {
										type: "string",
										description: "Optional trigger data",
									},
									enabled: {
										type: "boolean",
										description: "Whether the trigger is enabled",
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "Trigger updated successfully",
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
												cron: { type: "string" },
												data: { type: "string" },
												enabled: { type: "boolean" },
												functionId: { type: "number" },
												nextRun: { type: "string", format: "date-time" },
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
						name: z.string().max(128),
						description: z.string().max(256).optional(),
						cron: z.string().max(128),
						data: z.string().optional(),
						enabled: z.boolean().optional(),
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

				const id = ctr.params.get("functionId");
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
				const triggerId = ctr.params.get("triggerId");
				if (!triggerId) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Missing trigger id",
					});
				}
				const triggerIdInt = parseInt(triggerId);
				if (isNaN(triggerIdInt)) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid trigger id",
					});
				}
				const func = await prisma.function.findFirst({
					where: {
						id: functionId,
						userId: authCheck.user.id,
					},
				});
				if (!func) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}
				const trigger = await prisma.functionTrigger.findFirst({
					where: {
						id: triggerIdInt,
						functionId: func.id,
					},
				});
				if (!trigger) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Trigger not found",
					});
				}
				const updatedTrigger = await prisma.functionTrigger.update({
					where: {
						id: trigger.id,
					},
					data: {
						name: data.name,
						description: data.description || "",
						cron: data.cron,
						data: data.data,
						nextRun: null, // Reset nextRun to null when updating the trigger
						enabled: data.enabled,
					},
				});
				return ctr.print({
					status: "OK",
					data: updatedTrigger,
				});
			}),
	);
