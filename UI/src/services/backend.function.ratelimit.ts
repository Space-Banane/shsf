import { BASE_URL } from "..";

export type ExecutionRateLimitIdentity =
	| "ip"
	| "method"
	| "route"
	| "origin"
	| "access_key"
	| "secure_header"
	| "guest_session"
	| "execution_alias_or_id";

export interface RateLimitRule {
	hits: number;
	window_ms: number;
	penalty_ms?: number;
}

export interface RateLimitMatcher {
	methods?: string[];
	routes?: string[];
	origins?: string[];
}

export interface RateLimitPolicy {
	id: string;
	name: string;
	scope: "global" | "identity";
	rule: RateLimitRule;
	mode?: "enforce" | "observe";
	enabled?: boolean;
	identities?: ExecutionRateLimitIdentity[];
	match?: RateLimitMatcher;
}

export interface RateLimitConfig {
	enabled: boolean;
	global?: RateLimitRule;
	identities?: ExecutionRateLimitIdentity[];
	identity_limit?: RateLimitRule;
	policies?: RateLimitPolicy[];
}

interface OKResponse {
	status: "OK";
	message: string;
	data?: RateLimitConfig;
}

interface GetRateLimitConfigResponse {
	status: "OK";
	data: RateLimitConfig;
}

interface ErrorResponse {
	status: "ERROR" | number;
	message: string;
}

export async function getRateLimitConfig(
	functionId: number,
): Promise<GetRateLimitConfigResponse | ErrorResponse> {
	const response = await fetch(`${BASE_URL}/api/function/${functionId}/ratelimit`, {
		method: "GET",
		credentials: "include",
	});

	return await response.json();
}

export async function updateRateLimitConfig(
	functionId: number,
	config: {
		enabled?: boolean;
		global?: RateLimitRule | null;
		identities?: ExecutionRateLimitIdentity[];
		identity_limit?: RateLimitRule | null;
		policies?: RateLimitPolicy[];
	},
): Promise<OKResponse | ErrorResponse> {
	const response = await fetch(`${BASE_URL}/api/function/${functionId}/ratelimit`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify(config),
	});

	return await response.json();
}
