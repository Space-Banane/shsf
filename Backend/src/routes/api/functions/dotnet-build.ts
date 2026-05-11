import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { buildDotnetFunction } from "../../../lib/Runner";
import { OpenAPITags } from "../../../lib/openapi";

export = new fileRouter.Path("/").http(
	"POST",
	"/api/function/{id}/dotnet-build",
	(http) =>
		http
			.document({
				description: "Build a .NET function for production-style execution",
				tags: ["Functions"] as OpenAPITags[],
				operationId: "buildDotnetFunction",
				responses: {
					200: {
						description: ".NET build completed successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										message: { type: "string" },
										build_logs: { type: "string" },
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

				if (!functionData.image.startsWith("mcr.microsoft.com/dotnet/sdk:")) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: ".NET build is only available for .NET SDK functions",
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

				try {
					const result = await buildDotnetFunction(functionId, functionData, files);

					if (result.status === "container_missing") {
						return ctr.status(ctr.$status.NOT_FOUND).print({
							status: 404,
							message: "Function runtime container could not be prepared",
						});
					}

					if (result.status === "build_failed") {
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: 400,
							message: result.message,
							...(result.buildLogs
								? { build_logs: result.buildLogs }
								: {}),
						});
					}

					return ctr.print({
						status: "OK",
					});
				} catch (error: any) {
					return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
						status: 500,
						message: "Failed to build .NET function",
						error: error.message,
					});
				}
			}),
);
