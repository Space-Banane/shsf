import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import {
	EXECUTION_RATELIMIT_IDENTITIES,
	ExecutionRateLimitIdentity,
	FunctionRateLimitConfig,
	FunctionRateLimitMatcher,
	FunctionRateLimitPolicy,
	FunctionRateLimitRule,
	getRateLimitConfigFromData,
	hasConfiguredRateLimitBuckets,
	normalizeFunctionRateLimitConfig,
	setRateLimitConfig,
} from "../../../lib/FunctionRateLimit";
import { OpenAPITags } from "../../../lib/openapi";

type RateLimitRuleBody = {
	hits?: number;
	window_ms?: number;
	penalty_ms?: number | null;
} | null | undefined;

type RateLimitPolicyBody = {
	id?: string;
	name?: string;
	scope: "global" | "identity";
	rule: FunctionRateLimitRule;
	mode?: "enforce" | "observe";
	enabled?: boolean;
	identities?: ExecutionRateLimitIdentity[];
	match?: FunctionRateLimitMatcher;
};

function rateLimitRuleSchema() {
	return {
		type: "object",
		properties: {
			hits: { type: "integer", minimum: 1 },
			window_ms: { type: "integer", minimum: 1 },
			penalty_ms: { type: "integer", minimum: 0, nullable: true },
		},
		required: ["hits", "window_ms"],
	} as any;
}

function nullableRateLimitRuleSchema() {
	return {
		...rateLimitRuleSchema(),
		nullable: true,
	} as any;
}

function rateLimitMatcherSchema() {
	return {
		type: "object",
		properties: {
			methods: { type: "array", items: { type: "string" } },
			routes: { type: "array", items: { type: "string" } },
			origins: { type: "array", items: { type: "string" } },
		},
	} as any;
}

function rateLimitPolicySchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			name: { type: "string" },
			scope: { type: "string", enum: ["global", "identity"] },
			mode: { type: "string", enum: ["enforce", "observe"] },
			enabled: { type: "boolean" },
			rule: rateLimitRuleSchema(),
			identities: {
				type: "array",
				items: {
					type: "string",
					enum: [...EXECUTION_RATELIMIT_IDENTITIES],
				},
			},
			match: rateLimitMatcherSchema(),
		},
		required: ["scope", "rule"],
	} as any;
}

function mapConfigResponse(config: FunctionRateLimitConfig) {
	if (!config.enabled) {
		return { enabled: false };
	}

	return {
		enabled: true,
		...(config.global ? { global: config.global } : {}),
		...(config.identities ? { identities: config.identities } : {}),
		...(config.identity_limit ? { identity_limit: config.identity_limit } : {}),
		...(config.policies ? { policies: config.policies } : {}),
	};
}

function normalizeRuleFromBody(
	rule: RateLimitRuleBody,
): FunctionRateLimitRule | null | undefined {
	if (rule === null) {
		return null;
	}

	if (!rule) {
		return undefined;
	}

	return {
		hits: rule.hits as number,
		window_ms: rule.window_ms as number,
		...(rule.penalty_ms !== undefined && rule.penalty_ms !== null
			? { penalty_ms: rule.penalty_ms }
			: {}),
	};
}

function normalizePolicyFromBody(
	policy: RateLimitPolicyBody,
	index: number,
): FunctionRateLimitPolicy {
	return {
		id: policy.id?.trim() || `policy-${index + 1}`,
		name:
			policy.name?.trim() ||
			(policy.scope === "global" ? "Global policy" : "Identity policy"),
		scope: policy.scope,
		rule: policy.rule,
		mode: policy.mode === "observe" ? "observe" : "enforce",
		enabled: policy.enabled === false ? false : true,
		...(policy.identities ? { identities: policy.identities } : {}),
		...(policy.match ? { match: policy.match } : {}),
	};
}

