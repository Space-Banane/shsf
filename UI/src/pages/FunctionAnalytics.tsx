import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { ActionButton } from "../components/buttons/ActionButton";
import { getAccountFunctionAnalytics } from "../services/backend.analytics";
import {
	AccountFunctionAnalyticsResponse,
	AnalyticsPoint,
	AnalyticsRange,
	ExecutionAnalyticsItem,
	FunctionAnalyticsSummary,
} from "../types/Analytics";

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
	{ value: "today", label: "Today" },
	{ value: "7d", label: "7 days" },
	{ value: "30d", label: "30 days" },
	{ value: "90d", label: "90 days" },
];

function formatSeconds(value: number | null) {
	if (value === null || !Number.isFinite(value)) {
		return "N/A";
	}

	if (value < 1) {
		return `${Math.round(value * 1000)} ms`;
	}

	return `${value.toFixed(2)} s`;
}

function formatSourceLabel(source: string) {
	switch (source) {
		case "user":
			return "User";
		case "exec":
			return "HTTP";
		case "trigger":
			return "Trigger";
		case "cron":
			return "Cron";
		case "unknown":
			return "Unknown";
		default:
			return source;
	}
}

function formatBucketLabel(bucketStart: string) {
	return new Date(bucketStart).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

function formatPercent(value: number | null) {
	if (value === null || !Number.isFinite(value)) {
		return "N/A";
	}

	return `${value.toFixed(1)}%`;
}

function formatRateLimitLabel(execution: ExecutionAnalyticsItem) {
	if (!execution.ratelimit?.configured) {
		return "Off";
	}

	const policyPart =
		execution.ratelimit.policyName ?? execution.ratelimit.policyId ?? "Policy";
	const modePart = execution.ratelimit.mode === "observe" ? "Observe" : "Enforce";
	const limitPart =
		typeof execution.ratelimit.limit === "number" &&
		typeof execution.ratelimit.remaining === "number"
			? `${execution.ratelimit.remaining}/${execution.ratelimit.limit} left`
			: execution.ratelimit.identities.length > 0
				? `Identity: ${execution.ratelimit.identities.join(" + ")}`
				: "Configured";

	if (execution.ratelimit.blocked) {
		const retryPart =
			typeof execution.ratelimit.retryAfterMs === "number"
				? `Retry ${Math.max(1, Math.ceil(execution.ratelimit.retryAfterMs / 1000))}s`
				: "Blocked";
		const penaltyPart =
			typeof execution.ratelimit.penaltyMs === "number" &&
			execution.ratelimit.penaltyMs > 0
				? `, +${execution.ratelimit.penaltyMs}ms`
				: "";
		return `${policyPart} • ${retryPart}${penaltyPart}`;
	}

	if (execution.ratelimit.mode === "observe" || execution.ratelimit.wouldBlock) {
		return `${policyPart} • ${modePart} • ${limitPart}`;
	}

	return `${policyPart} • ${limitPart}`;
}

function getRateLimitTone(execution: ExecutionAnalyticsItem) {
	if (!execution.ratelimit?.configured) {
		return "border-primary/10 bg-background/40 text-text/55";
	}

	if (execution.ratelimit.blocked) {
		return "border-amber-500/35 bg-amber-500/10 text-amber-100";
	}

	if (execution.ratelimit.wouldBlock) {
		return "border-orange-500/35 bg-orange-500/10 text-orange-100";
	}

	return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
}

function formatExecutionStatus(execution: ExecutionAnalyticsItem) {
	if (execution.errorType === "rate_limit_blocked") {
		return "Rate Limited";
	}

	if (execution.errorType === "cors_denied") {
		return "CORS Denied";
	}

	if (execution.exitCode === 0) {
		return "Success";
	}

	if (execution.exitCode === null) {
		return "Unknown";
	}

	return `Exit ${execution.exitCode}`;
}

function getSuccessRateForPoint(point: AnalyticsPoint) {
	const total = point.successCount + point.failureCount;
	if (total === 0) {
		return null;
	}

	return Number(((point.successCount / total) * 100).toFixed(1));
}

function buildLinePath(points: { x: number; y: number }[]) {
	if (points.length === 0) {
		return "";
	}

	return points
		.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
		.join(" ");
}

function ChartStat({
	label,
	value,
	tone = "text-text/70",
}: {
	label: string;
	value: string;
	tone?: string;
}) {
	return (
		<div className="rounded-lg border border-primary/10 bg-background/55 px-2.5 py-2">
			<p className="text-[10px] uppercase tracking-[0.16em] text-text/40">{label}</p>
			<p className={`mt-0.5 text-[13px] font-semibold leading-tight ${tone}`}>{value}</p>
		</div>
	);
}

function StatCard({
	label,
	value,
	highlight,
}: {
	label: string;
	value: string;
	highlight?: string;
}) {
	return (
		<div className="bg-background/40 border border-primary/15 rounded-2xl p-4">
			<p className="text-text/55 text-xs uppercase tracking-[0.2em]">{label}</p>
			<p className="text-2xl font-bold text-primary mt-2">{value}</p>
			{highlight ? <p className="text-text/60 text-sm mt-1.5">{highlight}</p> : null}
		</div>
	);
}

function RateLimitScopeCard({
	label,
	value,
	tone,
	help,
}: {
	label: string;
	value: string;
	tone: string;
	help: string;
}) {
	return (
		<div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
			<p className="text-[11px] uppercase tracking-[0.18em] text-text/45">{label}</p>
			<p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
			<p className="mt-1 text-sm text-text/55">{help}</p>
		</div>
	);
}

function LineChart({
	title,
	points,
	valueSelector,
	colorClass,
	stroke,
	valueFormatter = formatSeconds,
	emptyLabel = "No timing data in this range",
}: {
	title: string;
	points: AnalyticsPoint[];
	valueSelector: (point: AnalyticsPoint) => number | null;
	colorClass: string;
	stroke: string;
	valueFormatter?: (value: number | null) => string;
	emptyLabel?: string;
}) {
	const width = 640;
	const height = 190;
	const padding = 20;
	const values = points
		.map(valueSelector)
		.filter((value): value is number => value !== null && Number.isFinite(value));

	if (values.length === 0) {
		return (
			<div className="bg-background/35 border border-primary/10 rounded-2xl p-4">
				<div className="flex items-center justify-between mb-3">
					<h3 className="text-base font-semibold text-primary">{title}</h3>
				</div>
				<div className="h-[190px] flex items-center justify-center text-text/45 text-sm">
					{emptyLabel}
				</div>
			</div>
		);
	}

	const maxValue = Math.max(...values, 1);
	const averageValue =
		values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
	const latestValue = [...points]
		.reverse()
		.map(valueSelector)
		.find((value): value is number => value !== null && Number.isFinite(value));
	const chartPoints = points.map((point, index) => {
		const value = valueSelector(point) ?? 0;
		const x =
			padding +
			(index * (width - padding * 2)) / Math.max(1, points.length - 1);
		const y = height - padding - (value / maxValue) * (height - padding * 2);
		return { x, y, value, label: formatBucketLabel(point.bucketStart) };
	});

	const path = buildLinePath(chartPoints);
	const areaPath = `${path} L ${chartPoints[chartPoints.length - 1].x} ${
		height - padding
	} L ${chartPoints[0].x} ${height - padding} Z`;

	return (
		<div className="bg-background/35 border border-primary/10 rounded-2xl p-4">
			<div className="flex flex-col gap-3 mb-3">
				<div className="flex items-center justify-between gap-4">
					<h3 className="text-base font-semibold text-primary">{title}</h3>
					<span className={`text-sm font-medium ${colorClass}`}>
						Peak {valueFormatter(maxValue)}
					</span>
				</div>
				<div className="grid grid-cols-3 gap-2.5">
					<ChartStat label="Peak" value={valueFormatter(maxValue)} tone={colorClass} />
					<ChartStat
						label="Average"
						value={valueFormatter(averageValue)}
						tone="text-text/85"
					/>
					<ChartStat
						label="Latest"
						value={valueFormatter(latestValue ?? null)}
						tone="text-text/85"
					/>
				</div>
			</div>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				className="w-full h-[190px] overflow-visible"
				role="img"
				aria-label={title}
			>
				<path d={areaPath} fill={stroke} opacity="0.14" />
				<path d={path} fill="none" stroke={stroke} strokeWidth="3" />
				{chartPoints.map((point) => (
					<circle
						key={`${title}-${point.label}`}
						cx={point.x}
						cy={point.y}
						r="4"
						fill={stroke}
					/>
				))}
			</svg>
			<div className="mt-2 flex justify-between text-[11px] text-text/40">
				<span>{chartPoints[0]?.label}</span>
				<span>{chartPoints[chartPoints.length - 1]?.label}</span>
			</div>
		</div>
	);
}

function CountChart({
	title,
	points,
}: {
	title: string;
	points: AnalyticsPoint[];
}) {
	const width = 640;
	const height = 190;
	const padding = 20;
	const maxValue = Math.max(...points.map((point) => point.count), 1);
	const barWidth = (width - padding * 2) / Math.max(points.length, 1) - 8;
	const totalRuns = points.reduce((sum, point) => sum + point.count, 0);
	const averageRuns = totalRuns / Math.max(points.length, 1);
	const busiestPoint = points.reduce(
		(current, point) => (point.count > current.count ? point : current),
		points[0] ?? {
			bucketStart: new Date().toISOString(),
			count: 0,
			avgSeconds: null,
			p95Seconds: null,
			successCount: 0,
			failureCount: 0,
		},
	);

	return (
		<div className="bg-background/35 border border-primary/10 rounded-2xl p-4">
			<div className="flex flex-col gap-3 mb-3">
				<div className="flex items-center justify-between gap-4">
					<h3 className="text-base font-semibold text-primary">{title}</h3>
					<span className="text-sm text-text/55">Runs per day</span>
				</div>
				<div className="grid grid-cols-3 gap-2.5">
					<ChartStat label="Total Runs" value={String(totalRuns)} tone="text-blue-300" />
					<ChartStat
						label="Daily Avg"
						value={averageRuns.toFixed(1)}
						tone="text-text/85"
					/>
					<ChartStat
						label="Busiest"
						value={`${busiestPoint.count} on ${formatBucketLabel(busiestPoint.bucketStart)}`}
						tone="text-text/85"
					/>
				</div>
			</div>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				className="w-full h-[190px]"
				role="img"
				aria-label={title}
			>
				{points.map((point, index) => {
					const barHeight = (point.count / maxValue) * (height - padding * 2);
					const x = padding + index * ((width - padding * 2) / points.length) + 4;
					const y = height - padding - barHeight;
					return (
						<rect
							key={`${point.bucketStart}-count`}
							x={x}
							y={y}
							width={Math.max(barWidth, 6)}
							height={barHeight}
							rx="8"
							fill="#3b82f6"
							opacity={point.count === 0 ? 0.2 : 0.85}
						/>
					);
				})}
			</svg>
			<div className="mt-2 flex justify-between text-[11px] text-text/40">
				<span>{formatBucketLabel(points[0]?.bucketStart || new Date().toISOString())}</span>
				<span>
					{formatBucketLabel(
						points[points.length - 1]?.bucketStart || new Date().toISOString(),
					)}
				</span>
			</div>
		</div>
	);
}

function SuccessFailureChart({ points }: { points: AnalyticsPoint[] }) {
	const width = 640;
	const height = 190;
	const padding = 20;
	const maxValue = Math.max(
		...points.map((point) => point.successCount + point.failureCount),
		1,
	);
	const barWidth = (width - padding * 2) / Math.max(points.length, 1) - 8;
	const successCount = points.reduce((sum, point) => sum + point.successCount, 0);
	const failureCount = points.reduce((sum, point) => sum + point.failureCount, 0);
	const classifiedCount = successCount + failureCount;
	const successRate =
		classifiedCount > 0 ? (successCount / classifiedCount) * 100 : null;

	return (
		<div className="bg-background/35 border border-primary/10 rounded-2xl p-4">
			<div className="flex flex-col gap-3 mb-3">
				<div className="flex items-center justify-between gap-4">
					<h3 className="text-base font-semibold text-primary">Success vs Failure</h3>
					<div className="flex items-center gap-4 text-xs text-text/55">
						<span className="flex items-center gap-2">
							<span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
							Success
						</span>
						<span className="flex items-center gap-2">
							<span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
							Failure
						</span>
					</div>
				</div>
				<div className="grid grid-cols-3 gap-2.5">
					<ChartStat
						label="Successes"
						value={String(successCount)}
						tone="text-emerald-300"
					/>
					<ChartStat
						label="Failures"
						value={String(failureCount)}
						tone="text-rose-300"
					/>
					<ChartStat
						label="Hit Rate"
						value={formatPercent(successRate)}
						tone="text-text/85"
					/>
				</div>
			</div>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				className="w-full h-[190px]"
				role="img"
				aria-label="Success vs Failure"
			>
				{points.map((point, index) => {
					const total = point.successCount + point.failureCount;
					const totalHeight = (total / maxValue) * (height - padding * 2);
					const successHeight =
						total > 0 ? (point.successCount / total) * totalHeight : 0;
					const failureHeight =
						total > 0 ? (point.failureCount / total) * totalHeight : 0;
					const x = padding + index * ((width - padding * 2) / points.length) + 4;
					const y = height - padding - totalHeight;
					return (
						<g key={`${point.bucketStart}-sf`}>
							<rect
								x={x}
								y={y}
								width={Math.max(barWidth, 6)}
								height={successHeight}
								rx="8"
								fill="#34d399"
								opacity={point.successCount === 0 ? 0.15 : 0.9}
							/>
							<rect
								x={x}
								y={y + successHeight}
								width={Math.max(barWidth, 6)}
								height={failureHeight}
								rx="8"
								fill="#fb7185"
								opacity={point.failureCount === 0 ? 0.15 : 0.9}
							/>
						</g>
					);
				})}
			</svg>
			<div className="mt-2 flex justify-between text-[11px] text-text/40">
				<span>{formatBucketLabel(points[0]?.bucketStart || new Date().toISOString())}</span>
				<span>
					{formatBucketLabel(
						points[points.length - 1]?.bucketStart || new Date().toISOString(),
					)}
				</span>
			</div>
		</div>
	);
}

function RecentExecutionRow({ execution }: { execution: ExecutionAnalyticsItem }) {
	return (
		<tr className="border-t border-primary/8">
			<td className="py-2.5 pr-4 text-sm text-text/75">
				{new Date(execution.createdAt).toLocaleString()}
			</td>
			<td className="py-2.5 pr-4 text-sm text-text/60">
				{formatSourceLabel(execution.source)}
			</td>
			<td className="py-2.5 pr-4 text-sm text-text/75">
				{formatSeconds(execution.totalSeconds)}
			</td>
			<td className="py-2.5 pr-4 text-sm">
				<span
					className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold border ${getRateLimitTone(
						execution,
					)}`}
				>
					{formatRateLimitLabel(execution)}
				</span>
			</td>
			<td className="py-2.5 text-sm">
				<span
					className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold border ${
						execution.exitCode === 0 && !execution.errorType
							? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
							: "border-rose-500/30 bg-rose-500/10 text-rose-300"
					}`}
				>
					{formatExecutionStatus(execution)}
				</span>
			</td>
		</tr>
	);
}

