import { Function } from "@prisma/client";
import { env } from "process";
import { prisma } from "..";

export const EXECUTION_RATELIMIT_IDENTITIES = [
	"ip",
	"method",
	"route",
	"origin",
	"access_key",
	"secure_header",
	"guest_session",
	"execution_alias_or_id",
] as const;

export type ExecutionRateLimitIdentity =
	(typeof EXECUTION_RATELIMIT_IDENTITIES)[number];

export interface FunctionRateLimitRule {
	hits: number;
	window_ms: number;
	penalty_ms?: number;
}

export type ExecutionRateLimitScope = "global" | "identity";
export type ExecutionRateLimitMode = "enforce" | "observe";

export interface FunctionRateLimitMatcher {
	methods?: string[];
	routes?: string[];
	origins?: string[];
}

export interface FunctionRateLimitPolicy {
	id: string;
	name: string;
	scope: ExecutionRateLimitScope;
	rule: FunctionRateLimitRule;
	mode?: ExecutionRateLimitMode;
	enabled?: boolean;
	identities?: ExecutionRateLimitIdentity[];
	match?: FunctionRateLimitMatcher;
}

interface FunctionRateLimitConfigEnabled {
	enabled: true;
	global?: FunctionRateLimitRule;
	identities?: ExecutionRateLimitIdentity[];
	identity_limit?: FunctionRateLimitRule;
	policies?: FunctionRateLimitPolicy[];
}

interface FunctionRateLimitConfigDisabled {
	enabled: false;
}

export type FunctionRateLimitConfig =
	| FunctionRateLimitConfigEnabled
	| FunctionRateLimitConfigDisabled;

interface ExecutionRateLimitBucketState {
	hits: number;
	window_started_at: number;
	penalty_until?: number;
	expires_at: number;
}

export interface ExecutionRateLimitIdentityValues {
	ip: string;
	method: string;
	route: string;
	origin: string;
	access_key: string;
	secure_header: string;
	guest_session: string;
	execution_alias_or_id: string;
}

export interface ExtractExecutionIdentityOptions {
	ctr: any;
	namespaceId: number;
	functionIdentifier: string;
	method: string;
	route: string;
	executionAliasOrId: string;
}

export interface FunctionRateLimitEnforcementResultAllowed {
	allowed: true;
	applied?: AppliedExecutionRateLimit[];
}

export interface FunctionRateLimitEnforcementResultBlocked {
	allowed: false;
	scope: ExecutionRateLimitScope;
	key: string;
	retry_after_ms: number;
	penalty_ms?: number;
	limit: number;
	remaining: number;
	reset_after_ms: number;
	policy_id?: string;
	policy_name?: string;
	mode: ExecutionRateLimitMode;
	identities?: ExecutionRateLimitIdentity[];
	identity_values?: Partial<Record<ExecutionRateLimitIdentity, string>>;
	applied: AppliedExecutionRateLimit[];
}

export type FunctionRateLimitEnforcementResult =
	| FunctionRateLimitEnforcementResultAllowed
	| FunctionRateLimitEnforcementResultBlocked;

export interface LoggedExecutionRateLimitData {
	configured: boolean;
	blocked: boolean;
	would_block?: boolean;
	scope?: ExecutionRateLimitScope;
	retry_after_ms?: number;
	penalty_ms?: number;
	limit?: number;
	remaining?: number;
	reset_after_ms?: number;
	policy_id?: string;
	policy_name?: string;
	mode?: ExecutionRateLimitMode;
	global?: FunctionRateLimitRule;
	identities?: ExecutionRateLimitIdentity[];
	identity_limit?: FunctionRateLimitRule;
	identity_values?: Partial<Record<ExecutionRateLimitIdentity, string>>;
	applied?: AppliedExecutionRateLimit[];
}

export interface AppliedExecutionRateLimit {
	scope: ExecutionRateLimitScope;
	key: string;
	limit: number;
	remaining: number;
	reset_after_ms: number;
	window_ms: number;
	hits: number;
	mode: ExecutionRateLimitMode;
	would_block: boolean;
	policy_id?: string;
	policy_name?: string;
	identities?: ExecutionRateLimitIdentity[];
	identity_values?: Partial<Record<ExecutionRateLimitIdentity, string>>;
}

