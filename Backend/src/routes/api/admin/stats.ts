import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";

export = new fileRouter.Path("/")
	.http("GET", "/api/admin/stats", (http) =>
		http
			.ratelimit((limit) => limit.hits(20).window(60000).penalty(2000))
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);
				if (!authCheck.success) return ctr.status(ctr.$status.UNAUTHORIZED).print({ status: "FAILED", message: authCheck.message });
				if (authCheck.user.role !== "Admin") return ctr.status(ctr.$status.FORBIDDEN).print({ status: "FAILED", message: "Admins only." });

				const now = new Date();
				const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
				const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
				const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

				const [
					totalUsers,
					totalFunctions,
					totalNamespaces,
					totalTriggerLogs,
					recentLogs24h,
					recentLogs7d,
					recentLogs30d,
					ramAggregate,
					functions,
					recentExecutions,
				] = await Promise.all([
					prisma.user.count(),
					prisma.function.count(),
					prisma.namespace.count(),
					prisma.triggerLog.count(),
					prisma.triggerLog.count({ where: { createdAt: { gte: last24h } } }),
					prisma.triggerLog.count({ where: { createdAt: { gte: last7d } } }),
					prisma.triggerLog.count({ where: { createdAt: { gte: last30d } } }),
					prisma.function.aggregate({ _sum: { max_ram: true } }),
					prisma.function.findMany({
						select: {
							id: true,
							name: true,
							image: true,
							max_ram: true,
							timeout: true,
							userId: true,
							_count: { select: { TriggerLog: true } },
						},
					}),
					prisma.triggerLog.findMany({
						orderBy: { createdAt: "desc" },
						take: 50,
						select: {
							id: true,
							functionId: true,
							result: true,
							createdAt: true,
							function: { select: { name: true, image: true } },
						},
					}),
				]);

				// Parse timing data from result JSON
				const executionTimings: { functionId: number; functionName: string; totalSeconds: number; exitCode: number | null }[] = [];
				for (const log of recentExecutions) {
					if (!log.result) continue;
					try {
						const parsed = JSON.parse(log.result) as {
							exit_code?: number | null;
							tooks?: { description: string; value: number }[];
						};
						const totalEntry = parsed.tooks?.find((t) => t.description === "Total");
						executionTimings.push({
							functionId: log.functionId,
							functionName: log.function.name,
							totalSeconds: totalEntry?.value ?? 0,
							exitCode: parsed.exit_code ?? null,
						});
					} catch {
						// skip unparseable
					}
				}

				// Image usage breakdown
				const imageCounts: Record<string, number> = {};
				for (const fn of functions) {
					imageCounts[fn.image] = (imageCounts[fn.image] ?? 0) + 1;
				}

				// Top functions by execution count
				const topFunctions = functions
					.sort((a, b) => b._count.TriggerLog - a._count.TriggerLog)
					.slice(0, 10)
					.map((fn) => ({
						id: fn.id,
						name: fn.name,
						image: fn.image,
						max_ram: fn.max_ram,
						executionCount: fn._count.TriggerLog,
					}));

				// Average execution timing
				const timingsWithData = executionTimings.filter((t) => t.totalSeconds > 0);
				const avgExecutionSeconds =
					timingsWithData.length > 0
						? timingsWithData.reduce((sum, t) => sum + t.totalSeconds, 0) / timingsWithData.length
						: 0;

				const successCount = executionTimings.filter((t) => t.exitCode === 0).length;
				const failureCount = executionTimings.filter((t) => t.exitCode !== null && t.exitCode !== 0).length;

				return ctr.print({
					status: "OK",
					stats: {
						overview: {
							totalUsers,
							totalFunctions,
							totalNamespaces,
							totalExecutions: totalTriggerLogs,
							totalRamAllocatedMb: ramAggregate._sum.max_ram ?? 0,
						},
						executions: {
							last24h: recentLogs24h,
							last7d: recentLogs7d,
							last30d: recentLogs30d,
							avgDurationSeconds: Math.round(avgExecutionSeconds * 100) / 100,
							successCount,
							failureCount,
						},
						topFunctions,
						imageBreakdown: imageCounts,
						recentTimings: executionTimings.slice(0, 20),
					},
				});
			}),
	);
