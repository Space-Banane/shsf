import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../../";
import { checkAuthentication } from "../../../lib/Authentication";
import { OpenAPITags } from "../../../lib/openapi";

export = new fileRouter.Path("/")
	.http("POST", "/api/functions/replace/findings", (http) =>
		http
			.document({
				description:
					"Find potential replacements across all functions (ignoring those with git_url)",
				tags: ["Functions"] as OpenAPITags[],
				operationId: "getMassReplaceFindings",
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["find", "replace"],
								properties: {
									find: {
										type: "string",
										description: "The string to find",
									},
									replace: {
										type: "string",
										description: "The string to replace it with",
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "List of findings retrieved successfully",
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
													fileId: { type: "number" },
													fileName: { type: "string" },
													functionName: { type: "string" },
													matches: {
														type: "array",
														items: {
															type: "object",
															properties: {
																lineNumber: { type: "number" },
																oldLine: { type: "string" },
																newLine: { type: "string" },
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

				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						find: z.string().min(1),
						replace: z.string(),
					}),
				);

				if (!data) {
					return ctr.print({
						status: 400,
						message: "Invalid request body",
						error: error,
					});
				}

				try {
					// Get all function files for functions NOT having a git_url and belonging to the user
					const functionFiles = await prisma.functionFile.findMany({
						where: {
							function: {
								userId: authCheck.user!.id,
								git_url: null,
							},
							content: {
								contains: data.find,
							},
						},
						include: {
							function: {
								select: {
									name: true,
								},
							},
						},
					});

					const findings = functionFiles.map((file) => {
						const lines = file.content.split("\n");
						const matchedLines = lines
							.map((line, index) => {
								if (line.includes(data.find)) {
									return {
										lineNumber: index + 1,
										oldLine: line,
										newLine: line.replaceAll(data.find, data.replace),
									};
								}
								return null;
							})
							.filter((e): e is NonNullable<typeof e> => e !== null);

						return {
							fileId: file.id,
							fileName: file.name,
							functionName: file.function.name,
							matches: matchedLines,
						};
					});

					return ctr.print({
						status: "OK",
						data: findings,
					});
				} catch (err: any) {
					return ctr.print({
						status: 500,
						message: "Internal server error during search",
						error: err.message,
					});
				}
			}),
	)
	.http("POST", "/api/functions/replace", (http) =>
		http
			.document({
				description:
					"Mass string find and replace across all functions (ignoring those with git_url)",
				tags: ["Functions"] as OpenAPITags[],
				operationId: "massReplace",
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["find", "replace"],
								properties: {
									find: {
										type: "string",
										description: "The string to find",
									},
									replace: {
										type: "string",
										description: "The string to replace it with",
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "Mass replacement completed successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										message: { type: "string" },
										affectedFiles: { type: "number" },
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

				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						find: z.string().min(1),
						replace: z.string(),
					}),
				);

				if (!data) {
					return ctr.print({
						status: 400,
						message: "Invalid request body",
						error: error,
					});
				}

				try {
					// Get all function files for functions NOT having a git_url and belonging to the user
					const functionFiles = await prisma.functionFile.findMany({
						where: {
							function: {
								userId: authCheck.user!.id,
								git_url: null,
							},
							content: {
								contains: data.find,
							},
						},
					});

					let affectedFiles = 0;
					for (const file of functionFiles) {
						const updatedContent = file.content.replaceAll(data.find, data.replace);
						if (updatedContent !== file.content) {
							await prisma.functionFile.update({
								where: { id: file.id },
								data: { content: updatedContent },
							});
							affectedFiles++;
						}
					}

					return ctr.print({
						status: "OK",
						message: `Replacement completed. ${affectedFiles} file${affectedFiles !== 1 ? "s" : ""} affected.`,
						affectedFiles: affectedFiles,
					});
				} catch (err: any) {
					return ctr.print({
						status: 500,
						message: "Internal server error during mass replacement",
						error: err.message,
					});
				}
			}),
	);