const DEFAULT_FUNCTION_RATELIMIT_CONFIG: FunctionRateLimitConfig = {
	enabled: false,
};

const FALLBACK_EXECUTION_RATELIMIT_CONFIG: FunctionRateLimitConfig = {
	enabled: true,
	global: {
		hits: 5,
		window_ms: parseInt(env.RATELIMIT || "0", 10) || 0,
		penalty_ms: 400,
	},
};

export const EXECUTION_RATELIMIT_MISSING_VALUE = "__missing__";

const ratelimitBucketStore = new Map<string, ExecutionRateLimitBucketState>();
const RatelimitCleanupIntervalMs = 60_000;
let lastRatelimitCleanupAt = 0;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePositiveInteger(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
		return undefined;
	}

	return value;
}

function normalizeNonNegativeInteger(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
		return undefined;
	}

	return value;
}

function normalizeNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringList(value: unknown): string[] | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (!Array.isArray(value)) {
		return undefined;
	}

	const normalized = value
		.map((item) => normalizeNonEmptyString(item))
		.filter((item): item is string => Boolean(item));

	if (normalized.length !== value.length) {
		return undefined;
	}

	return Array.from(new Set(normalized));
}

function normalizeRateLimitRule(
	value: unknown,
): FunctionRateLimitRule | undefined {
	if (!isPlainObject(value)) {
		return undefined;
	}

	const hits = normalizePositiveInteger(value.hits);
	const window_ms = normalizePositiveInteger(value.window_ms);
	if (!hits || !window_ms) {
		return undefined;
	}

	const penalty_ms =
		value.penalty_ms === undefined
			? undefined
			: normalizeNonNegativeInteger(value.penalty_ms);

	if (value.penalty_ms !== undefined && penalty_ms === undefined) {
		return undefined;
	}

	return {
		hits,
		window_ms,
		...(penalty_ms !== undefined ? { penalty_ms } : {}),
	};
}

function normalizeRateLimitMatcher(
	value: unknown,
): FunctionRateLimitMatcher | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (!isPlainObject(value)) {
		return undefined;
	}

	const methods = normalizeStringList(value.methods)?.map((method) =>
		method.toUpperCase(),
	);
	const routes = normalizeStringList(value.routes);
	const origins = normalizeStringList(value.origins);

	if (
		(value.methods !== undefined && !methods) ||
		(value.routes !== undefined && !routes) ||
		(value.origins !== undefined && !origins)
	) {
		return undefined;
	}

	return {
		...(methods?.length ? { methods } : {}),
		...(routes?.length ? { routes } : {}),
		...(origins?.length ? { origins } : {}),
	};
}

function normalizeRateLimitMode(value: unknown): ExecutionRateLimitMode {
	return value === "observe" ? "observe" : "enforce";
}

function normalizeRateLimitPolicy(
	value: unknown,
	index: number,
): FunctionRateLimitPolicy | undefined {
	if (!isPlainObject(value)) {
		return undefined;
	}

	const scope =
		value.scope === "global" || value.scope === "identity"
			? value.scope
			: undefined;
	const rule = normalizeRateLimitRule(value.rule);

	if (!scope || !rule) {
		return undefined;
	}

	let identities: ExecutionRateLimitIdentity[] | undefined;
	if (value.identities !== undefined) {
		if (!Array.isArray(value.identities)) {
			return undefined;
		}

		const normalizedIdentities = value.identities.filter((identity) =>
			EXECUTION_RATELIMIT_IDENTITIES.includes(
				identity as ExecutionRateLimitIdentity,
			),
		) as ExecutionRateLimitIdentity[];

		if (normalizedIdentities.length !== value.identities.length) {
			return undefined;
		}

		identities = sortExecutionRateLimitIdentities(normalizedIdentities);
	}

	if (scope === "identity" && (!identities || identities.length === 0)) {
		return undefined;
	}

	const match =
		value.match === undefined
			? undefined
			: normalizeRateLimitMatcher(value.match);
	if (value.match !== undefined && !match) {
		return undefined;
	}

	const id =
		normalizeNonEmptyString(value.id) ??
		`policy-${index + 1}`;
	const name =
		normalizeNonEmptyString(value.name) ??
		(scope === "global" ? "Global policy" : "Identity policy");

	return {
		id,
		name,
		scope,
		rule,
		mode: normalizeRateLimitMode(value.mode),
		enabled: value.enabled === false ? false : true,
		...(identities ? { identities } : {}),
		...(match ? { match } : {}),
	};
}

