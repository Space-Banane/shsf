import { TriggerLog } from "@prisma/client";

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
	range: AnalyticsRange;
	summary: AccountAnalyticsSummary;
	series: AnalyticsPoint[];
	functions: FunctionAnalyticsSummary[];
	slowestExecutions: ExecutionAnalyticsItem[];
}

type TriggerLogWithFunctionName = TriggerLog & {
	function?: {
		id: number;
		name: string;
	} | null;
};

const RANGE_TO_DAYS: Record<Exclude<AnalyticsRange, "today">, number> = {
	"7d": 7,
	"30d": 30,
	"90d": 90,
};

export function normalizeAnalyticsRange(input?: string | null): AnalyticsRange {
	if (input === "today" || input === "30d" || input === "90d") {
		return input;
	}
	return "7d";
}

export function getAnalyticsRangeStart(
	range: AnalyticsRange,
	now: Date = new Date(),
): Date {
	const todayStart = startOfUtcDay(now);

	if (range === "today") {
		return todayStart;
	}

	return new Date(
		todayStart.getTime() - (RANGE_TO_DAYS[range] - 1) * 24 * 60 * 60 * 1000,
	);
}

function safeParseJson(value: string | null | undefined): any | null {
	if (!value || typeof value !== "string") {
		return null;
	}

	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

function startOfUtcDay(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	);
}

function toBucketKey(date: Date): string {
	return startOfUtcDay(date).toISOString();
}

function computePercentile(values: number[], percentile: number): number | null {
	if (values.length === 0) {
		return null;
	}

	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.min(
		sorted.length - 1,
		Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1),
	);
	return sorted[index];
}

function roundNumber(value: number | null): number | null {
	if (value === null || !Number.isFinite(value)) {
		return null;
	}
	return Number(value.toFixed(3));
}

function parsePhaseTimings(rawTooks: any): ExecutionTimingPhase[] {
	if (!Array.isArray(rawTooks)) {
		return [];
	}

	return rawTooks
		.map((entry) => {
			if (!entry || typeof entry !== "object") {
				return null;
			}

			const description =
				typeof entry.description === "string" ? entry.description.trim() : "";
			const seconds =
				typeof entry.value === "number"
					? entry.value
					: typeof entry.value === "string"
						? Number(entry.value)
						: NaN;

			if (!description || !Number.isFinite(seconds)) {
				return null;
			}

			return {
				description,
				seconds,
			};
		})
		.filter((entry): entry is ExecutionTimingPhase => Boolean(entry));
}

function getTotalSeconds(phases: ExecutionTimingPhase[]): number | null {
	const totalPhase = phases.find((phase) =>
		phase.description.toLowerCase().startsWith("total"),
	);
	if (totalPhase) {
		return roundNumber(totalPhase.seconds);
	}

	if (phases.length === 0) {
		return null;
	}

	return roundNumber(phases[phases.length - 1].seconds);
}

function getSourceFromPayload(payload: any): string {
	if (!payload || typeof payload !== "object") {
		return "unknown";
	}

	const source = payload.ran_by;
	if (typeof source !== "string" || source.trim() === "") {
		return "unknown";
	}
	return source;
}

function normalizeRateLimitScope(value: unknown): "global" | "identity" | null {
	return value === "global" || value === "identity" ? value : null;
}

function normalizeRateLimitMode(value: unknown): "enforce" | "observe" | null {
	return value === "enforce" || value === "observe" ? value : null;
}

function parseIdentityValues(value: unknown): Record<string, string> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, string] =>
				typeof entry[0] === "string" && typeof entry[1] === "string",
		),
	);
}

function parseRateLimitAppliedData(
	rawApplied: unknown,
): ExecutionRateLimitAppliedAnalytics[] {
	if (!Array.isArray(rawApplied)) {
		return [];
	}

	return rawApplied
		.map((entry) => {
			if (!entry || typeof entry !== "object") {
				return null;
			}

			const rawEntry = entry as Record<string, unknown>;
			const scope = normalizeRateLimitScope(rawEntry.scope);
			const limit = rawEntry.limit;
			const remaining = rawEntry.remaining;
			const resetAfterMs = rawEntry.reset_after_ms;

			if (
				!scope ||
				typeof limit !== "number" ||
				typeof remaining !== "number" ||
				typeof resetAfterMs !== "number"
			) {
				return null;
			}

			return {
				scope,
				policyId:
					typeof rawEntry.policy_id === "string" ? rawEntry.policy_id : null,
				policyName:
					typeof rawEntry.policy_name === "string"
						? rawEntry.policy_name
						: null,
				mode: normalizeRateLimitMode(rawEntry.mode),
				limit,
				remaining,
				resetAfterMs,
				wouldBlock: rawEntry.would_block === true,
				identities: Array.isArray(rawEntry.identities)
					? rawEntry.identities.filter(
							(identity: unknown): identity is string =>
								typeof identity === "string",
						)
					: [],
				identityValues: parseIdentityValues(rawEntry.identity_values),
			};
		})
		.filter(
			(entry): entry is ExecutionRateLimitAppliedAnalytics => Boolean(entry),
		);
}

