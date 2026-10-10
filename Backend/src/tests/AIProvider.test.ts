import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "../lib/GitOps";
import { requestAIProvider } from "../lib/AIProviderHttp";
import {
	createAICompletion,
	DEFAULT_AI_PROVIDER_ENDPOINT,
	DEFAULT_AI_PROVIDER_MODEL,
	getAIProvider,
	parseAIProviderCapabilities,
	parseAIProviderIgnoreTlsErrors,
	validateAIProvider,
} from "../lib/AIProvider";

vi.mock("../lib/AIProviderHttp", async (importOriginal) => ({
	...await importOriginal<typeof import("../lib/AIProviderHttp")>(),
	requestAIProvider: vi.fn(),
}));

afterEach(() => vi.resetAllMocks());

const emptyProvider = {
	aiProviderEndpoint: null,
	aiProviderModel: null,
	aiProviderApiKey: null,
	aiProviderCapabilities: null,
	openRouterKey: null,
};

describe("AI providers", () => {
	it("uses OpenRouter defaults for the existing instance key", () => {
		expect(getAIProvider(emptyProvider, "instance-key", "secret")).toEqual({
			endpoint: DEFAULT_AI_PROVIDER_ENDPOINT,
			model: DEFAULT_AI_PROVIDER_MODEL,
			apiKey: "instance-key",
			capabilities: { tools: true, json: true },
		});
	});

	it("decrypts stored provider credentials without exposing the ciphertext", () => {
		const encryptedKey = encryptSecret("provider-secret", "instance-secret");
		const provider = getAIProvider({
			...emptyProvider,
			aiProviderEndpoint: "https://example.test/v1",
			aiProviderModel: "test-model",
			aiProviderApiKey: encryptedKey,
			aiProviderCapabilities: JSON.stringify({ tools: true, json: false }),
		}, undefined, "instance-secret");
		expect(provider).toMatchObject({ endpoint: "https://example.test/v1", model: "test-model", apiKey: "provider-secret" });
		expect(JSON.stringify(provider)).not.toContain(encryptedKey);
	});

	it("falls back to safe capability defaults for malformed stored configuration", () => {
		expect(parseAIProviderCapabilities("not-json")).toEqual({ tools: true, json: true });
	});

	it.each([null, "not-json", "null", "[]", "true", '{}', '{"ignoreTlsErrors":false}', '{"ignoreTlsErrors":"true"}', '{"ignoreTlsErrors":1}'])("keeps TLS verification enabled for stored options %s", (options) => {
		expect(parseAIProviderIgnoreTlsErrors(options)).toBe(false);
	});

	it("loads the explicit TLS opt-in without exposing it as a capability", () => {
		const options = JSON.stringify({ tools: true, json: false, ignoreTlsErrors: true });
		const provider = getAIProvider({
			...emptyProvider,
			aiProviderApiKey: encryptSecret("provider-key", "secret"),
			aiProviderCapabilities: options,
		}, undefined, "secret");
		expect(provider).toMatchObject({ ignoreTlsErrors: true, capabilities: { tools: true, json: false } });
		expect(parseAIProviderCapabilities(options)).toEqual({ tools: true, json: false });
	});

	it("does not apply custom TLS options to legacy OpenRouter keys", async () => {
		const provider = getAIProvider({ ...emptyProvider, openRouterKey: "legacy-key", aiProviderCapabilities: '{"ignoreTlsErrors":true}' }, undefined, "secret")!;
		vi.mocked(requestAIProvider).mockResolvedValue({ status: 200, json: async () => ({}) });
		await validateAIProvider(provider);
		expect(requestAIProvider).toHaveBeenLastCalledWith(DEFAULT_AI_PROVIDER_ENDPOINT, "/models", "legacy-key", 10_000, undefined, false);
	});

	it("reports authentication failures during provider validation", async () => {
		vi.mocked(requestAIProvider).mockResolvedValue({ status: 401, json: async () => null });
		await expect(validateAIProvider({ endpoint: "https://example.test/v1", model: "test", apiKey: "bad", capabilities: { tools: true, json: true } })).rejects.toThrow("rejected the API key");
	});

	it("reports a configured model that the provider does not offer", async () => {
		vi.mocked(requestAIProvider).mockResolvedValue({ status: 200, json: async () => ({ data: [{ id: "other-model" }] }) });
		await expect(validateAIProvider({ endpoint: "https://example.test/v1", model: "test", apiKey: "key", capabilities: { tools: true, json: true } })).rejects.toThrow("configured model is unavailable");
	});

	it("uses the guarded transport for both validation and completion requests", async () => {
		const provider = getAIProvider(emptyProvider, "instance-key", "secret")!;
		vi.mocked(requestAIProvider).mockResolvedValue({ status: 200, json: async () => ({ data: [{ id: provider.model }] }) });
		await validateAIProvider(provider);
		expect(requestAIProvider).toHaveBeenLastCalledWith(DEFAULT_AI_PROVIDER_ENDPOINT, "/models", "instance-key", 10_000, undefined, false);
		const completion = { choices: [{ message: { content: "hello" } }] };
		vi.mocked(requestAIProvider).mockResolvedValue({ status: 200, json: async () => completion });
		expect(await createAICompletion(provider, { messages: [] })).toEqual(completion);
		expect(requestAIProvider).toHaveBeenLastCalledWith(DEFAULT_AI_PROVIDER_ENDPOINT, "/chat/completions", "instance-key", 120_000, { model: DEFAULT_AI_PROVIDER_MODEL, messages: [] }, false);
	});

	it("applies the custom TLS opt-in to validation and generation", async () => {
		const provider = { endpoint: "https://provider.example/v1", model: "test", apiKey: "key", capabilities: { tools: true, json: true }, ignoreTlsErrors: true };
		vi.mocked(requestAIProvider).mockResolvedValue({ status: 200, json: async () => ({}) });
		await validateAIProvider(provider);
		expect(requestAIProvider).toHaveBeenLastCalledWith(provider.endpoint, "/models", "key", 10_000, undefined, true);
		await createAICompletion(provider, { messages: [] });
		expect(requestAIProvider).toHaveBeenLastCalledWith(provider.endpoint, "/chat/completions", "key", 120_000, { model: "test", messages: [] }, true);
	});
});
