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

export interface PhaseSummary {
	description: string;
	avgSeconds: number;
	maxSeconds: number;
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
}

export interface AccountAnalyticsSummary {
	totalExecutions: number;
	successRate: number;
	avgSeconds: number | null;
	p95Seconds: number | null;
	functionCount: number;
}

export interface AccountFunctionAnalyticsResponse {
	status: "OK";
	range: AnalyticsRange;
	summary: AccountAnalyticsSummary;
	series: AnalyticsPoint[];
	functions: FunctionAnalyticsSummary[];
	slowestExecutions: ExecutionAnalyticsItem[];
}

export interface SingleFunctionAnalyticsResponse {
	status: "OK";
	range: AnalyticsRange;
	data: FunctionAnalyticsSummary;
}