function parseRateLimitData(rawRateLimit: any): ExecutionRateLimitAnalytics | null {
	if (!rawRateLimit || typeof rawRateLimit !== "object") {
		return null;
	}

	const applied = parseRateLimitAppliedData(rawRateLimit.applied);

	return {
		configured: rawRateLimit.configured === true,
		blocked: rawRateLimit.blocked === true,
		wouldBlock:
			rawRateLimit.would_block === true ||
			rawRateLimit.blocked === true ||
			applied.some((entry) => entry.wouldBlock),
		scope: normalizeRateLimitScope(rawRateLimit.scope),
		retryAfterMs:
			typeof rawRateLimit.retry_after_ms === "number"
				? rawRateLimit.retry_after_ms
				: null,
		penaltyMs:
			typeof rawRateLimit.penalty_ms === "number"
				? rawRateLimit.penalty_ms
				: null,
		limit:
			typeof rawRateLimit.limit === "number" ? rawRateLimit.limit : null,
		remaining:
			typeof rawRateLimit.remaining === "number"
				? rawRateLimit.remaining
				: null,
		resetAfterMs:
			typeof rawRateLimit.reset_after_ms === "number"
				? rawRateLimit.reset_after_ms
				: null,
		policyId:
			typeof rawRateLimit.policy_id === "string"
				? rawRateLimit.policy_id
				: null,
		policyName:
			typeof rawRateLimit.policy_name === "string"
				? rawRateLimit.policy_name
				: null,
		mode: normalizeRateLimitMode(rawRateLimit.mode),
		identities: Array.isArray(rawRateLimit.identities)
			? rawRateLimit.identities.filter(
					(identity: unknown): identity is string =>
						typeof identity === "string",
				)
			: [],
		identityValues: parseIdentityValues(rawRateLimit.identity_values),
		applied,
	};
}

export function parseExecutionAnalyticsLog(
	log: TriggerLogWithFunctionName,
): ExecutionAnalyticsItem | null {
	if (!log.result) {
		return null;
	}

	if (log.result === "CORS_DENIED") {
		return {
			executionId: log.id,
			functionId: log.functionId,
			functionName: log.function?.name ?? `Function #${log.functionId}`,
			createdAt: log.createdAt.toISOString(),
			exitCode: 403,
			totalSeconds: null,
			source: "exec",
			phaseTimings: [],
			errorType: "cors_denied",
			ratelimit: null,
		};
	}

	const parsedResult = safeParseJson(log.result);
	if (!parsedResult || typeof parsedResult !== "object") {
		return null;
	}

	const phases = parsePhaseTimings(parsedResult.tooks);
	const payloadValue = safeParseJson(parsedResult.payload) ?? parsedResult.payload;
	const functionName = log.function?.name ?? `Function #${log.functionId}`;

	let exitCode: number | null = null;
	if (typeof parsedResult.exit_code === "number") {
		exitCode = parsedResult.exit_code;
	} else if (typeof parsedResult.exitCode === "number") {
		exitCode = parsedResult.exitCode;
	}

	return {
		executionId: log.id,
		functionId: log.functionId,
		functionName,
		createdAt: log.createdAt.toISOString(),
		exitCode,
		totalSeconds: getTotalSeconds(phases),
		source: getSourceFromPayload(payloadValue),
		phaseTimings: phases,
		errorType:
			typeof parsedResult.error_type === "string" ? parsedResult.error_type : null,
		ratelimit: parseRateLimitData(parsedResult.ratelimit),
	};
}

