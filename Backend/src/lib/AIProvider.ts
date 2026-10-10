import { decryptSecret } from "./GitOps";
import { parseAIProviderEndpoint, requestAIProvider } from "./AIProviderHttp";

export const DEFAULT_AI_PROVIDER_ENDPOINT = "https://openrouter.ai/api/v1";
export const DEFAULT_AI_PROVIDER_MODEL = "qwen/qwen3-coder-next";

export interface AIProviderCapabilities {
	tools: boolean;
	json: boolean;
}

export interface AIProvider {
	endpoint: string;
	model: string;
	apiKey: string;
	capabilities: AIProviderCapabilities;
}

export interface StoredAIProvider {
	aiProviderEndpoint: string | null;
	aiProviderModel: string | null;
	aiProviderApiKey: string | null;
	aiProviderCapabilities: string | null;
	openRouterKey: string | null;
}

const defaultCapabilities: AIProviderCapabilities = { tools: true, json: true };

export function normalizeAIProviderEndpoint(endpoint: string): string {
	return parseAIProviderEndpoint(endpoint).toString().replace(/\/$/, "");
}

export function parseAIProviderCapabilities(value: string | null): AIProviderCapabilities {
	if (!value) return defaultCapabilities;
	try {
		const parsed: unknown = JSON.parse(value);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			typeof (parsed as Record<string, unknown>).tools === "boolean" &&
			typeof (parsed as Record<string, unknown>).json === "boolean"
		) {
			return parsed as AIProviderCapabilities;
		}
	} catch {
		// A malformed legacy value falls back to the default provider capabilities.
	}
	return defaultCapabilities;
}

export function getAIProvider(
	stored: StoredAIProvider,
	instanceKey: string | undefined,
	instanceSecret: string,
): AIProvider | null {
	if (stored.aiProviderApiKey) {
		const apiKey = decryptSecret(stored.aiProviderApiKey, instanceSecret);
		if (!apiKey) throw new Error("Stored AI provider credentials could not be decrypted. Save the provider again.");
		return {
			endpoint: stored.aiProviderEndpoint ?? DEFAULT_AI_PROVIDER_ENDPOINT,
			model: stored.aiProviderModel ?? DEFAULT_AI_PROVIDER_MODEL,
			apiKey,
			capabilities: parseAIProviderCapabilities(stored.aiProviderCapabilities),
		};
	}

	if (stored.openRouterKey) {
		return {
			endpoint: DEFAULT_AI_PROVIDER_ENDPOINT,
			model: DEFAULT_AI_PROVIDER_MODEL,
			apiKey: stored.openRouterKey,
			capabilities: defaultCapabilities,
		};
	}

	if (!instanceKey) return null;
	return {
		endpoint: DEFAULT_AI_PROVIDER_ENDPOINT,
		model: DEFAULT_AI_PROVIDER_MODEL,
		apiKey: instanceKey,
		capabilities: defaultCapabilities,
	};
}

export async function validateAIProvider(provider: AIProvider): Promise<void> {
	const response = await requestAIProvider(provider.endpoint, "/models", provider.apiKey, 10_000);

	if (response.status === 401 || response.status === 403) {
		throw new Error("The provider rejected the API key.");
	}
	if (response.status < 200 || response.status >= 300) {
		throw new Error(`The provider did not accept a compatible models request (HTTP ${response.status}).`);
	}
	const body = await response.json().catch(() => null) as { data?: Array<{ id?: string }> } | null;
	if (Array.isArray(body?.data) && !body.data.some((model) => model.id === provider.model)) {
		throw new Error("The provider is reachable, but the configured model is unavailable.");
	}
}

export async function createAICompletion(
	provider: AIProvider,
	body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	if (body.tools && !provider.capabilities.tools) {
		throw new Error("This provider is configured without tool-calling support, which SHSF code generation requires.");
	}
	const response = await requestAIProvider(provider.endpoint, "/chat/completions", provider.apiKey, 120_000, { model: provider.model, ...body });
	if (response.status < 200 || response.status >= 300) {
		throw new Error(`AI provider request failed (HTTP ${response.status}).`);
	}
	return response.json() as Promise<Record<string, unknown>>;
}