export function sortExecutionRateLimitIdentities(
	identities: ExecutionRateLimitIdentity[],
): ExecutionRateLimitIdentity[] {
	const unique = Array.from(new Set(identities));
	return EXECUTION_RATELIMIT_IDENTITIES.filter((identity) =>
		unique.includes(identity),
	);
}

export function normalizeFunctionRateLimitConfig(
	value: unknown,
): FunctionRateLimitConfig {
	if (!isPlainObject(value) || typeof value.enabled !== "boolean") {
		return DEFAULT_FUNCTION_RATELIMIT_CONFIG;
	}

	if (value.enabled === false) {
		return { enabled: false };
	}

	const globalRule =
		value.global === undefined ? undefined : normalizeRateLimitRule(value.global);
	if (value.global !== undefined && !globalRule) {
		return DEFAULT_FUNCTION_RATELIMIT_CONFIG;
	}

	let identities: ExecutionRateLimitIdentity[] | undefined;
	if (value.identities !== undefined) {
		if (!Array.isArray(value.identities)) {
			return DEFAULT_FUNCTION_RATELIMIT_CONFIG;
		}

		const normalizedIdentities = value.identities.filter((identity) =>
			EXECUTION_RATELIMIT_IDENTITIES.includes(
				identity as ExecutionRateLimitIdentity,
			),
		) as ExecutionRateLimitIdentity[];

		if (normalizedIdentities.length !== value.identities.length) {
			return DEFAULT_FUNCTION_RATELIMIT_CONFIG;
		}

		identities = sortExecutionRateLimitIdentities(normalizedIdentities);
	}

	const identityLimit =
		value.identity_limit === undefined
			? undefined
			: normalizeRateLimitRule(value.identity_limit);
	if (value.identity_limit !== undefined && !identityLimit) {
		return DEFAULT_FUNCTION_RATELIMIT_CONFIG;
	}

	let policies: FunctionRateLimitPolicy[] | undefined;
	if (value.policies !== undefined) {
		if (!Array.isArray(value.policies)) {
			return DEFAULT_FUNCTION_RATELIMIT_CONFIG;
		}

		const normalizedPolicies = value.policies
			.map((policy, index) => normalizeRateLimitPolicy(policy, index))
			.filter((policy): policy is FunctionRateLimitPolicy => Boolean(policy));

		if (normalizedPolicies.length !== value.policies.length) {
			return DEFAULT_FUNCTION_RATELIMIT_CONFIG;
		}

		policies = normalizedPolicies;
	}

	return {
		enabled: true,
		...(globalRule ? { global: globalRule } : {}),
		...(identities ? { identities } : {}),
		...(identityLimit ? { identity_limit: identityLimit } : {}),
		...(policies ? { policies } : {}),
	};
}

export function hasConfiguredRateLimitBuckets(
	config: FunctionRateLimitConfig,
): boolean {
	if (!config.enabled) {
		return false;
	}

	if (config.global) {
		return true;
	}

	if (config.identity_limit && config.identities && config.identities.length > 0) {
		return true;
	}

	return (config.policies ?? []).some((policy) => policy.enabled !== false);
}

export async function getRateLimitConfigFromData(
	ratelimit: string | null,
): Promise<FunctionRateLimitConfig> {
	try {
		if (!ratelimit || ratelimit.trim() === "") {
			return DEFAULT_FUNCTION_RATELIMIT_CONFIG;
		}

		return normalizeFunctionRateLimitConfig(JSON.parse(ratelimit));
	} catch (error) {
		console.error("Error parsing rate limit config:", error);
		return DEFAULT_FUNCTION_RATELIMIT_CONFIG;
	}
}

