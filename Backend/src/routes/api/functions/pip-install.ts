import { functionAccessWhere } from "../../../lib/Sharing";
import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { OpenAPITags } from "../../../lib/openapi";
import {
	getDependencyInstallStatus,
	startDependencyInstall,
} from "../../../lib/DependencyInstall";
import { getFunctionAppDir } from "../../../lib/StoragePaths";
import * as fsSync from "fs";
import * as path from "path";

export = new fileRouter.Path("/")
	.http("GET", "/api/function/{id}/pip-install", (http) =>
		http
			.document({
				description:
					"Get the status of the latest dependency installation for a function",
				tags: ["Functions"] as OpenAPITags[],
				operationId: "getFunctionDependencyInstallStatus",
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
						description: "Install status fetched successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										job: {
											type: "object",
											nullable: true,
											properties: {
												id: { type: "integer" },
												status: {
													type: "string",
													enum: ["running", "succeeded", "failed"],
												},
												message: { type: "string", nullable: true },
												startedAt: { type: "string" },
												finishedAt: { type: "string", nullable: true },
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
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						code: "AUTHENTICATION_REQUIRED",
						message: "Your session could not be verified. Sign in and try again.",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						id: functionId,
						...functionAccessWhere(authCheck.user.id, "view"),
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
					job: await getDependencyInstallStatus(functionId),
				});
			}),
	)
	.http("POST", "/api/function/{id}/pip-install", (http) =>
		http
			.document({
				description:
					"Start installing Python dependencies for a function using requirements.txt",
				tags: ["Functions"] as OpenAPITags[],
				operationId: "pipInstallFunctionDependencies",
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
					202: {
						description: "Dependency installation started",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										job: {
											type: "object",
											properties: {
												id: { type: "integer" },
												status: {
													type: "string",
													enum: ["running", "succeeded", "failed"],
												},
												message: { type: "string", nullable: true },
												startedAt: { type: "string" },
												finishedAt: { type: "string", nullable: true },
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
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						code: "AUTHENTICATION_REQUIRED",
						message: "Your session could not be verified. Sign in and try again.",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						id: functionId,
						...functionAccessWhere(authCheck.user.id, "edit"),
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

				const files = functionData.git_url
					? []
					: await prisma.functionFile.findMany({
							where: {
								functionId: functionData.id,
							},
						});
				if (!functionData.git_url && (!files || files.length === 0)) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function has no files",
					});
				}

				const hasRequirements = functionData.git_url
					? fsSync.existsSync(path.join(getFunctionAppDir(functionId), "requirements.txt"))
					: files.some((file) => file.name === "requirements.txt");
				if (!hasRequirements) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function has no requirements.txt file",
					});
				}

				try {
					const job = await startDependencyInstall(
						functionId,
						functionData,
						files,
					);

					return ctr.status(ctr.$status.ACCEPTED).print({
						status: "OK",
						job,
					});
				} catch {
					return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
						status: "FAILED",
						code: "DEPENDENCY_ERROR",
						message: "Dependencies could not be installed. Check requirements.txt and the function logs, then try again.",
					});
				}
			}),
	);