export = new fileRouter.Path("/")
	.http("GET", "/api/function/{id}/ratelimit", (http) =>
		http
			.document({
				description: "Get execution rate limit configuration for a function",
				tags: ["Functions"] as OpenAPITags[],
				operationId: "getFunctionRateLimitConfig",
				parameters: [
					{
						in: "path",
						name: "id",
						required: true,
						schema: { type: "integer" },
						description: "ID of the function",
					},
				],
				responses: {
					200: {
						description: "Rate limit configuration fetched successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: {
											type: "object",
											properties: {
												enabled: { type: "boolean" },
												global: rateLimitRuleSchema(),
												identities: {
													type: "array",
													items: {
														type: "string",
														enum: [...EXECUTION_RATELIMIT_IDENTITIES],
													},
												},
												identity_limit: rateLimitRuleSchema(),
												policies: {
													type: "array",
													items: rateLimitPolicySchema(),
												},
											},
											required: ["enabled"],
										},
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);
				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "ERROR",
						message: "Unauthorized",
					});
				}

				const id = ctr.params.get("id");
				if (!id || isNaN(parseInt(id))) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "ERROR",
						message: "Invalid function ID",
					});
				}

				const functionData = await prisma.function.findFirst({
					where: { id: parseInt(id), userId: authCheck.user.id },
				});
				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: "ERROR",
						message: "Function not found",
					});
				}

				const config = await getRateLimitConfigFromData(functionData.ratelimit);
				return ctr.print({
					status: "OK",
					data: mapConfigResponse(config),
				});
			}),
	)
	.http("PATCH", "/api/function/{id}/ratelimit", (http) =>
		http
			.document({
				description: "Update execution rate limit configuration for a function",
				tags: ["Functions"] as OpenAPITags[],
				operationId: "updateFunctionRateLimitConfig",
				parameters: [
					{
						in: "path",
						name: "id",
						required: true,
						schema: { type: "integer" },
						description: "ID of the function",
					},
				],
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									enabled: { type: "boolean" },
									global: nullableRateLimitRuleSchema(),
									identities: {
										type: "array",
										items: {
											type: "string",
											enum: [...EXECUTION_RATELIMIT_IDENTITIES],
										},
									},
									identity_limit: nullableRateLimitRuleSchema(),
									policies: {
										type: "array",
										items: rateLimitPolicySchema(),
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "Rate limit configuration updated successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										message: { type: "string" },
										data: {
											type: "object",
											properties: {
												enabled: { type: "boolean" },
												global: rateLimitRuleSchema(),
												identities: {
													type: "array",
													items: {
														type: "string",
														enum: [...EXECUTION_RATELIMIT_IDENTITIES],
													},
												},
												identity_limit: rateLimitRuleSchema(),
												policies: {
													type: "array",
													items: rateLimitPolicySchema(),
												},
											},
											required: ["enabled"],
										},
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);
				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "ERROR",
						message: "Unauthorized",
					});
				}

				const [body] = await ctr.bindBody((z) =>
					z.object({
						enabled: z.boolean().optional(),
						global: z
							.object({
								hits: z.number().int().positive(),
								window_ms: z.number().int().positive(),
								penalty_ms: z.number().int().min(0).nullable().optional(),
							})
							.nullable()
							.optional(),
						identities: z
							.array(
								z.enum(
									EXECUTION_RATELIMIT_IDENTITIES as unknown as [
										ExecutionRateLimitIdentity,
										...ExecutionRateLimitIdentity[],
									],
								),
							)
							.optional(),
						identity_limit: z
							.object({
								hits: z.number().int().positive(),
								window_ms: z.number().int().positive(),
								penalty_ms: z.number().int().min(0).nullable().optional(),
							})
							.nullable()
							.optional(),
						policies: z
							.array(
								z.object({
									id: z.string().optional(),
									name: z.string().optional(),
									scope: z.enum(["global", "identity"]),
									mode: z.enum(["enforce", "observe"]).optional(),
									enabled: z.boolean().optional(),
									rule: z.object({
										hits: z.number().int().positive(),
										window_ms: z.number().int().positive(),
										penalty_ms: z.number().int().min(0).nullable().optional(),
									}),
									identities: z
										.array(
											z.enum(
												EXECUTION_RATELIMIT_IDENTITIES as unknown as [
													ExecutionRateLimitIdentity,
													...ExecutionRateLimitIdentity[],
												],
											),
										)
										.optional(),
									match: z
										.object({
											methods: z.array(z.string().min(1)).optional(),
											routes: z.array(z.string().min(1)).optional(),
											origins: z.array(z.string().min(1)).optional(),
										})
										.optional(),
								}),
							)
							.optional(),
					}),
				);

				if (!body) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "ERROR",
						message: "Invalid request body",
					});
				}

				const id = ctr.params.get("id");
				if (!id || isNaN(parseInt(id))) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: "ERROR",
						message: "Invalid function ID",
					});
				}
				const functionId = parseInt(id);

				const functionData = await prisma.function.findFirst({
					where: { id: functionId, userId: authCheck.user.id },
				});
				if (!functionData) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: "ERROR",
						message: "Function not found",
					});
				}

				const currentConfig = await getRateLimitConfigFromData(functionData.ratelimit);

				let newConfig: FunctionRateLimitConfig;
				if (body.enabled === false) {
					newConfig = { enabled: false };
				} else {
					const enablingFieldsProvided =
						body.global !== undefined ||
						body.identities !== undefined ||
						body.identity_limit !== undefined ||
						body.policies !== undefined ||
						body.enabled === true;
					const replacingLegacyWithPolicies =
						body.policies !== undefined &&
						body.global === undefined &&
						body.identities === undefined &&
						body.identity_limit === undefined;
					const currentEnabledConfig =
						currentConfig.enabled ? currentConfig : null;
					const nextGlobal = normalizeRuleFromBody(body.global);
					const nextIdentityLimit = normalizeRuleFromBody(body.identity_limit);
					const nextEnabled =
						body.enabled ?? (currentConfig.enabled || enablingFieldsProvided);

					if (!nextEnabled) {
						newConfig = { enabled: false };
						await setRateLimitConfig(functionId, newConfig);
						return ctr.print({
							status: "OK",
							message: "Rate limit configuration updated successfully",
							data: mapConfigResponse(newConfig),
						});
					}

					const nextConfig: Extract<FunctionRateLimitConfig, { enabled: true }> = {
						enabled: true,
					};

					if (replacingLegacyWithPolicies || nextGlobal === null) {
						// cleared
					} else if (nextGlobal !== undefined) {
						nextConfig.global = nextGlobal;
					} else if (currentEnabledConfig?.global) {
						nextConfig.global = currentEnabledConfig.global;
					}

					if (replacingLegacyWithPolicies) {
						// cleared
					} else if (body.identities !== undefined) {
						nextConfig.identities = body.identities;
					} else if (currentEnabledConfig?.identities) {
						nextConfig.identities = currentEnabledConfig.identities;
					}

					if (replacingLegacyWithPolicies || nextIdentityLimit === null) {
						// cleared
					} else if (nextIdentityLimit !== undefined) {
						nextConfig.identity_limit = nextIdentityLimit;
					} else if (currentEnabledConfig?.identity_limit) {
						nextConfig.identity_limit = currentEnabledConfig.identity_limit;
					}

					if (body.policies !== undefined) {
						nextConfig.policies = body.policies.map((policy, index) =>
							normalizePolicyFromBody(policy as RateLimitPolicyBody, index),
						);
					} else if (currentEnabledConfig?.policies) {
						nextConfig.policies = currentEnabledConfig.policies;
					}

					newConfig = normalizeFunctionRateLimitConfig(nextConfig);
					if (!hasConfiguredRateLimitBuckets(newConfig)) {
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: "ERROR",
							message:
								'Enabled rate limit config must include at least one active bucket via "global", "identity_limit" with "identities", or an enabled policy',
						});
					}
				}

				await setRateLimitConfig(functionId, newConfig);
				return ctr.print({
					status: "OK",
					message: "Rate limit configuration updated successfully",
					data: mapConfigResponse(newConfig),
				});
			}),
	);