export async function getExecutionRateLimitConfigFromData(
	ratelimit: string | null,
): Promise<FunctionRateLimitConfig> {
	if (!ratelimit || ratelimit.trim() === "") {
		return FALLBACK_EXECUTION_RATELIMIT_CONFIG;
	}

	try {
		const parsed = JSON.parse(ratelimit);
		const normalized = normalizeFunctionRateLimitConfig(parsed);
		if (
			normalized.enabled === false &&
			(!isPlainObject(parsed) || parsed.enabled !== false)
		) {
			return FALLBACK_EXECUTION_RATELIMIT_CONFIG;
		}

		return normalized;
	} catch (error) {
		console.error("Error parsing execution rate limit config:", error);
		return FALLBACK_EXECUTION_RATELIMIT_CONFIG;
	}
}

export async function setRateLimitConfig(
	functionID: number,
	config: FunctionRateLimitConfig,
): Promise<void> {
	await prisma.function.update({
		where: {
			id: functionID,
		},
		data: {
			ratelimit: JSON.stringify(config),
		},
	});
}

export async function getRateLimitConfigByID(functionID: number) {
	const functionData = await prisma.function.findFirst({
		where: {
			id: functionID,
		},
	});

	if (!functionData) {
		return null;
	}

	return getRateLimitConfigFromData(functionData.ratelimit ?? "");
}

