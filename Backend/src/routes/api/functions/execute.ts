import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { executeFunction } from "../../../lib/Runner";
import {
	getFunctionCache,
	getPayloadHash,
	handleFunctionResult,
	setFunctionCache,
} from "../../../lib/Caching";
import { OpenAPITags } from "../../../lib/openapi";
import { getExternalAccessDisabled } from "../../../lib/DataManager";

export = new fileRouter.Path("/")
	.http("POST", "/api/function/{id}/execute", (http) =>
		http
			.document({
				description:
					"Execute a function. Cache is applied only for non-stream executions when cache_enabled is true.",
				tags: ["Functions"] as OpenAPITags[],
				operationId: "executeFunction",
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "number" },
						description: "Function ID",
					},
					{
						name: "stream",
						in: "query",
						required: false,
						schema: { type: "string", enum: ["true", "false"], default: "true" },
						description:
							"When false, returns a single response and enables cache lookup/write if caching is configured.",
					},
				],
				requestBody: {
					required: false,
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									run: {
										type: "object",
										description: "Execution payload forwarded to the runtime",
										additionalProperties: true,
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description:
							"Execution output. In stream mode this is chunked output; in non-stream mode this is the final result.",
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

				const [runData] = await ctr.bindBody((z) =>
					z
						.object({
							run: z.any().optional(),
						})
						.optional()
				);

				const runPayload = {
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
				};

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

				// Block API-key-based executions when external access is disabled
				if (authCheck.method === "apiKey" && await getExternalAccessDisabled()) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "External function access has been disabled by the instance administrator.",
					});
				}

				if (functionData.userId !== authCheck.user.id) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "You do not have access to this function",
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

				const streamMode = ctr.queries.get("stream") !== "false";
				const payloadHash = getPayloadHash(runPayload);

				if (!streamMode && functionData.cache_enabled) {
					const cached = await getFunctionCache(functionData.id, payloadHash);
					if (cached) {
						return handleFunctionResult(ctr, JSON.parse(cached.result), true);
					}
				}

				try {
					if (streamMode) {
						return ctr.printChunked((print) =>
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
											await print(
												JSON.stringify({
													type: "output",
													content: text,
												})
											);
										},
									},
									JSON.stringify({
										ran_by: "user",
										...runPayload,
									}),
									{ mode: "dev_execute" },
								)
									.then(async (result) => {
										await print(
											JSON.stringify({
												type: "end",
												exitCode: result?.exit_code ?? 0,
												output: output,
												result: result?.result,
												took: result?.tooks,
											})
										);
										end();
									})
									.catch(async (error) => {
										await print(
											JSON.stringify({
												type: "error",
												error: error.message || "Execution failed",
											})
										);
										end();
									});

								ctr.$abort(() => {
									end();
								});
							})
						);
					} else {
						const result = await executeFunction(
							functionId,
							functionData,
							files,
							{ enabled: false },
							JSON.stringify({
								ran_by: "user",
								...runPayload,
							}),
							{ mode: "dev_execute" },
						);

						if (functionData.cache_enabled && result?.result) {
							await setFunctionCache(
								functionData.id,
								payloadHash,
								result.result,
								functionData.cache_ttl
							);
						}

						return handleFunctionResult(ctr, result?.result, false);
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
	);
