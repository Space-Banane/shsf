import { functionAccessWhere } from "../../../lib/Sharing";
import { fileRouter, prisma } from "../../..";
import { executeFunction } from "../../../lib/Runner";
import { buildStreamCacheHitEvents, getFunctionCache, getPayloadHash, handleFunctionResult, setFunctionCache, shouldStoreFunctionCache } from "../../../lib/Caching";
import { OpenAPITags } from "../../../lib/openapi";
import { getExternalAccessDisabled } from "../../../lib/DataManager";
import { createLogger } from "../../../lib/logger";

const log = createLogger("functions/execute");

export = new fileRouter.Path("/")
	.http("POST", "/api/function/{id}/execute", (http) =>
		http
			.document({
				description:
					"Execute a function. Cache is applied to streaming and non-stream executions when cache_enabled is true.",
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
							"When false, returns a single response. Caching applies to both modes when configured.",
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

				const authCheck = ctr.getAuth();

				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						code: "AUTHENTICATION_REQUIRED",
						message: "Your session could not be verified. Sign in and try again.",
					});
				}

				// Block API-key-based executions when external access is disabled
				if (authCheck.method === "apiKey" && await getExternalAccessDisabled()) {
					return ctr.status(ctr.$status.FORBIDDEN).print({
						status: 403,
						message: "External function access has been disabled by the instance administrator.",
					});
				}

				// Shared functions run as their owner; the caller only needs execute access.
				const functionData = await prisma.function.findFirst({
					where: { id: functionId, ...functionAccessWhere(authCheck.user.id, "execute") },
				});
				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
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

				if (functionData.cache_enabled) {
					const cached = await getFunctionCache(functionData.id, payloadHash);
					if (cached) {
						const cachedResult = JSON.parse(cached.result);
						if (streamMode) {
							ctr.headers.set("X-SHSF-Cache", "HIT");
							return ctr.printChunked(async (print) => {
								for (const event of buildStreamCacheHitEvents(cachedResult)) {
									await print(JSON.stringify(event));
								}
							});
						}
						return handleFunctionResult(ctr, cachedResult, true);
					}
				}

				try {
					if (streamMode) {
						if (functionData.cache_enabled) {
							ctr.headers.set("X-SHSF-Cache", "MISS");
						}
						return ctr.printChunked((print) =>
							new Promise<void>((end) => {
								let output = "";
								const abortController = new AbortController();
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
									{ signal: abortController.signal },
								)
									.then(async (result) => {
										if (result?.error_type === "function_timeout") {
											await print(JSON.stringify({
												type: "error",
												code: "FUNCTION_TIMEOUT",
												error: "The function exceeded its configured execution timeout. Check its logs or increase the timeout in function settings.",
											}));
											end();
											return;
										}
										if (result?.error_type === "internal_error") {
											await print(JSON.stringify({
												type: "error",
												code: "SERVER_ERROR",
												error: "SHSF could not complete the execution. Check the server logs and try again.",
											}));
											end();
											return;
										}
										if (result?.error_type) {
											await print(JSON.stringify({
												type: "error",
												code: "FUNCTION_EXECUTION_FAILED",
												error: "The function did not complete successfully. Check its logs, fix the reported error, and try again.",
											}));
											end();
											return;
										}
										if (shouldStoreFunctionCache(functionData, result)) {
											try {
												await setFunctionCache(
													functionData.id,
													payloadHash,
													result.result,
													functionData.cache_ttl,
												);
											} catch (err) {
												log.warn({ err, functionId }, "Failed to cache streaming execution result");
											}
										}
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
									.catch(async () => {
										await print(
											JSON.stringify({
												type: "error",
												code: "SERVER_ERROR",
												error: "SHSF could not complete the execution. Check the function logs and try again.",
											})
										);
										end();
									});

								ctr.$abort(() => {
									abortController.abort();
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
						);

						if (result?.error_type === "function_timeout") {
							return ctr.status(504).print({
								status: "FAILED",
								code: "FUNCTION_TIMEOUT",
								message: "The function exceeded its configured execution timeout. Check its logs or increase the timeout in function settings.",
							});
						}
						if (result?.error_type === "internal_error") {
							return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
								status: "FAILED",
								code: "SERVER_ERROR",
								message: "SHSF could not complete the execution. Check the server logs and try again.",
							});
						}
						if (result?.error_type) {
							return ctr.status(422).print({
								status: "FAILED",
								code: "FUNCTION_EXECUTION_FAILED",
								message: "The function did not complete successfully. Check its logs, fix the reported error, and try again.",
							});
						}

						if (shouldStoreFunctionCache(functionData, result)) {
							await setFunctionCache(
								functionData.id,
								payloadHash,
								result.result,
								functionData.cache_ttl
							);
						}

						return handleFunctionResult(ctr, result?.result, false);
					}
				} catch {
					return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
						status: "FAILED",
						code: "SERVER_ERROR",
						message: "SHSF could not complete the execution. Check the function logs and try again.",
					});
				}
			}),
	);