function getHeaderValue(ctr: any, name: string): string | null {
	if (!ctr?.headers?.has?.(name)) {
		return null;
	}

	const value = ctr.headers.get(name);
	return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeIdentityValue(value: string | null | undefined): string {
	if (!value) {
		return EXECUTION_RATELIMIT_MISSING_VALUE;
	}

	return value;
}

export function extractExecutionIdentityValues(
	options: ExtractExecutionIdentityOptions,
): ExecutionRateLimitIdentityValues {
	return {
		ip: normalizeIdentityValue(options.ctr?.client?.ip?.usual?.()),
		method: normalizeIdentityValue(options.method.toUpperCase()),
		route: normalizeIdentityValue(options.route),
		origin: normalizeIdentityValue(getHeaderValue(options.ctr, "origin")),
		access_key: normalizeIdentityValue(
			getHeaderValue(options.ctr, "x-access-key"),
		),
		secure_header: normalizeIdentityValue(
			getHeaderValue(options.ctr, "x-secure-header"),
		),
		guest_session: normalizeIdentityValue(
			options.ctr?.cookies?.get?.(
				`shsf_guest_${options.namespaceId}_${options.functionIdentifier}`,
			),
		),
		execution_alias_or_id: normalizeIdentityValue(options.executionAliasOrId),
	};
}

export function buildFunctionGlobalRateLimitKey(functionId: number): string {
	return `function:${functionId}:global`;
}

export function buildFunctionIdentityRateLimitKey(
	functionId: number,
	identities: ExecutionRateLimitIdentity[],
	values: ExecutionRateLimitIdentityValues,
): string {
	return `function:${functionId}:identity:${buildIdentityValueKey(
		identities,
		values,
	)}`;
}

function buildIdentityValueKey(
	identities: ExecutionRateLimitIdentity[],
	values: ExecutionRateLimitIdentityValues,
): string {
	const stableIdentities = sortExecutionRateLimitIdentities(identities);
	return stableIdentities.map((identity) => `${identity}=${values[identity]}`).join("|");
}

function getRetryAfterMs(
	bucket: ExecutionRateLimitBucketState,
	now: number,
): number {
	return bucket.expires_at > now ? bucket.expires_at - now : 0;
}

function getBucketExpiry(
	bucket: Pick<ExecutionRateLimitBucketState, "window_started_at" | "penalty_until">,
	rule: FunctionRateLimitRule,
): number {
	const windowExpiresAt = bucket.window_started_at + rule.window_ms;
	return bucket.penalty_until
		? Math.max(windowExpiresAt, bucket.penalty_until)
		: windowExpiresAt;
}

function cleanupExpiredRateLimitBuckets(
	now: number,
	store: Map<string, ExecutionRateLimitBucketState>,
): void {
	if (
		lastRatelimitCleanupAt !== 0 &&
		now - lastRatelimitCleanupAt < RatelimitCleanupIntervalMs
	) {
		return;
	}

	lastRatelimitCleanupAt = now;

	for (const [key, bucket] of store.entries()) {
		if (bucket.expires_at <= now) {
			store.delete(key);
		}
	}
}

function getIdentityValuesForLog(
	identities: ExecutionRateLimitIdentity[] | undefined,
	values: ExecutionRateLimitIdentityValues,
): Partial<Record<ExecutionRateLimitIdentity, string>> | undefined {
	if (!identities?.length) {
		return undefined;
	}

	return Object.fromEntries(
		identities.map((identity) => [
			identity,
			getSafeIdentityValueForLog(identity, values[identity]),
		]),
	) as Partial<Record<ExecutionRateLimitIdentity, string>>;
}

function getSafeIdentityValueForLog(
	identity: ExecutionRateLimitIdentity,
	value: string,
): string {
	if (value === EXECUTION_RATELIMIT_MISSING_VALUE) {
		return value;
	}

	if (
		identity !== "access_key" &&
		identity !== "secure_header" &&
		identity !== "guest_session"
	) {
		return value;
	}

	if (value.length <= 8) {
		return "redacted";
	}

	return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function buildAppliedRateLimitDetail({
	scope,
	key,
	rule,
	bucket,
	now,
	mode,
	wouldBlock,
	policyId,
	policyName,
	identities,
	identityValues,
}: {
	scope: ExecutionRateLimitScope;
	key: string;
	rule: FunctionRateLimitRule;
	bucket: ExecutionRateLimitBucketState;
	now: number;
	mode: ExecutionRateLimitMode;
	wouldBlock: boolean;
	policyId?: string;
	policyName?: string;
	identities?: ExecutionRateLimitIdentity[];
	identityValues?: Partial<Record<ExecutionRateLimitIdentity, string>>;
}): AppliedExecutionRateLimit {
	return {
		scope,
		key,
		limit: rule.hits,
		remaining: Math.max(0, rule.hits - bucket.hits),
		reset_after_ms: getRetryAfterMs(bucket, now),
		window_ms: rule.window_ms,
		hits: bucket.hits,
		mode,
		would_block: wouldBlock,
		...(policyId ? { policy_id: policyId } : {}),
		...(policyName ? { policy_name: policyName } : {}),
		...(identities?.length ? { identities } : {}),
		...(identityValues ? { identity_values: identityValues } : {}),
	};
}

type AppliedRateLimitRuleResult =
	| {
			allowed: true;
			detail: AppliedExecutionRateLimit;
	  }
	| {
			allowed: false;
			detail: AppliedExecutionRateLimit;
			retry_after_ms: number;
			penalty_ms?: number;
	  };

function applyRateLimitRule(
	key: string,
	rule: FunctionRateLimitRule,
	now: number,
	scope: ExecutionRateLimitScope,
	store: Map<string, ExecutionRateLimitBucketState>,
	options: {
		mode?: ExecutionRateLimitMode;
		policyId?: string;
		policyName?: string;
		identities?: ExecutionRateLimitIdentity[];
		identityValues?: Partial<Record<ExecutionRateLimitIdentity, string>>;
	} = {},
): AppliedRateLimitRuleResult {
	cleanupExpiredRateLimitBuckets(now, store);
	const mode = options.mode ?? "enforce";

	const existing = store.get(key);
	if (existing && existing.expires_at <= now) {
		store.delete(key);
	}

	if (existing && existing.penalty_until && existing.penalty_until > now) {
		const detail = buildAppliedRateLimitDetail({
			scope,
			key,
			rule,
			bucket: existing,
			now,
			mode,
			wouldBlock: true,
			policyId: options.policyId,
			policyName: options.policyName,
			identities: options.identities,
			identityValues: options.identityValues,
		});

		if (mode === "observe") {
			return {
				allowed: true,
				detail,
			};
		}

		return {
			allowed: false,
			retry_after_ms: getRetryAfterMs(existing, now),
			detail,
			...(rule.penalty_ms && rule.penalty_ms > 0
				? { penalty_ms: rule.penalty_ms }
				: {}),
		};
	}

	const bucket =
		!existing || now - existing.window_started_at >= rule.window_ms
			? {
					hits: 0,
					window_started_at: now,
					expires_at: now + rule.window_ms,
				}
			: {
					hits: existing.hits,
					window_started_at: existing.window_started_at,
					expires_at: existing.expires_at,
					...(existing.penalty_until
						? { penalty_until: existing.penalty_until }
						: {}),
				};

	bucket.hits += 1;

	if (bucket.hits > rule.hits) {
		if (rule.penalty_ms && rule.penalty_ms > 0) {
			bucket.penalty_until = bucket.window_started_at + rule.window_ms + rule.penalty_ms;
		}
		bucket.expires_at = getBucketExpiry(bucket, rule);

		store.set(key, bucket);
		const detail = buildAppliedRateLimitDetail({
			scope,
			key,
			rule,
			bucket,
			now,
			mode,
			wouldBlock: true,
			policyId: options.policyId,
			policyName: options.policyName,
			identities: options.identities,
			identityValues: options.identityValues,
		});

		if (mode === "observe") {
			return {
				allowed: true,
				detail,
			};
		}

		return {
			allowed: false,
			retry_after_ms: getRetryAfterMs(bucket, now),
			detail,
			...(rule.penalty_ms && rule.penalty_ms > 0
				? { penalty_ms: rule.penalty_ms }
				: {}),
		};
	}

	delete bucket.penalty_until;
	bucket.expires_at = getBucketExpiry(bucket, rule);
	store.set(key, bucket);

	return {
		allowed: true,
		detail: buildAppliedRateLimitDetail({
			scope,
			key,
			rule,
			bucket,
			now,
			mode,
			wouldBlock: false,
			policyId: options.policyId,
			policyName: options.policyName,
			identities: options.identities,
			identityValues: options.identityValues,
		}),
	};
}

function matchesPattern(value: string, pattern: string): boolean {
	if (pattern === "*") {
		return true;
	}

	if (pattern.startsWith("*") && pattern.endsWith("*") && pattern.length > 2) {
		return value.includes(pattern.slice(1, -1));
	}

	if (pattern.startsWith("*")) {
		return value.endsWith(pattern.slice(1));
	}

	if (pattern.endsWith("*")) {
		return value.startsWith(pattern.slice(0, -1));
	}

	return value === pattern;
}

function matchesAnyPattern(
	value: string,
	patterns: string[] | undefined,
): boolean {
	if (!patterns?.length) {
		return true;
	}

	return patterns.some((pattern) => matchesPattern(value, pattern));
}

function doesPolicyMatch(
	policy: FunctionRateLimitPolicy,
	values: ExecutionRateLimitIdentityValues,
): boolean {
	if (policy.enabled === false) {
		return false;
	}

	const match = policy.match;
	if (!match) {
		return true;
	}

	return (
		matchesAnyPattern(values.method, match.methods) &&
		matchesAnyPattern(values.route, match.routes) &&
		matchesAnyPattern(values.origin, match.origins)
	);
}

function getConfiguredPolicyApplications(
	functionId: number,
	config: FunctionRateLimitConfig,
	identityValues: ExecutionRateLimitIdentityValues,
): Array<{
	key: string;
	rule: FunctionRateLimitRule;
	scope: ExecutionRateLimitScope;
	mode: ExecutionRateLimitMode;
	policyId?: string;
	policyName?: string;
	identities?: ExecutionRateLimitIdentity[];
	identityValues?: Partial<Record<ExecutionRateLimitIdentity, string>>;
}> {
	if (!config.enabled) {
		return [];
	}

	const applications: Array<{
		key: string;
		rule: FunctionRateLimitRule;
		scope: ExecutionRateLimitScope;
		mode: ExecutionRateLimitMode;
		policyId?: string;
		policyName?: string;
		identities?: ExecutionRateLimitIdentity[];
		identityValues?: Partial<Record<ExecutionRateLimitIdentity, string>>;
	}> = [];

	if (config.global) {
		applications.push({
			key: buildFunctionGlobalRateLimitKey(functionId),
			rule: config.global,
			scope: "global",
			mode: "enforce",
			policyId: "legacy-global",
			policyName: "Global Bucket",
		});
	}

	if (
		config.identity_limit &&
		config.identities &&
		config.identities.length > 0
	) {
		applications.push({
			key: buildFunctionIdentityRateLimitKey(
				functionId,
				config.identities,
				identityValues,
			),
			rule: config.identity_limit,
			scope: "identity",
			mode: "enforce",
			policyId: "legacy-identity",
			policyName: "Identity Bucket",
			identities: config.identities,
			identityValues: getIdentityValuesForLog(config.identities, identityValues),
		});
	}

	for (const policy of config.policies ?? []) {
		if (!doesPolicyMatch(policy, identityValues)) {
			continue;
		}

		const identities =
			policy.scope === "identity" ? policy.identities ?? [] : undefined;
		applications.push({
			key:
				policy.scope === "global"
					? `function:${functionId}:policy:${policy.id}:global`
					: `function:${functionId}:policy:${policy.id}:identity:${buildIdentityValueKey(
							identities ?? [],
							identityValues,
						)}`,
			rule: policy.rule,
			scope: policy.scope,
			mode: policy.mode ?? "enforce",
			policyId: policy.id,
			policyName: policy.name,
			...(identities?.length ? { identities } : {}),
			...(identities?.length
				? { identityValues: getIdentityValuesForLog(identities, identityValues) }
				: {}),
		});
	}

	return applications;
}

export function enforceFunctionRateLimit(
	functionId: number,
	config: FunctionRateLimitConfig,
	identityValues: ExecutionRateLimitIdentityValues,
	now = Date.now(),
	store = ratelimitBucketStore,
): FunctionRateLimitEnforcementResult {
	if (!config.enabled) {
		return { allowed: true, applied: [] };
	}

	const applied: AppliedExecutionRateLimit[] = [];
	const applications = getConfiguredPolicyApplications(
		functionId,
		config,
		identityValues,
	);

	for (const application of applications) {
		const result = applyRateLimitRule(
			application.key,
			application.rule,
			now,
			application.scope,
			store,
			{
				mode: application.mode,
				policyId: application.policyId,
				policyName: application.policyName,
				identities: application.identities,
				identityValues: application.identityValues,
			},
		);
		applied.push(result.detail);

		if (!result.allowed) {
			const blockedResult: FunctionRateLimitEnforcementResultBlocked = {
				allowed: false,
				scope: result.detail.scope,
				key: result.detail.key,
				retry_after_ms: result.retry_after_ms,
				limit: result.detail.limit,
				remaining: result.detail.remaining,
				reset_after_ms: result.detail.reset_after_ms,
				mode: result.detail.mode,
				applied,
			};

			if (result.penalty_ms !== undefined) {
				blockedResult.penalty_ms = result.penalty_ms;
			}
			if (result.detail.policy_id) {
				blockedResult.policy_id = result.detail.policy_id;
			}
			if (result.detail.policy_name) {
				blockedResult.policy_name = result.detail.policy_name;
			}
			if (result.detail.identities) {
				blockedResult.identities = result.detail.identities;
			}
			if (result.detail.identity_values) {
				blockedResult.identity_values = result.detail.identity_values;
			}

			return blockedResult;
		}
	}

	return { allowed: true, applied };
}

export function getPrimaryAppliedRateLimit(
	applied: AppliedExecutionRateLimit[] | undefined,
): AppliedExecutionRateLimit | null {
	if (!applied || applied.length === 0) {
		return null;
	}

	return [...applied].sort((a, b) => {
		if (a.remaining !== b.remaining) {
			return a.remaining - b.remaining;
		}
		if (a.limit !== b.limit) {
			return a.limit - b.limit;
		}
		return a.reset_after_ms - b.reset_after_ms;
	})[0];
}

export function buildLoggedExecutionRateLimitData(
	config: FunctionRateLimitConfig,
	result: FunctionRateLimitEnforcementResult,
	identityValues?: ExecutionRateLimitIdentityValues,
): LoggedExecutionRateLimitData {
	if (!config.enabled) {
		return {
			configured: false,
			blocked: false,
		};
	}

	const applied = result.applied ?? [];
	const primary = result.allowed
		? getPrimaryAppliedRateLimit(applied)
		: getPrimaryAppliedRateLimit(applied) ??
			({
				scope: result.scope,
				key: result.key,
				limit: result.limit,
				remaining: result.remaining,
				reset_after_ms: result.reset_after_ms,
				window_ms: result.reset_after_ms,
				hits: result.limit,
				mode: result.mode,
				would_block: true,
				policy_id: result.policy_id,
				policy_name: result.policy_name,
				identities: result.identities,
				identity_values: result.identity_values,
			} as AppliedExecutionRateLimit);
	const selectedIdentityValues = config.identities?.length
		? Object.fromEntries(
				config.identities.map((identity) => [
					identity,
					getSafeIdentityValueForLog(
						identity,
						identityValues?.[identity] ?? EXECUTION_RATELIMIT_MISSING_VALUE,
					),
				]),
			)
		: undefined;
	const resolvedScope = result.allowed ? primary?.scope : result.scope;
	const resolvedLimit = primary?.limit;
	const resolvedRemaining = primary?.remaining;
	const resolvedResetAfterMs = primary?.reset_after_ms;
	const resolvedMode = primary?.mode;
	const resolvedPolicyId = primary?.policy_id;
	const resolvedPolicyName = primary?.policy_name;
	const resolvedIdentities = primary?.identities?.length
		? primary.identities
		: config.identities?.length
			? config.identities
			: undefined;
	const resolvedIdentityValues =
		primary?.identity_values ?? selectedIdentityValues;

	const loggedData: LoggedExecutionRateLimitData = {
		configured: true,
		blocked: !result.allowed,
		would_block: !result.allowed || applied.some((detail) => detail.would_block),
	};

	if (config.global) {
		loggedData.global = config.global;
	}
	if (config.identity_limit) {
		loggedData.identity_limit = config.identity_limit;
	}
	if (resolvedIdentities) {
		loggedData.identities = resolvedIdentities;
	}
	if (resolvedIdentityValues) {
		loggedData.identity_values = resolvedIdentityValues;
	}
	if (resolvedScope) {
		loggedData.scope = resolvedScope;
	}
	if (resolvedLimit !== undefined) {
		loggedData.limit = resolvedLimit;
	}
	if (resolvedRemaining !== undefined) {
		loggedData.remaining = resolvedRemaining;
	}
	if (resolvedResetAfterMs !== undefined) {
		loggedData.reset_after_ms = resolvedResetAfterMs;
	}
	if (resolvedMode) {
		loggedData.mode = resolvedMode;
	}
	if (resolvedPolicyId) {
		loggedData.policy_id = resolvedPolicyId;
	}
	if (resolvedPolicyName) {
		loggedData.policy_name = resolvedPolicyName;
	}
	if (applied.length) {
		loggedData.applied = applied;
	}
	if (!result.allowed) {
		loggedData.retry_after_ms = result.retry_after_ms;
		if (result.penalty_ms !== undefined) {
			loggedData.penalty_ms = result.penalty_ms;
		}
	}

	return loggedData;
}

export function resetFunctionRateLimitState(): void {
	ratelimitBucketStore.clear();
	lastRatelimitCleanupAt = 0;
}

export type FunctionWithRateLimitConfig = Pick<
	Function,
	"id" | "ratelimit" | "namespaceId" | "executionId" | "executionAlias"
>;
