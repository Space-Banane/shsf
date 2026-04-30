import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import {
	buildAccountFunctionAnalytics,
	buildSingleFunctionAnalytics,
	getAnalyticsRangeStart,
	normalizeAnalyticsRange,
} from "../../../lib/FunctionAnalytics";

export = new fileRouter.Path("/")
	.http("GET", "/api/function-analytics", (http) =>
		http
			.document({
				description: "Get account-wide execution analytics for all functions",
				tags: ["Functions"],
				operationId: "getAccountFunctionAnalytics",
				responses: {
					200: { description: "Analytics response" },
					401: { description: "Unauthorized" },
				},
			})
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);

				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: 401,
						message: authCheck.message,
					});
				}

				const range = normalizeAnalyticsRange(ctr.queries.get("range"));
				const rangeStart = getAnalyticsRangeStart(range);
				const logs = await prisma.triggerLog.findMany({
					where: {
						createdAt: {
							gte: rangeStart,
						},
						function: {
							userId: authCheck.user.id,
						},
					},
					include: {
						function: {
							select: {
								id: true,
								name: true,
							},
						},
					},
					orderBy: {
						createdAt: "desc",
					},
				});

				return ctr.print({
					status: "OK",
					...buildAccountFunctionAnalytics(logs, range),
				});
			}),
	)
	.http("GET", "/api/function/{id}/analytics", (http) =>
		http
			.document({
				description: "Get execution analytics for a single function",
				tags: ["Functions"],
				operationId: "getFunctionAnalytics",
				responses: {
					200: { description: "Function analytics response" },
					401: { description: "Unauthorized" },
					404: { description: "Function not found" },
				},
			})
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);

				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: 401,
						message: authCheck.message,
					});
				}

				const id = Number(ctr.params.get("id"));
				if (!Number.isInteger(id) || id <= 0) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: "Invalid function id",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: {
						id,
						userId: authCheck.user.id,
					},
					select: {
						id: true,
						name: true,
					},
				});

				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: 404,
						message: "Function not found",
					});
				}

				const range = normalizeAnalyticsRange(ctr.queries.get("range"));
				const rangeStart = getAnalyticsRangeStart(range);
				const logs = await prisma.triggerLog.findMany({
					where: {
						functionId: functionData.id,
						createdAt: {
							gte: rangeStart,
						},
					},
					include: {
						function: {
							select: {
								id: true,
								name: true,
							},
						},
					},
					orderBy: {
						createdAt: "desc",
					},
				});

				return ctr.print({
					status: "OK",
					range,
					data: buildSingleFunctionAnalytics(
						functionData.id,
						functionData.name,
						logs,
						range,
					),
				});
			}),
	);
