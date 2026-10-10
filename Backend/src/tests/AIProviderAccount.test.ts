import { beforeEach, describe, expect, it, vi } from "vitest";
import { z, type ZodType } from "zod";
import { getAIProvider } from "../lib/AIProvider";
import { requestAIProvider } from "../lib/AIProviderHttp";
import "../routes/api/account/manage";

interface TestContext {
	cookies: { get: () => null };
	headers: { get: () => null };
	$status: { UNAUTHORIZED: number; BAD_REQUEST: number };
	status: (code: number) => TestContext;
	print: (body: unknown) => unknown;
	bindBody: (schema: (builder: typeof z) => ZodType) => Promise<[unknown, unknown]>;
}

const harness = vi.hoisted(() => ({
	handlers: new Map<string, (context: TestContext) => Promise<unknown>>(),
	user: {
		id: 1, account_env: null, openRouterKey: null,
		aiProviderEndpoint: null as string | null,
		aiProviderModel: null as string | null,
		aiProviderApiKey: null as string | null,
		aiProviderCapabilities: null as string | null,
	},
	update: vi.fn(),
}));

vi.mock("../index", () => ({
	COOKIE: "session", API_KEY_HEADER: "api-key", INSTANCE_SECRET: "test-instance-secret",
	prisma: { user: { update: harness.update } },
	fileRouter: {
		Path: class {
			http(method: string, path: string, configure: (route: unknown) => unknown) {
				const route = {
					document: () => route,
					ratelimit: () => route,
					onRequest: (handler: (context: TestContext) => Promise<unknown>) => {
						harness.handlers.set(`${method} ${path}`, handler);
						return route;
					},
				};
				configure(route);
				return this;
			}
		},
	},
}));
vi.mock("../lib/Authentication", () => ({ checkAuthentication: async () => ({ success: true, user: harness.user }) }));
vi.mock("../lib/Runner", () => ({ cleanupFunctionContainer: vi.fn() }));
vi.mock("../lib/AIProviderHttp", async (importOriginal) => ({
	...await importOriginal<typeof import("../lib/AIProviderHttp")>(),
	requestAIProvider: vi.fn(),
}));

async function settingsRequest(method: string, body?: unknown) {
	const context: TestContext = {
		cookies: { get: () => null }, headers: { get: () => null },
		$status: { UNAUTHORIZED: 401, BAD_REQUEST: 400 },
		status: vi.fn(() => context), print: vi.fn((response: unknown) => response),
		bindBody: async (schema) => {
			const parsed = schema(z).safeParse(body);
			return parsed.success ? [parsed.data, null] : [null, parsed.error];
		},
	};
	const response = await harness.handlers.get(`${method} /api/account/settings`)!(context);
	return { response, context };
}

const providerInput = {
	endpoint: "https://provider.example/v1", model: "test", apiKey: "test-provider-secret",
	capabilities: { tools: true, json: false },
};

describe("AI provider account TLS option", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Object.assign(harness.user, { aiProviderEndpoint: null, aiProviderModel: null, aiProviderApiKey: null, aiProviderCapabilities: null });
		harness.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
			Object.assign(harness.user, data);
			return { account_env: null };
		});
		vi.mocked(requestAIProvider).mockResolvedValue({ status: 200, json: async () => ({ data: [{ id: "test" }] }) });
	});

	it.each([true, false, undefined])("validates, persists, and returns TLS option %s without credentials", async (ignoreTlsErrors) => {
		const enabled = ignoreTlsErrors === true;
		const { response } = await settingsRequest("PATCH", { aiProvider: { ...providerInput, ignoreTlsErrors } });
		expect(response).toMatchObject({ status: "OK" });
		expect(requestAIProvider).toHaveBeenCalledWith(providerInput.endpoint, "/models", providerInput.apiKey, 10_000, undefined, enabled);
		expect(JSON.parse(harness.user.aiProviderCapabilities!)).toEqual({ ...providerInput.capabilities, ignoreTlsErrors: enabled });
		const loaded = await settingsRequest("GET");
		expect(loaded.response).toMatchObject({ data: { aiProvider: { endpoint: providerInput.endpoint, model: "test", capabilities: providerInput.capabilities, ignoreTlsErrors: enabled } } });
		expect(JSON.stringify([response, loaded.response])).not.toContain(providerInput.apiKey);
		expect(JSON.stringify(loaded.response)).not.toContain(harness.user.aiProviderApiKey!);
		expect(getAIProvider(harness.user, undefined, "test-instance-secret")).toMatchObject({ apiKey: providerInput.apiKey, ignoreTlsErrors: enabled });
	});

	it("rejects non-boolean TLS flags before connecting or persisting", async () => {
		const { response, context } = await settingsRequest("PATCH", { aiProvider: { ...providerInput, ignoreTlsErrors: "true" } });
		expect(response).toMatchObject({ status: "FAILED" });
		expect(context.status).toHaveBeenCalledWith(400);
		expect(requestAIProvider).not.toHaveBeenCalled();
		expect(harness.update).not.toHaveBeenCalled();
	});

	it("clears the stored TLS opt-in when removing the provider", async () => {
		await settingsRequest("PATCH", { aiProvider: { ...providerInput, ignoreTlsErrors: true } });
		await settingsRequest("PATCH", { aiProvider: null });
		expect(harness.user.aiProviderCapabilities).toBeNull();
		expect((await settingsRequest("GET")).response).toMatchObject({ data: { aiProvider: null } });
	});
});
