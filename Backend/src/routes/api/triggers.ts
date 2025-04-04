import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../..";
import { checkAuthentication } from "../../lib/Authentication";

export = new fileRouter.Path("/")
	.http("POST", "/api/functions/{functionId}/triggers", (http) =>
		http.onRequest(async (ctr) => {
			const [data, error] = await ctr.bindBody((z) =>
				z.object({
					name: z.string().min(4).max(128),
					description: z.string().min(4).max(256),
					cron: z.string().max(128).optional(),
					data: z.string().optional(),
				})
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
				ctr.headers.get(API_KEY_HEADER)
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

			const trigger = await prisma.functionTrigger.create({
				data: {
					functionId: func.id,
					name: data.name,
					description: data.description,
					cron: data.cron,
					data: data.data,
				},
			});

			return ctr.print({
				status: "OK",
				data: {
					id: trigger.id,
				},
			});
		})
	)
	.http("GET", "/api/functions/{functionId}/triggers", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER)
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
		})
	)
    .http("GET", "/api/functions/{functionId}/triggers/{triggerId}", (http) =>
        http.onRequest(async (ctr) => {
            const authCheck = await checkAuthentication(
                ctr.cookies.get(COOKIE),
                ctr.headers.get(API_KEY_HEADER)
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
        })
    )
    .http("DELETE", "/api/functions/{functionId}/triggers/{triggerId}", (http) =>
        http.onRequest(async (ctr) => {
            const authCheck = await checkAuthentication(
                ctr.cookies.get(COOKIE),
                ctr.headers.get(API_KEY_HEADER)
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
        })
    )
    .http("PUT", "/api/functions/{functionId}/triggers/{triggerId}", (http) =>
        http.onRequest(async (ctr) => {
            const [data, error] = await ctr.bindBody((z) =>
                z.object({
                    name: z.string().min(4).max(128),
                    description: z.string().min(4).max(256),
                    cron: z.string().max(128).optional(),
                    data: z.string().optional(),
                })
            );

            if (!data) {
                return ctr.status(ctr.$status.BAD_REQUEST).print({
                    status: 400,
                    message: error.toString(),
                });
            }

            const authCheck = await checkAuthentication(
                ctr.cookies.get(COOKIE),
                ctr.headers.get(API_KEY_HEADER)
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
                    description: data.description,
                    cron: data.cron,
                    data: data.data,
                    nextRun:null, // Reset nextRun to null when updating the trigger
                },
            });
            return ctr.print({
                status: "OK",
                data: updatedTrigger,
            });
        })
    );
