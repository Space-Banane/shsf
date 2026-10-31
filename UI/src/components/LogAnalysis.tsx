import { Link } from "react-router-dom";
import type { ExecutionLogAnalysis, LogAnalysisSummary } from "../types/Analytics";

const STATUS_TEXT: Record<Exclude<ExecutionLogAnalysis["status"], "completed">, string> = {
	pending: "Analysis queued",
	running: "Analyzing…",
	skipped: "Analysis unavailable",
	failed: "Analysis failed",
	disabled: "Analysis turned off",
};

function priorityTone(priority: number) {
	if (priority >= 7) return "border-red-500/25 bg-red-500/10 text-red-300";
	if (priority >= 4) return "border-amber-500/25 bg-amber-500/10 text-amber-300";
	return "border-white/[0.1] bg-white/[0.04] text-muted";
}

/** Compact advisory chip. Renders nothing for logs that were never queued. */
export function LogAnalysisBadge({ analysis }: { analysis: ExecutionLogAnalysis | null | undefined }) {
	if (!analysis) return null;
	if (analysis.status !== "completed" || analysis.attentionPriority === null) {
		const problem = analysis.status === "failed" || analysis.status === "skipped";
		return (
			<span
				title={analysis.error ?? undefined}
				className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${problem ? "border-amber-500/25 bg-amber-500/10 text-amber-300" : "border-white/[0.1] bg-white/[0.04] text-muted"}`}
			>
				{STATUS_TEXT[analysis.status as keyof typeof STATUS_TEXT] ?? "Not analyzed"}
			</span>
		);
	}
	return (
		<span
			title="Advisory AI triage signal. It can disagree with the exit code."
			className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${priorityTone(analysis.attentionPriority)}`}
		>
			P{analysis.attentionPriority}
			{analysis.failureDetected ? " · failure signal" : ""}
		</span>
	);
}

function percent(value: number | null) {
	return value === null ? "—" : `${Math.round(value * 100)}%`;
}

/** Expanded detail block for one execution. */
export function LogAnalysisDetails({ analysis }: { analysis: ExecutionLogAnalysis | null | undefined }) {
	if (!analysis) {
		return <p className="text-xs text-muted">Not analyzed. This log was written while analysis was off for this function.</p>;
	}
	if (analysis.status !== "completed") {
		return (
			<p className="text-xs text-muted">
				{STATUS_TEXT[analysis.status]}
				{analysis.error ? `: ${analysis.error}` : "."}
			</p>
		);
	}
	return (
		<div className="space-y-2 text-xs">
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				<Stat label="Priority" value={analysis.attentionPriority === null ? "—" : `${analysis.attentionPriority} / 10`} />
				<Stat label="Failure likelihood" value={percent(analysis.failureProbability)} />
				<Stat label="Priority confidence" value={percent(analysis.attentionConfidence)} />
				<Stat label="Cost" value={analysis.costUsd === null ? "—" : `$${analysis.costUsd.toFixed(5)}`} />
			</div>
			{analysis.attentionDistribution && Object.keys(analysis.attentionDistribution).length > 0 && (
				<p className="text-muted">
					Priority distribution:{" "}
					<span className="font-mono text-text/80">
						{Object.entries(analysis.attentionDistribution)
							.filter(([, probability]) => probability >= 0.01)
							.map(([priority, probability]) => `P${priority} ${Math.round(probability * 100)}%`)
							.join(" · ")}
					</span>
				</p>
			)}
			<p className="text-muted">
				Advisory only, from <span className="font-mono text-text/80">{analysis.model}</span>
				{analysis.analyzedAt ? ` at ${new Date(analysis.analyzedAt).toLocaleString()}` : ""}. The exit code above is the recorded result.
			</p>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border border-white/[0.07] bg-background/40 px-2 py-1.5">
			<p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
			<p className="font-mono text-text">{value}</p>
		</div>
	);
}