function buildSeries(
	executions: ExecutionAnalyticsItem[],
	range: AnalyticsRange,
	now: Date = new Date(),
): AnalyticsPoint[] {
	const rangeStart = getAnalyticsRangeStart(range, now);
	const bucketMap = new Map<
		string,
		{
			count: number;
			successCount: number;
			failureCount: number;
			durations: number[];
		}
	>();

	for (
		let cursor = startOfUtcDay(rangeStart);
		cursor.getTime() <= now.getTime();
		cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
	) {
		bucketMap.set(cursor.toISOString(), {
			count: 0,
			successCount: 0,
			failureCount: 0,
			durations: [],
		});
	}

	for (const execution of executions) {
		const bucketKey = toBucketKey(new Date(execution.createdAt));
		if (!bucketMap.has(bucketKey)) {
			bucketMap.set(bucketKey, {
				count: 0,
				successCount: 0,
				failureCount: 0,
				durations: [],
			});
		}

		const bucket = bucketMap.get(bucketKey)!;
		bucket.count += 1;
		if (execution.exitCode === 0) {
			bucket.successCount += 1;
		} else if (execution.exitCode !== null) {
			bucket.failureCount += 1;
		}
		if (typeof execution.totalSeconds === "number") {
			bucket.durations.push(execution.totalSeconds);
		}
	}

	return [...bucketMap.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([bucketStart, bucket]) => ({
			bucketStart,
			count: bucket.count,
			avgSeconds:
				bucket.durations.length > 0
					? roundNumber(
							bucket.durations.reduce((sum, value) => sum + value, 0) /
								bucket.durations.length,
						)
					: null,
			p95Seconds: roundNumber(computePercentile(bucket.durations, 95)),
			successCount: bucket.successCount,
			failureCount: bucket.failureCount,
		}));
}

function buildPhaseSummary(executions: ExecutionAnalyticsItem[]): PhaseSummary[] {
	const phaseMap = new Map<string, number[]>();

	for (const execution of executions) {
		for (const phase of execution.phaseTimings) {
			if (phase.description.toLowerCase().startsWith("total")) {
				continue;
			}

			const existing = phaseMap.get(phase.description) ?? [];
			existing.push(phase.seconds);
			phaseMap.set(phase.description, existing);
		}
	}

	return [...phaseMap.entries()]
		.map(([description, values]) => ({
			description,
			avgSeconds: roundNumber(
				values.reduce((sum, value) => sum + value, 0) / values.length,
			)!,
			maxSeconds: roundNumber(Math.max(...values))!,
		}))
		.sort((a, b) => b.avgSeconds - a.avgSeconds);
}

function buildRateLimitBlockedByScope(
	executions: ExecutionAnalyticsItem[],
): RateLimitScopeBreakdown {
	return executions.reduce<RateLimitScopeBreakdown>(
		(summary, execution) => {
			if (!execution.ratelimit?.blocked || !execution.ratelimit.scope) {
				return summary;
			}

			summary[execution.ratelimit.scope] += 1;
			return summary;
		},
		{ global: 0, identity: 0 },
	);
}

function buildTopRateLimitIdentityValues(
	executions: ExecutionAnalyticsItem[],
): RateLimitTopIdentityValue[] {
	const identityMap = new Map<
		string,
		{
			identity: string;
			value: string;
			count: number;
			blockedCount: number;
		}
	>();

	for (const execution of executions) {
		if (!execution.ratelimit?.configured) {
			continue;
		}

		for (const [identity, value] of Object.entries(
			execution.ratelimit.identityValues,
		)) {
			const key = `${identity}:${value}`;
			const current = identityMap.get(key) ?? {
				identity,
				value,
				count: 0,
				blockedCount: 0,
			};
			current.count += 1;
			if (execution.ratelimit.blocked) {
				current.blockedCount += 1;
			}
			identityMap.set(key, current);
		}
	}

	return [...identityMap.values()]
		.sort((a, b) => {
			if (b.blockedCount !== a.blockedCount) {
				return b.blockedCount - a.blockedCount;
			}
			return b.count - a.count;
		})
		.slice(0, 6);
}

