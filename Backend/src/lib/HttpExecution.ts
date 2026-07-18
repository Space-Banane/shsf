import { Function, FunctionFile } from "@prisma/client";
import { checkHttpExecutionPermission } from "./Authentication";
import { getPayloadHash, getFunctionCache, handleFunctionResult, setFunctionCache } from "./Caching";
import {
	buildPayloadFromGET,
	buildPayloadFromPOST,
	executeFunction,
	persistFunctionExecutionLog,
} from "./Runner";
import {
	buildLoggedExecutionRateLimitData,
	enforceFunctionRateLimit,
	ExecutionRateLimitIdentityValues,
	extractExecutionIdentityValues,
	FunctionRateLimitConfig,
	FunctionRateLimitEnforcementResult,
	getExecutionRateLimitConfigFromData,
	getPrimaryAppliedRateLimit,
} from "./FunctionRateLimit";

type FunctionExecutionData = Function & {
	files: FunctionFile[];
	namespace: {
		id: number;
		name: string;
	};
};

interface ExecuteLoadedHttpFunctionOptions {
	ctr: any;
	functionData: FunctionExecutionData;
	method: "GET" | "POST";
	namespaceId: number;
	permissionFunctionId: string;
	executionAliasOrId: string;
	useCache: boolean;
	dependencies?: {
		buildPayloadFromGET?: typeof buildPayloadFromGET;
		buildPayloadFromPOST?: typeof buildPayloadFromPOST;
		checkHttpExecutionPermission?: typeof checkHttpExecutionPermission;
		executeFunction?: typeof executeFunction;
		getPayloadHash?: typeof getPayloadHash;
		getFunctionCache?: typeof getFunctionCache;
		setFunctionCache?: typeof setFunctionCache;
		handleFunctionResult?: typeof handleFunctionResult;
		persistFunctionExecutionLog?: typeof persistFunctionExecutionLog;
		getRateLimitConfigFromData?: (
			ratelimit: string | null,
		) => Promise<FunctionRateLimitConfig>;
		enforceFunctionRateLimit?: (
			functionId: number,
			config: FunctionRateLimitConfig,
			identityValues: ExecutionRateLimitIdentityValues,
		) => FunctionRateLimitEnforcementResult;
		extractExecutionIdentityValues?: typeof extractExecutionIdentityValues;
	};
}

function setExecutionRateLimitHeaders(
	ctr: any,
	result: FunctionRateLimitEnforcementResult,
) {
	const primary = getPrimaryAppliedRateLimit(result.applied ?? []);
	if (!primary) {
		return;
	}

	const resetSeconds = Math.max(1, Math.ceil(primary.reset_after_ms / 1000));
	ctr.headers.set("RateLimit-Limit", String(primary.limit));
	ctr.headers.set("RateLimit-Remaining", String(primary.remaining));
	ctr.headers.set("RateLimit-Reset", String(resetSeconds));
	ctr.headers.set("X-RateLimit-Limit", String(primary.limit));
	ctr.headers.set("X-RateLimit-Remaining", String(primary.remaining));
	ctr.headers.set("X-RateLimit-Reset", String(resetSeconds));

	if (primary.policy_name || primary.policy_id) {
		ctr.headers.set(
			"RateLimit-Policy",
			primary.policy_name || primary.policy_id,
		);
	}
}

