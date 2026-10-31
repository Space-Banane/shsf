export type AnalyticsRange = "today" | "7d" | "30d" | "90d";

export interface AnalyticsPoint {
	bucketStart: string;
	count: number;
	avgSeconds: number | null;
	p95Seconds: number | null;
	successCount: number;
	failureCount: number;
}

export interface ExecutionTimingPhase {
	description: string;
	seconds: number;
}

export interface ExecutionRateLimitAnalytics {
	configured: boolean;
	blocked: boolean;
	wouldBlock: boolean;
	scope: "global" | "identity" | null;
	retryAfterMs: number | null;
	penaltyMs: number | null;
	limit: number | null;
	remaining: number | null;
	resetAfterMs: number | null;
	policyId: string | null;
	policyName: string | null;
	mode: "enforce" | "observe" | null;
	identities: string[];
	identityValues: Record<string, string>;
	applied: ExecutionRateLimitAppliedAnalytics[];
}

export interface ExecutionRateLimitAppliedAnalytics {
	scope: "global" | "identity";
	policyId: string | null;
	policyName: string | null;
	mode: "enforce" | "observe" | null;
	limit: number;
	remaining: number;
	resetAfterMs: number;
	wouldBlock: boolean;
	identities: string[];
	identityValues: Record<string, string>;
}

export interface RateLimitScopeBreakdown {
	global: number;
	identity: number;
}

export interface RateLimitTopIdentityValue {
	identity: string;
	value: string;
	count: number;
	blockedCount: number;
}

export interface PhaseSummary {
	description: string;
	avgSeconds: number;
	maxSeconds: number;
}

export type LogAnalysisStatus = "pending" | "running" | "completed" | "skipped" | "failed" | "disabled";

/** Advisory OpenRouter Decisions result. Never overrides exitCode. */
export interface ExecutionLogAnalysis {
	status: LogAnalysisStatus;
	failureProbability: number | null;
	failureDetected: boolean | null;
	attentionPriority: number | null;
	attentionConfidence: number | null;
	model: string;
	error: string | null;
	costUsd: number | null;
	analyzedAt: string | null;
	/** Priority (1-10) -> probability, when the model returned a distribution. */
	attentionDistribution?: Record<string, number> | null;
}

export interface LogAnalysisSummary {
	analyzed: number;
	pending: number;
	unavailable: number;
	notAnalyzed: number;
	failureSignals: number;
	priorityDistribution: number[];
	avgConfidence: number | null;
	costUsd: number;
	highPriority: ExecutionAnalyticsItem[];
}

export interface ExecutionAnalyticsItem {
	executionId: number;
	functionId: number;
	functionName: string;
	createdAt: string;
	exitCode: number | null;
	totalSeconds: number | null;
	source: string;
	phaseTimings: ExecutionTimingPhase[];
	errorType: string | null;
	ratelimit: ExecutionRateLimitAnalytics | null;
	analysis: ExecutionLogAnalysis | null;
}

export interface FunctionAnalyticsSummary {
	functionId: number;
	functionName: string;
	totalRuns: number;
	successRate: number;
	avgSeconds: number | null;
	p95Seconds: number | null;
	lastRunAt: string | null;
	series: AnalyticsPoint[];
	recentExecutions: ExecutionAnalyticsItem[];
	phaseSummary: PhaseSummary[];
	rateLimitedExecutions: number;
	rateLimitBlockedExecutions: number;
	rateLimitWouldBlockExecutions: number;
	rateLimitBlockedByScope: RateLimitScopeBreakdown;
	topRateLimitIdentityValues: RateLimitTopIdentityValue[];
	logAnalysis?: LogAnalysisSummary;
}

export interface AccountAnalyticsSummary {
	totalExecutions: number;
	successRate: number;
	avgSeconds: number | null;
	p95Seconds: number | null;
	functionCount: number;
	rateLimitedExecutions: number;
	rateLimitBlockedExecutions: number;
	rateLimitWouldBlockExecutions: number;
	rateLimitBlockedByScope: RateLimitScopeBreakdown;
	topRateLimitIdentityValues: RateLimitTopIdentityValue[];
}

export interface AccountFunctionAnalyticsResponse {
	status: "OK";
	range: AnalyticsRange;
	summary: AccountAnalyticsSummary;
	series: AnalyticsPoint[];
	functions: FunctionAnalyticsSummary[];
	slowestExecutions: ExecutionAnalyticsItem[];
	logAnalysis?: LogAnalysisSummary;
}

export interface SingleFunctionAnalyticsResponse {
	status: "OK";
	range: AnalyticsRange;
	data: FunctionAnalyticsSummary;
}
