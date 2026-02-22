import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { executeFunction } from "../../../lib/Runner";

export = new fileRouter.Path("/")
	.http("POST", "/api/function/{id}/execute", (http) =>
		http
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
						.optional(),
				);

				const runPayload = JSON.stringify({
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

				const streamMode = ctr.queries.get("stream") !== "false";

				try {
					if (streamMode) {
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
												await print(
													JSON.stringify({
														type: "output",
														content: text,
													}),
												);
											},
										},
										JSON.stringify({
											ran_by: "user",
											...(typeof runPayload === "object" && runPayload !== null
												? runPayload
												: {}),
										}),
									)
										.then(async (result) => {
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
											await print(
												JSON.stringify({
													type: "error",
													error: error.message || "Execution failed",
												}),
											);
											end();
										});

									ctr.$abort(() => {
										end();
									});
								}),
						);
					} else {
						const result = await executeFunction(
							functionId,
							functionData,
							files,
							{ enabled: false },
							JSON.stringify({
								ran_by: "user",
								...(typeof runPayload === "object" && runPayload !== null
									? runPayload
									: {}),
							}),
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
	);