export async function executeLoadedHttpFunction(
	options: ExecuteLoadedHttpFunctionOptions,
) {
	const {
		ctr,
		functionData,
		method,
		namespaceId,
		permissionFunctionId,
		executionAliasOrId,
		useCache,
	} = options;
	const dependencies: Required<
		NonNullable<ExecuteLoadedHttpFunctionOptions["dependencies"]>
	> = {
		buildPayloadFromGET,
		buildPayloadFromPOST,
		checkHttpExecutionPermission,
		executeFunction,
		getPayloadHash,
		getFunctionCache,
		setFunctionCache,
		handleFunctionResult,
		persistFunctionExecutionLog,
		getRateLimitConfigFromData: getExecutionRateLimitConfigFromData,
		enforceFunctionRateLimit,
		extractExecutionIdentityValues,
		...options.dependencies,
	};

	const buildHttpLogPayload = (
		identityValues: ExecutionRateLimitIdentityValues,
		route: string,
	) =>
		JSON.stringify({
			ran_by: "exec",
			method,
			route,
			source_ip: identityValues.ip,
			origin:
				identityValues.origin === "__missing__" ? null : identityValues.origin,
		});

	if (!functionData.allow_http) {
		return ctr.status(ctr.$status.FORBIDDEN).print({
			status: 403,
			message: "HTTP execution is not allowed for this function",
		});
	}

	const permissionToExecute = await dependencies.checkHttpExecutionPermission(
		ctr,
		functionData,
		namespaceId,
		permissionFunctionId,
	);

	if (permissionToExecute.redirect) {
		return ctr
			.status(ctr.$status.TEMPORARY_REDIRECT)
			.redirect(permissionToExecute.redirect);
	}
	if (!permissionToExecute.state) {
		return ctr.status(ctr.$status.FORBIDDEN).print({
			status: 403,
			message: permissionToExecute.reason,
		});
	}

	const ratelimitConfig = await dependencies.getRateLimitConfigFromData(
		functionData.ratelimit,
	);
	const route = ctr.params.get("route") || "default";
	const identityValues = dependencies.extractExecutionIdentityValues({
		ctr,
		namespaceId,
		functionIdentifier: permissionFunctionId,
		method,
		route,
		executionAliasOrId,
	});
	const ratelimitResult = dependencies.enforceFunctionRateLimit(
		functionData.id,
		ratelimitConfig,
		identityValues,
	);
	const loggedRateLimit = buildLoggedExecutionRateLimitData(
		ratelimitConfig,
		ratelimitResult,
		identityValues,
	);
	setExecutionRateLimitHeaders(ctr, ratelimitResult);

	if (!ratelimitResult.allowed) {
		const retrySeconds = Math.max(
			1,
			Math.ceil(ratelimitResult.retry_after_ms / 1000),
		);
		const retryMessage = `${ratelimitResult.retry_after_ms}ms`;
		const penaltyMessage =
			ratelimitResult.penalty_ms && ratelimitResult.penalty_ms > 0
				? ` Includes a ${ratelimitResult.penalty_ms}ms penalty.`
				: "";

		ctr.headers.set(
			"Retry-After",
			String(retrySeconds),
		);

		await dependencies.persistFunctionExecutionLog({
			functionId: functionData.id,
			functionData,
			logs: `HTTP execution blocked by rate limit (${ratelimitResult.scope})`,
			output: JSON.stringify({
				status: "FAILED",
				message: "Function execution rate limit exceeded",
				scope: ratelimitResult.scope,
			}),
			payload: buildHttpLogPayload(identityValues, route),
			exit_code: 429,
			tooks: [
				{
					description: "HTTP execution blocked before runtime",
					value: 0,
					timestamp: Date.now(),
				},
			],
			ratelimit: loggedRateLimit,
			error_type: "rate_limit_blocked",
			force: true,
		});

		return ctr.status(ctr.$status.TOO_MANY_REQUESTS).print({
			status: "FAILED",
			message: `Function execution rate limit exceeded. Retry again in ${retryMessage}.${penaltyMessage}`,
			scope: ratelimitResult.scope,
			...(ratelimitResult.policy_id ? { policy_id: ratelimitResult.policy_id } : {}),
			...(ratelimitResult.policy_name
				? { policy_name: ratelimitResult.policy_name }
				: {}),
			retry_after_ms: ratelimitResult.retry_after_ms,
			limit: ratelimitResult.limit,
			remaining: ratelimitResult.remaining,
			reset_after_ms: ratelimitResult.reset_after_ms,
			...(ratelimitResult.penalty_ms
				? { penalty_ms: ratelimitResult.penalty_ms }
				: {}),
		});
	}

	const payload =
		method === "GET"
			? await dependencies.buildPayloadFromGET(ctr as Parameters<typeof buildPayloadFromGET>[0])
			: await dependencies.buildPayloadFromPOST(ctr as Parameters<typeof buildPayloadFromPOST>[0]);
	const payloadHash =
		useCache && functionData.cache_enabled
			? dependencies.getPayloadHash(payload)
			: null;

	if (useCache && functionData.cache_enabled) {
		const cached = await dependencies.getFunctionCache(
			functionData.id,
			payloadHash as string,
		);
		if (cached) {
			// Cache hits are still executions from the caller's perspective —
			// without this, functions with caching enabled only ever log their
			// failures (errors are never cached), making the log view look like
			// the function does nothing but fail.
			await dependencies.persistFunctionExecutionLog({
				functionId: functionData.id,
				functionData,
				logs: "Result served from response cache — function code was not executed.",
				output: cached.result,
				payload: buildHttpLogPayload(identityValues, route),
				exit_code: 0,
				tooks: [
					{
						description: "Served from response cache",
						value: 0,
						timestamp: Date.now(),
					},
				],
				ratelimit: loggedRateLimit,
			});

			return dependencies.handleFunctionResult(
				ctr,
				JSON.parse(cached.result),
				true,
			);
		}
	}

	const result = await dependencies.executeFunction(
		functionData.id,
		functionData,
		functionData.files,
		{ enabled: false },
		JSON.stringify({
			ran_by: "exec",
			...(typeof payload === "object" && payload !== null ? payload : {}),
		}),
		{
			ratelimit: loggedRateLimit,
			mode: "production_execute",
		},
	);

	if (result?.exit_code === 0 && useCache && functionData.cache_enabled) {
		await dependencies.setFunctionCache(
			functionData.id,
			payloadHash as string,
			result.result,
			functionData.cache_ttl ?? 60,
		);
	}

	return dependencies.handleFunctionResult(ctr, result?.result, false);
}
