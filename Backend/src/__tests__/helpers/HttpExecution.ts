import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeLoadedHttpFunction } from "../../lib/HttpExecution";

const baseFunctionData = {
	id: 10,
	userId: 2,
	name: "Test",
	description: "Test",
	image: "img",
	executionId: "exec-123",
	executionAlias: "alias-123",
	max_ram: 512,
	timeout: 15,
	allow_http: true,
	env: null,
	secure_header: null,
	retry_on_failure: false,
	max_retries: 3,
	tags: null,
	startup_file: "main.py",
	cors_origins: null,
	docker_mount: false,
	network_restricted: false,
	ffmpeg_install: false,
	opencv_install: false,
	git_url: null,
	git_username: null,
	git_password: null,
	git_periodic_pull: false,
	git_pull_interval: 10,
	git_source_dir: null,
	git_branch: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	lastRun: null,
	namespaceId: 7,
	logging: null,
	ratelimit: JSON.stringify({
		enabled: true,
		global: { hits: 1, window_ms: 1000 },
	}),
	guest_access: false,
	imported: false,
	cache_enabled: true,
	cache_ttl: 60,
	files: [{ id: 1, name: "main.py", content: "print('x')", functionId: 10 }],
	namespace: { id: 7, name: "Default" },
};

function createCtr() {
	const ctr: any = {
		params: {
			get: (name: string) => (name === "route" ? null : null),
		},
		headers: {
			set: vi.fn(),
		},
		$status: {
			FORBIDDEN: 403,
			TEMPORARY_REDIRECT: 307,
			TOO_MANY_REQUESTS: 429,
		},
		print: vi.fn().mockResolvedValue({ ok: true }),
		redirect: vi.fn(),
	};

	ctr.status = vi.fn(() => ctr);

	return {
		...ctr,
	};
}

describe("executeLoadedHttpFunction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 429 before payload build or execution when over limit", async () => {
		const ctr = createCtr();
		const buildPayloadFromGET = vi.fn();
		const executeFunction = vi.fn();
		const persistFunctionExecutionLog = vi.fn().mockResolvedValue(undefined);

		await executeLoadedHttpFunction({
			ctr,
			functionData: baseFunctionData as any,
			method: "GET",
			namespaceId: 7,
			permissionFunctionId: "exec-123",
			executionAliasOrId: "exec-123",
			useCache: true,
			dependencies: {
				checkHttpExecutionPermission: vi.fn().mockResolvedValue({
					state: true,
					reason: "",
				}),
				getRateLimitConfigFromData: vi.fn().mockResolvedValue({
					enabled: true,
					global: { hits: 1, window_ms: 1000 },
				}),
				extractExecutionIdentityValues: vi.fn().mockReturnValue({
					ip: "1.2.3.4",
					method: "GET",
					route: "default",
					origin: "__missing__",
					access_key: "__missing__",
					secure_header: "__missing__",
					guest_session: "__missing__",
					execution_alias_or_id: "exec-123",
				}),
				enforceFunctionRateLimit: vi.fn().mockReturnValue({
					allowed: false,
					scope: "global",
					key: "function:10:global",
					retry_after_ms: 1300,
					penalty_ms: 400,
				}),
				persistFunctionExecutionLog,
				buildPayloadFromGET,
				executeFunction,
			},
		});

		expect(ctr.status).toHaveBeenCalledWith(429);
		expect(ctr.headers.set).toHaveBeenCalledWith("Retry-After", "2");
		expect(buildPayloadFromGET).not.toHaveBeenCalled();
		expect(executeFunction).not.toHaveBeenCalled();
		expect(persistFunctionExecutionLog).toHaveBeenCalledWith(
			expect.objectContaining({
				functionId: 10,
				exit_code: 429,
				error_type: "rate_limit_blocked",
				ratelimit: expect.objectContaining({
					configured: true,
					blocked: true,
					scope: "global",
					retry_after_ms: 1300,
					penalty_ms: 400,
				}),
			}),
		);
		expect(ctr.print).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "FAILED",
				message:
					"Function execution rate limit exceeded. Retry again in 1300ms. Includes a 400ms penalty.",
				retry_after_ms: 1300,
				penalty_ms: 400,
			}),
		);
	});

	it("continues through cache and execution when allowed", async () => {
		const ctr = createCtr();
		const buildPayloadFromPOST = vi.fn().mockResolvedValue({ body: "{}", route: "default" });
		const getPayloadHash = vi.fn().mockReturnValue("hash-1");
		const getFunctionCache = vi.fn().mockResolvedValue(null);
		const executeFunction = vi.fn().mockResolvedValue({
			exit_code: 0,
			result: JSON.stringify({ ok: true }),
		});
		const setFunctionCache = vi.fn().mockResolvedValue(undefined);
		const handleFunctionResult = vi.fn().mockReturnValue("handled");

		const result = await executeLoadedHttpFunction({
			ctr,
			functionData: baseFunctionData as any,
			method: "POST",
			namespaceId: 7,
			permissionFunctionId: "exec-123",
			executionAliasOrId: "alias-123",
			useCache: true,
			dependencies: {
				checkHttpExecutionPermission: vi.fn().mockResolvedValue({
					state: true,
					reason: "",
				}),
				getRateLimitConfigFromData: vi.fn().mockResolvedValue({ enabled: false }),
				extractExecutionIdentityValues: vi.fn().mockReturnValue({
					ip: "1.2.3.4",
					method: "POST",
					route: "default",
					origin: "__missing__",
					access_key: "__missing__",
					secure_header: "__missing__",
					guest_session: "__missing__",
					execution_alias_or_id: "alias-123",
				}),
				enforceFunctionRateLimit: vi.fn().mockReturnValue({ allowed: true }),
				buildPayloadFromPOST,
				getPayloadHash,
				getFunctionCache,
				executeFunction,
				setFunctionCache,
				handleFunctionResult,
			},
		});

		expect(buildPayloadFromPOST).toHaveBeenCalled();
		expect(getPayloadHash).toHaveBeenCalled();
		expect(getFunctionCache).toHaveBeenCalledWith(10, "hash-1");
		expect(executeFunction).toHaveBeenCalled();
		expect(executeFunction).toHaveBeenCalledWith(
			10,
			expect.any(Object),
			expect.any(Array),
			{ enabled: false },
			JSON.stringify({
				ran_by: "exec",
				body: "{}",
				route: "default",
			}),
			expect.objectContaining({
				ratelimit: expect.objectContaining({
					configured: false,
					blocked: false,
				}),
				mode: "production_execute",
			}),
		);
		expect(setFunctionCache).toHaveBeenCalledWith(
			10,
			"hash-1",
			JSON.stringify({ ok: true }),
			60,
		);
		expect(handleFunctionResult).toHaveBeenCalledWith(
			ctr,
			JSON.stringify({ ok: true }),
			false,
		);
		expect(result).toBe("handled");
	});
});
