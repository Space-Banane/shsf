import * as bcrypt from "bcrypt";
import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { cleanupFunctionContainer } from "../../../lib/Runner";

export = new fileRouter.Path("/")
	.http("GET", "/api/account/export", (http) =>
		http
			.ratelimit((limit) => limit.hits(5).window(60000).penalty(10000))
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);

				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						message: authCheck.message,
					});
				}

				// Get all user data
				const userData = await prisma.user.findUnique({
					where: {
						id: authCheck.user.id,
					},
					include: {
						sessions: {
							select: {
								id: true,
								createdAt: true,
								updatedAt: true,
								// Don't include the hash for security
							},
						},
						functions:{
                            include:{
                                files:true,
                                triggers:true,
                                TriggerLog:true
                            }
                        },
                        namespaces:true
					},
				});

				if (!userData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: "FAILED",
						message: "User not found",
					});
				}

				// Remove sensitive information
				const exportData = {
					user: {
						id: userData.id,
						email: userData.email,
						displayName: userData.displayName,
						avatar_url: userData.avatar_url,
						createdAt: userData.createdAt,
						updatedAt: userData.updatedAt,
					},
                    functions: userData.functions,
                    namespaces: userData.namespaces,
					sessions: userData.sessions,
					exportedAt: new Date().toISOString(),
					exportVersion: "1.0",
				};

				// Set headers for file download
				ctr.headers.set("Content-Type", "application/json");
				ctr.headers.set("Content-Disposition", `attachment; filename="shsf-account-export-${new Date().toISOString().split('T')[0]}.json"`);

				return ctr.print(exportData);
			})
	)
	.http("DELETE", "/api/account/delete", (http) =>
		http
			.ratelimit((limit) => limit.hits(2).window(60000).penalty(5000))
			.onRequest(async (ctr) => {
				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						password: z.string().min(8).max(120),
						confirmation: z.literal("DELETE_MY_ACCOUNT")
					})
				);

				if (!data)
					return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);

				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						message: authCheck.message,
					});
				}

				// Verify password
				if (!authCheck.user.password) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "FAILED",
						message: "No password set for this account",
					});
				}

				const passwordMatch = await bcrypt.compare(data.password, authCheck.user.password);

				if (!passwordMatch) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						message: "Invalid password",
					});
				}

				// Delete all functions and their data
				const userFunctions = await prisma.function.findMany({
					where: {
						userId: authCheck.user.id,
					},
					select: {
						id: true,
					},
				});
				
				const functionIds = userFunctions.map((f) => f.id);
				for (const functionId of functionIds) {
					// Clean up Docker container; Also deletes function files
					await cleanupFunctionContainer(functionId);
				}

				// Delete the user; This deletes all related data due to cascading
				await prisma.user.delete({
					where: {
						id: authCheck.user.id,
					},
				});

				// Clear the cookie
				ctr.cookies.delete(COOKIE);

				return ctr.print({
					status: "OK",
					message: "Account deleted successfully",
				});
			})
	);