function FunctionAnalyticsCard({
	data,
	expanded,
	onToggle,
}: {
	data: FunctionAnalyticsSummary;
	expanded: boolean;
	onToggle: () => void;
}) {
	return (
		<div className="border border-primary/12 rounded-2xl overflow-hidden bg-background/30">
			<button
				onClick={onToggle}
				className="w-full px-5 py-4 text-left hover:bg-primary/5 transition-colors"
			>
				<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
					<div>
						<div className="flex items-center gap-3">
							<h3 className="text-lg font-bold text-primary">{data.functionName}</h3>
							<Link
								to={`/functions/${data.functionId}`}
								className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200 transition-colors hover:border-cyan-300/50 hover:bg-cyan-400/20 hover:text-cyan-100"
								onClick={(event) => event.stopPropagation()}
							>
								<span aria-hidden="true">↗</span>
								Open in Editor
							</Link>
						</div>
						<p className="text-text/55 text-sm mt-1">
							Last run:{" "}
							{data.lastRunAt
								? new Date(data.lastRunAt).toLocaleString()
								: "No runs in range"}
						</p>
					</div>

					<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3 lg:min-w-[840px]">
						<div>
							<p className="text-text/45 text-xs uppercase tracking-[0.18em]">Runs</p>
							<p className="text-base font-semibold text-white mt-1">{data.totalRuns}</p>
						</div>
						<div>
							<p className="text-text/45 text-xs uppercase tracking-[0.18em]">Success</p>
							<p className="text-base font-semibold text-white mt-1">
								{data.successRate.toFixed(1)}%
							</p>
						</div>
						<div>
							<p className="text-text/45 text-xs uppercase tracking-[0.18em]">Avg</p>
							<p className="text-base font-semibold text-white mt-1">
								{formatSeconds(data.avgSeconds)}
							</p>
						</div>
						<div>
							<p className="text-text/45 text-xs uppercase tracking-[0.18em]">P95</p>
							<p className="text-base font-semibold text-white mt-1">
								{formatSeconds(data.p95Seconds)}
							</p>
						</div>
						<div>
							<p className="text-text/45 text-xs uppercase tracking-[0.18em]">RL Runs</p>
							<p className="text-base font-semibold text-white mt-1">
								{data.rateLimitedExecutions}
							</p>
						</div>
						<div>
							<p className="text-text/45 text-xs uppercase tracking-[0.18em]">RL Blocked</p>
							<p className="text-base font-semibold text-white mt-1">
								{data.rateLimitBlockedExecutions}
							</p>
						</div>
						<div>
							<p className="text-text/45 text-xs uppercase tracking-[0.18em]">Would Block</p>
							<p className="text-base font-semibold text-white mt-1">
								{data.rateLimitWouldBlockExecutions}
							</p>
						</div>
					</div>
				</div>
			</button>

			{expanded ? (
				<div className="border-t border-primary/10 px-5 py-5 space-y-5">
					<div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
						<LineChart
							title="Average Runtime"
							points={data.series}
							valueSelector={(point) => point.avgSeconds}
							colorClass="text-amber-300"
							stroke="#f59e0b"
						/>
						<CountChart title="Execution Volume" points={data.series} />
						<LineChart
							title="P95 Runtime"
							points={data.series}
							valueSelector={(point) => point.p95Seconds}
							colorClass="text-cyan-300"
							stroke="#22d3ee"
						/>
						<LineChart
							title="Success Rate Trend"
							points={data.series}
							valueSelector={getSuccessRateForPoint}
							valueFormatter={formatPercent}
							colorClass="text-emerald-300"
							stroke="#34d399"
							emptyLabel="No classified success or failure data in this range"
						/>
					</div>

					<div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
						<div className="bg-background/35 border border-primary/10 rounded-2xl p-4">
							<h4 className="text-base font-semibold text-primary mb-3">
								Average Phase Timing
							</h4>
							{data.phaseSummary.length === 0 ? (
								<p className="text-text/45 text-sm">No phase timing data yet.</p>
							) : (
								<div className="space-y-2.5">
									{data.phaseSummary.slice(0, 8).map((phase) => (
										<div key={phase.description}>
											<div className="flex items-center justify-between text-sm mb-1">
												<span className="text-text/75">{phase.description}</span>
												<span className="text-primary font-medium">
													{formatSeconds(phase.avgSeconds)}
												</span>
											</div>
											<div className="h-2 rounded-full bg-background/70 overflow-hidden">
												<div
													className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
													style={{
														width: `${Math.min(
															100,
															(phase.avgSeconds /
																(data.phaseSummary[0]?.avgSeconds || 1)) *
																100,
														)}%`,
													}}
												></div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						<div className="bg-background/35 border border-primary/10 rounded-2xl p-4">
							<h4 className="text-base font-semibold text-primary mb-3">
								Recent Executions
							</h4>
							{data.recentExecutions.length === 0 ? (
								<p className="text-text/45 text-sm">No executions in this range.</p>
							) : (
								<div className="overflow-x-auto">
									<table className="min-w-full">
										<thead>
											<tr className="text-left text-text/45 text-xs uppercase tracking-[0.16em]">
												<th className="pb-3 pr-4">Started</th>
												<th className="pb-3 pr-4">Source</th>
												<th className="pb-3 pr-4">Total</th>
												<th className="pb-3 pr-4">Rate Limit</th>
												<th className="pb-3">Status</th>
											</tr>
										</thead>
										<tbody>
											{data.recentExecutions.map((execution) => (
												<RecentExecutionRow
													key={execution.executionId}
													execution={execution}
												/>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}

function FunctionAnalyticsPage() {
	const [range, setRange] = useState<AnalyticsRange>("7d");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [data, setData] = useState<AccountFunctionAnalyticsResponse | null>(null);
	const [expandedFunctionIds, setExpandedFunctionIds] = useState<number[]>([]);

	const loadData = useCallback(async (selectedRange: AnalyticsRange) => {
		setLoading(true);
		setError("");
		try {
			const response = await getAccountFunctionAnalytics(selectedRange);
			if (response.status !== "OK") {
				setError(response.message || "Failed to load analytics");
				return;
			}

			setData(response);
			setExpandedFunctionIds((previous) => {
				return previous.filter((id) =>
					response.functions.some((entry) => entry.functionId === id),
				);
			});
		} catch (loadError) {
			console.error("Failed to load function analytics", loadError);
			setError("Failed to load analytics");
			toast.error("Failed to load analytics");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadData(range);
	}, [loadData, range]);

	const accountHighlights = useMemo(() => {
		if (!data) {
			return [];
		}

		return [
			{
				label: "Total Executions",
				value: String(data.summary.totalExecutions),
				highlight: `${data.summary.functionCount} functions with runs`,
			},
			{
				label: "Success Rate",
				value: `${data.summary.successRate.toFixed(1)}%`,
				highlight: "All sources combined",
			},
			{
				label: "Average Runtime",
				value: formatSeconds(data.summary.avgSeconds),
				highlight: "Across all recorded executions",
			},
			{
				label: "P95 Runtime",
				value: formatSeconds(data.summary.p95Seconds),
				highlight: "Tail latency in the selected range",
			},
			{
				label: "Rate Limited",
				value: String(data.summary.rateLimitedExecutions),
				highlight: "Executions with a configured policy",
			},
			{
				label: "Would Block",
				value: String(data.summary.rateLimitWouldBlockExecutions),
				highlight: "Runs that would have been blocked",
			},
		];
	}, [data]);

	const toggleFunction = (functionId: number) => {
		setExpandedFunctionIds((current) =>
			current.includes(functionId)
				? current.filter((id) => id !== functionId)
				: [...current, functionId],
		);
	};

	return (
		<div className="min-h-screen bg-background">
			<div className="relative bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-b border-primary/20">
				<div className="max-w-7xl mx-auto px-4 py-12">
					<div className="text-center space-y-3">
						<h1 className="text-4xl font-bold text-primary">
							Function Execution Analytics
						</h1>
						<div className="h-1 w-28 bg-gradient-to-r from-blue-500 to-cyan-400 mx-auto rounded-full"></div>
						<p className="text-lg text-text/70 max-w-3xl mx-auto">
							Track runtime health for every function in your account, then drill into
							each function from the same page.
						</p>
					</div>
				</div>
			</div>

			<div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
				<div className="bg-gradient-to-br from-gray-900/55 to-gray-800/45 border border-primary/20 rounded-3xl p-5">
					<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
						<div>
							<h2 className="text-xl font-bold text-primary">Account Overview</h2>
							<p className="text-text/60 mt-1">
								Default range is {RANGE_OPTIONS.find((option) => option.value === range)?.label}.
							</p>
						</div>
						<div className="flex items-center gap-2.5">
							<select
								value={range}
								onChange={(event) => setRange(event.target.value as AnalyticsRange)}
								className="bg-background/70 border border-primary/20 rounded-xl px-3.5 py-2 text-text outline-none"
							>
								{RANGE_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
							<ActionButton
								icon="🔄"
								label="Refresh"
								variant="secondary"
								onClick={() => loadData(range)}
							/>
						</div>
					</div>
				</div>

				{loading ? (
					<div className="text-center py-20">
						<div className="w-14 h-14 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
						<p className="text-text/70 text-lg">Loading analytics...</p>
					</div>
				) : error ? (
					<div className="p-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-center">
						{error}
					</div>
				) : !data ? null : (
					<>
						<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
							{accountHighlights.map((item) => (
								<StatCard
									key={item.label}
									label={item.label}
									value={item.value}
									highlight={item.highlight}
								/>
							))}
						</div>

						<div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
							<RateLimitScopeCard
								label="Blocked by scope"
								value={`${data.summary.rateLimitBlockedByScope.global} global / ${data.summary.rateLimitBlockedByScope.identity} identity`}
								tone="text-amber-200"
								help="Actual rejected HTTP requests grouped by enforcement scope."
							/>
							<RateLimitScopeCard
								label="Would block"
								value={String(data.summary.rateLimitWouldBlockExecutions)}
								tone="text-orange-200"
								help="Observed requests that would have tripped a policy."
							/>
							<RateLimitScopeCard
								label="Configured policies"
								value={String(data.summary.rateLimitedExecutions)}
								tone="text-cyan-200"
								help="Executions carrying rate-limit metadata in the selected range."
							/>
						</div>

						<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
							<div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-gray-900/55 to-gray-800/45 p-5">
								<div className="mb-4">
									<h2 className="text-xl font-bold text-primary">Hot Identity Values</h2>
									<p className="mt-1 text-sm text-text/55">
										Most frequent identity combinations that showed up in rate-limit logs.
									</p>
								</div>
								{data.summary.topRateLimitIdentityValues.length === 0 ? (
									<p className="text-sm text-text/45">No identity metadata recorded yet.</p>
								) : (
									<div className="overflow-x-auto">
										<table className="min-w-full">
											<thead>
												<tr className="text-left text-[11px] uppercase tracking-[0.16em] text-text/45">
													<th className="pb-3 pr-4">Identity</th>
													<th className="pb-3 pr-4">Value</th>
													<th className="pb-3 pr-4">Hits</th>
													<th className="pb-3">Blocked</th>
												</tr>
											</thead>
											<tbody>
												{data.summary.topRateLimitIdentityValues.map((item) => (
													<tr key={`${item.identity}:${item.value}`} className="border-t border-primary/8">
														<td className="py-2.5 pr-4 text-sm text-text/75">{item.identity}</td>
														<td className="py-2.5 pr-4 text-sm text-text/60">{item.value}</td>
														<td className="py-2.5 pr-4 text-sm text-white">{item.count}</td>
														<td className="py-2.5 text-sm text-amber-200">{item.blockedCount}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>

							<div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-gray-900/55 to-gray-800/45 p-5">
								<div className="mb-4">
									<h2 className="text-xl font-bold text-primary">Policy Breakdown</h2>
									<p className="mt-1 text-sm text-text/55">
										Useful when you want to see which policies are actually doing work.
									</p>
								</div>
								<div className="space-y-3">
									<div className="rounded-2xl border border-gray-700/50 bg-background/35 p-4">
										<div className="flex items-center justify-between">
											<div>
												<p className="text-sm font-medium text-white">Blocked executions</p>
												<p className="text-xs text-text/45">Rejected before runtime</p>
											</div>
											<p className="text-2xl font-bold text-amber-200">
												{data.summary.rateLimitBlockedExecutions}
											</p>
										</div>
									</div>
									<div className="rounded-2xl border border-gray-700/50 bg-background/35 p-4">
										<div className="flex items-center justify-between">
											<div>
												<p className="text-sm font-medium text-white">Would-block executions</p>
												<p className="text-xs text-text/45">Observed with observe policies</p>
											</div>
											<p className="text-2xl font-bold text-orange-200">
												{data.summary.rateLimitWouldBlockExecutions}
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
							<CountChart title="Execution Volume" points={data.series} />
							<SuccessFailureChart points={data.series} />
							<LineChart
								title="Average Runtime"
								points={data.series}
								valueSelector={(point) => point.avgSeconds}
								colorClass="text-amber-300"
								stroke="#f59e0b"
							/>
							<LineChart
								title="P95 Runtime"
								points={data.series}
								valueSelector={(point) => point.p95Seconds}
								colorClass="text-cyan-300"
								stroke="#22d3ee"
							/>
							<LineChart
								title="Success Rate Trend"
								points={data.series}
								valueSelector={getSuccessRateForPoint}
								valueFormatter={formatPercent}
								colorClass="text-emerald-300"
								stroke="#34d399"
								emptyLabel="No classified success or failure data in this range"
							/>
						</div>

						<div className="bg-gradient-to-br from-gray-900/55 to-gray-800/45 border border-primary/20 rounded-3xl p-5">
							<div className="flex items-center justify-between gap-4 mb-5">
								<div>
									<h2 className="text-xl font-bold text-primary">Slowest Recent Runs</h2>
									<p className="text-text/55 mt-1">
										Quick view of the heaviest executions in this range.
									</p>
								</div>
							</div>

							{data.slowestExecutions.length === 0 ? (
								<p className="text-text/45">No execution timing data in this range.</p>
							) : (
								<div className="overflow-x-auto">
									<table className="min-w-full">
										<thead>
											<tr className="text-left text-text/45 text-xs uppercase tracking-[0.16em]">
												<th className="pb-3 pr-4">Function</th>
												<th className="pb-3 pr-4">Started</th>
												<th className="pb-3 pr-4">Source</th>
												<th className="pb-3 pr-4">Rate Limit</th>
												<th className="pb-3 pr-4">Runtime</th>
												<th className="pb-3">Status</th>
											</tr>
										</thead>
										<tbody>
											{data.slowestExecutions.map((execution) => (
												<tr
													key={`slow-${execution.executionId}`}
													className="border-t border-primary/8"
												>
													<td className="py-2.5 pr-4">
														<Link
															to={`/functions/${execution.functionId}`}
															className="text-blue-300 hover:text-blue-200"
														>
															{execution.functionName}
														</Link>
													</td>
													<td className="py-2.5 pr-4 text-text/75 text-sm">
														{new Date(execution.createdAt).toLocaleString()}
													</td>
													<td className="py-2.5 pr-4 text-text/60 text-sm uppercase">
														{formatSourceLabel(execution.source)}
													</td>
													<td className="py-2.5 pr-4 text-sm">
														<span
															className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold border ${getRateLimitTone(
																execution,
															)}`}
														>
															{formatRateLimitLabel(execution)}
														</span>
													</td>
													<td className="py-2.5 pr-4 text-primary font-medium text-sm">
														{formatSeconds(execution.totalSeconds)}
													</td>
													<td className="py-2.5">
														<span
															className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold border ${
																execution.exitCode === 0 && !execution.errorType
																	? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
																	: "border-rose-500/30 bg-rose-500/10 text-rose-300"
															}`}
														>
															{formatExecutionStatus(execution)}
														</span>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>

						<div className="bg-gradient-to-br from-gray-900/55 to-gray-800/45 border border-primary/20 rounded-3xl p-5">
							<div className="mb-5">
								<h2 className="text-xl font-bold text-primary">Per-Function Analytics</h2>
								<p className="text-text/55 mt-1">
									Each function has its own detail block in this list. Expand the ones
									you want to inspect.
								</p>
							</div>

							{data.functions.length === 0 ? (
								<div className="text-center py-16 bg-background/30 rounded-2xl border border-dashed border-primary/15">
									<p className="text-text/55 text-lg">No function executions found.</p>
								</div>
							) : (
								<div className="space-y-3.5">
									{data.functions.map((entry) => (
										<FunctionAnalyticsCard
											key={entry.functionId}
											data={entry}
											expanded={expandedFunctionIds.includes(entry.functionId)}
											onToggle={() => toggleFunction(entry.functionId)}
										/>
									))}
								</div>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}

export default FunctionAnalyticsPage;