function buildFunctionSummary(
	functionId: number,
	functionName: string,
	executions: ExecutionAnalyticsItem[],
	range: AnalyticsRange,
	now: Date = new Date(),
): FunctionAnalyticsSummary {
	const successfulRuns = executions.filter((execution) => execution.exitCode === 0).length;
	const durations = executions
		.map((execution) => execution.totalSeconds)
		.filter((value): value is number => typeof value === "number");
	const sortedRecentExecutions = [...executions]
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
		.slice(0, 10);
	const rateLimitedExecutions = executions.filter(
		(execution) => execution.ratelimit?.configured,
	).length;
	const rateLimitBlockedExecutions = executions.filter(
		(execution) => execution.ratelimit?.blocked,
	).length;
	const rateLimitWouldBlockExecutions = executions.filter(
		(execution) => execution.ratelimit?.wouldBlock,
	).length;

	return {
		functionId,
		functionName,
		totalRuns: executions.length,
		successRate:
			executions.length > 0
				? Number(((successfulRuns / executions.length) * 100).toFixed(1))
				: 0,
		avgSeconds:
			durations.length > 0
				? roundNumber(
						durations.reduce((sum, value) => sum + value, 0) / durations.length,
					)
				: null,
		p95Seconds: roundNumber(computePercentile(durations, 95)),
		lastRunAt: sortedRecentExecutions[0]?.createdAt ?? null,
		series: buildSeries(executions, range, now),
		recentExecutions: sortedRecentExecutions,
		phaseSummary: buildPhaseSummary(executions),
		rateLimitedExecutions,
		rateLimitBlockedExecutions,
		rateLimitWouldBlockExecutions,
		rateLimitBlockedByScope: buildRateLimitBlockedByScope(executions),
		topRateLimitIdentityValues: buildTopRateLimitIdentityValues(executions),
	};
}

export function buildAccountFunctionAnalytics(
	logs: TriggerLogWithFunctionName[],
	range: AnalyticsRange,
	now: Date = new Date(),
): AccountFunctionAnalyticsResponse {
	const parsedExecutions = logs
		.map((log) => parseExecutionAnalyticsLog(log))
		.filter((execution): execution is ExecutionAnalyticsItem => Boolean(execution));

	const functionMap = new Map<
		number,
		{
			name: string;
			executions: ExecutionAnalyticsItem[];
		}
	>();

	for (const execution of parsedExecutions) {
		const entry = functionMap.get(execution.functionId) ?? {
			name: execution.functionName,
			executions: [],
		};
		entry.executions.push(execution);
		functionMap.set(execution.functionId, entry);
	}

	const functions = [...functionMap.entries()]
		.map(([functionId, entry]) =>
			buildFunctionSummary(functionId, entry.name, entry.executions, range, now),
		)
		.sort((a, b) => {
			if (b.totalRuns !== a.totalRuns) {
				return b.totalRuns - a.totalRuns;
			}
			return a.functionName.localeCompare(b.functionName);
		});

	const durations = parsedExecutions
		.map((execution) => execution.totalSeconds)
		.filter((value): value is number => typeof value === "number");
	const successCount = parsedExecutions.filter(
		(execution) => execution.exitCode === 0,
	).length;
	const rateLimitedExecutions = parsedExecutions.filter(
		(execution) => execution.ratelimit?.configured,
	).length;
	const rateLimitBlockedExecutions = parsedExecutions.filter(
		(execution) => execution.ratelimit?.blocked,
	).length;
	const rateLimitWouldBlockExecutions = parsedExecutions.filter(
		(execution) => execution.ratelimit?.wouldBlock,
	).length;

	return {
		range,
		summary: {
			totalExecutions: parsedExecutions.length,
			successRate:
				parsedExecutions.length > 0
					? Number(((successCount / parsedExecutions.length) * 100).toFixed(1))
					: 0,
			avgSeconds:
				durations.length > 0
					? roundNumber(
							durations.reduce((sum, value) => sum + value, 0) / durations.length,
						)
					: null,
			p95Seconds: roundNumber(computePercentile(durations, 95)),
			functionCount: functions.length,
			rateLimitedExecutions,
			rateLimitBlockedExecutions,
			rateLimitWouldBlockExecutions,
			rateLimitBlockedByScope: buildRateLimitBlockedByScope(parsedExecutions),
			topRateLimitIdentityValues:
				buildTopRateLimitIdentityValues(parsedExecutions),
		},
		series: buildSeries(parsedExecutions, range, now),
		functions,
		slowestExecutions: [...parsedExecutions]
			.filter((execution) => typeof execution.totalSeconds === "number")
			.sort((a, b) => (b.totalSeconds ?? 0) - (a.totalSeconds ?? 0))
			.slice(0, 5),
	};
}

export function buildSingleFunctionAnalytics(
	functionId: number,
	functionName: string,
	logs: TriggerLogWithFunctionName[],
	range: AnalyticsRange,
	now: Date = new Date(),
): FunctionAnalyticsSummary {
	const executions = logs
		.map((log) => parseExecutionAnalyticsLog(log))
		.filter((execution): execution is ExecutionAnalyticsItem => Boolean(execution));

	return buildFunctionSummary(functionId, functionName, executions, range, now);
}