/** Dashboard block. Separate from deterministic stats on purpose; it never feeds success rate. */
export function LogAnalysisPanel({ summary, compact = false }: { summary: LogAnalysisSummary | undefined; compact?: boolean }) {
	if (!summary) return null;
	const queued = summary.analyzed + summary.pending + summary.unavailable;
	if (queued === 0) {
		return compact ? null : (
			<div className="rounded-xl border border-dashed border-white/[0.12] bg-surface p-5">
				<h2 className="text-base font-semibold text-text">Log analysis</h2>
				<p className="mt-1 text-sm text-muted">
					No analyzed logs in this range. Analysis is optional and off by default.{" "}
					<Link to="/account#log-analysis" className="text-primary hover:underline">Set it up</Link> to get advisory failure signals.
				</p>
			</div>
		);
	}
	const max = Math.max(1, ...summary.priorityDistribution);
	return (
		<section aria-label="Log analysis" className="rounded-xl border border-white/[0.07] bg-surface p-5">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 className={compact ? "text-base font-semibold text-primary" : "text-xl font-bold text-primary"}>Log analysis</h2>
				<p className="text-xs text-muted">Advisory AI triage via OpenRouter. Success rate above uses exit codes only.</p>
			</div>
			<div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
				<Metric label="Analyzed" value={String(summary.analyzed)} />
				<Metric label="Failure signals" value={String(summary.failureSignals)} tone={summary.failureSignals ? "text-red-300" : undefined} />
				<Metric label="Pending" value={String(summary.pending)} />
				<Metric label="Unavailable" value={String(summary.unavailable)} tone={summary.unavailable ? "text-amber-300" : undefined} help="Failed, skipped, or turned off before analysis" />
				<Metric label="Avg confidence" value={percent(summary.avgConfidence)} help={`Cost $${summary.costUsd.toFixed(4)}`} />
			</div>
			<div className={`mt-5 grid gap-5 ${compact ? "" : "lg:grid-cols-2"}`}>
				<div>
					<h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Priority distribution</h3>
					<div className="flex h-24 items-end gap-1" role="img" aria-label={`Priority distribution: ${summary.priorityDistribution.map((count, index) => `P${index + 1} ${count}`).join(", ")}`}>
						{summary.priorityDistribution.map((count, index) => (
							<div key={index} className="flex flex-1 flex-col items-center gap-1">
								<div
									className={`w-full rounded-sm ${index >= 6 ? "bg-red-400/70" : index >= 3 ? "bg-amber-400/60" : "bg-white/20"}`}
									style={{ height: `${Math.max(count ? 6 : 2, (count / max) * 72)}px` }}
									title={`P${index + 1}: ${count}`}
								/>
								<span className="text-[10px] text-muted">{index + 1}</span>
							</div>
						))}
					</div>
				</div>
				{!compact && (
					<div>
						<h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">High priority (7+)</h3>
						{summary.highPriority.length === 0 ? (
							<p className="text-sm text-muted">Nothing rated 7 or higher in this range.</p>
						) : (
							<ul className="divide-y divide-white/[0.06]">
								{summary.highPriority.map((execution) => (
									<li key={execution.executionId} className="flex items-center justify-between gap-3 py-2 text-sm">
										<span className="min-w-0 truncate">
											<Link to={`/functions/${execution.functionId}`} className="text-text hover:text-primary">{execution.functionName}</Link>
											<span className="ml-2 text-xs text-muted">{new Date(execution.createdAt).toLocaleString()}</span>
										</span>
										<span className="flex shrink-0 items-center gap-2">
											<span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${execution.exitCode === 0 ? "border-green-500/20 bg-green-500/10 text-green-400" : "border-red-500/20 bg-red-500/10 text-red-400"}`}>
												{execution.exitCode === 0 ? "Exit 0" : execution.exitCode === null ? "No exit code" : `Exit ${execution.exitCode}`}
											</span>
											<LogAnalysisBadge analysis={execution.analysis} />
										</span>
									</li>
								))}
							</ul>
						)}
					</div>
				)}
			</div>
		</section>
	);
}

function Metric({ label, value, tone, help }: { label: string; value: string; tone?: string; help?: string }) {
	return (
		<div className="rounded-lg border border-white/[0.07] bg-background/40 p-3">
			<p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
			<p className={`mt-1 text-xl font-semibold ${tone ?? "text-text"}`}>{value}</p>
			{help ? <p className="mt-0.5 text-[11px] text-muted">{help}</p> : null}
		</div>
	);
}
