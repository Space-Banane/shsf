import { randomUUID } from "crypto";
import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { OpenAPITags } from "../../../lib/openapi";

export = new fileRouter.Path("/")
	.document({
		description:
			"Clone an existing function to a new function, optionally specifying a new name and namespace.",
		tags: ["Functions"] as OpenAPITags[],
		operationId: "cloneFunction",
		requestBody: {
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							name: {
								type: "string",
								description: "Optional new name for the cloned function",
								maxLength: 128,
							},
							namespaceId: {
								type: "number",
								description: "Optional target namespace ID for the cloned function",
							},
						},
					},
				},
			},
		},
		responses: {
			200: {
				description: "Function cloned successfully",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								status: { type: "string" },
								data: {
									type: "object",
									properties: {
										id: {
											type: "number",
											description: "ID of the newly cloned function",
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
	.http("POST", "/api/function/{id}/clone", (http) =>
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

			const [body, bodyErr] = await ctr.bindBody((z) =>
				z
					.object({
						name: z.string().min(1).max(128).optional(),
						namespaceId: z.number().optional(),
					})
					.optional(),
			);

			if (!body && bodyErr) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: bodyErr.toString(),
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
				include: { files: true },
			});
			if (!functionData) {
				return ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "Function not found",
				});
			}

			let targetNamespaceId = functionData.namespaceId;
			if (body?.namespaceId !== undefined) {
				const ns = await prisma.namespace.findFirst({
					where: { id: body.namespaceId, userId: authCheck.user.id },
				});
				if (!ns) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Target namespace not found",
					});
				}
				targetNamespaceId = body.namespaceId;
			}

			let newName = body?.name?.trim() || `${functionData.name}-copy`;
			let exists = await prisma.function.findFirst({
				where: {
					name: newName,
					namespaceId: targetNamespaceId,
					userId: authCheck.user.id,
				},
			});
			let suffix = 1;
			while (exists) {
				newName = `${body?.name?.trim() || functionData.name}-copy-${suffix}`;
				suffix++;
				exists = await prisma.function.findFirst({
					where: {
						name: newName,
						namespaceId: targetNamespaceId,
						userId: authCheck.user.id,
					},
				});
			}

			const created = await prisma.function.create({
				data: {
					name: newName,
					description: functionData.description,
					namespaceId: targetNamespaceId,
					image: functionData.image,
					startup_file: functionData.startup_file,
					tags: functionData.tags,
					allow_http: functionData.allow_http,
					max_ram: functionData.max_ram,
					timeout: functionData.timeout,
					secure_header: functionData.secure_header,
					retry_on_failure: functionData.retry_on_failure,
					max_retries: functionData.max_retries,
					env: functionData.env,
					userId: authCheck.user.id,
					executionId: randomUUID(),
					docker_mount: functionData.docker_mount,
					ffmpeg_install: functionData.ffmpeg_install,
					cors_origins: functionData.cors_origins,
				},
			});

			if (functionData.files && functionData.files.length > 0) {
				for (const f of functionData.files) {
					await prisma.functionFile.create({
						data: {
							name: f.name,
							content: f.content,
							functionId: created.id,
						},
					});
				}
			}

			return ctr.print({
				status: "OK",
				data: {
					id: created.id,
				},
			});
		}),
	);
