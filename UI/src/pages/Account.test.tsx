import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AccountPage } from "./Account";
import { getAccountSettings, updateAccountSettings } from "../services/backend.account";

vi.mock("../App", async () => {
	const { createContext } = await import("react");
	return {
		UserContext: createContext({
			user: { id: 1, displayName: "Test", email: "test@example.com", role: "User", apiKeyConfigured: true },
			loading: false, error: null, refreshUser: vi.fn(),
		}),
	};
});

vi.mock("../services/backend.account", () => ({
	getAccountSettings: vi.fn(), updateAccountSettings: vi.fn(),
	deleteAccount: vi.fn(), exportAccountData: vi.fn(),
}));

const savedProvider = {
	endpoint: "https://provider.example/v1", model: "test-model",
	capabilities: { tools: true, json: true },
};

describe("Account provider TLS settings", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getAccountSettings).mockResolvedValue({ status: "OK", data: { accountEnvironment: [], aiProvider: savedProvider } });
		vi.mocked(updateAccountSettings).mockResolvedValue({ status: "OK", message: "Saved" });
	});

	it("defaults to certificate verification, warns on opt-in, and sends the setting when saving", async () => {
		render(<MemoryRouter><AccountPage /></MemoryRouter>);
		await screen.findByDisplayValue(savedProvider.endpoint);
		const checkbox = screen.getByRole("checkbox", { name: "Ignore SSL certificate errors" });
		expect(checkbox).not.toBeChecked();
		expect(screen.queryByText(/Certificate identity will not be verified/)).not.toBeInTheDocument();
		fireEvent.click(checkbox);
		expect(screen.getByText(/Certificate identity will not be verified/)).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText(/^API key/), { target: { value: "new-key" } });
		fireEvent.click(screen.getByRole("button", { name: "Validate & save" }));
		await waitFor(() => expect(updateAccountSettings).toHaveBeenCalledWith({ aiProvider: { ...savedProvider, apiKey: "new-key", ignoreTlsErrors: true, ignoreInvalidModels: false } }));
		await screen.findByText(/Provider validated and saved/);
	});

	it("loads the saved opt-in and lets the user re-enable verification", async () => {
		vi.mocked(getAccountSettings).mockResolvedValue({ status: "OK", data: { accountEnvironment: [], aiProvider: { ...savedProvider, ignoreTlsErrors: true } } });
		render(<MemoryRouter><AccountPage /></MemoryRouter>);
		await screen.findByText(/Certificate identity will not be verified/);
		const checkbox = screen.getByRole("checkbox", { name: "Ignore SSL certificate errors" });
		expect(checkbox).toBeChecked();
		fireEvent.click(checkbox);
		fireEvent.change(screen.getByLabelText(/^API key/), { target: { value: "new-key" } });
		fireEvent.click(screen.getByRole("button", { name: "Validate & save" }));
		await waitFor(() => expect(updateAccountSettings).toHaveBeenCalledWith({ aiProvider: { ...savedProvider, apiKey: "new-key", ignoreTlsErrors: false, ignoreInvalidModels: false } }));
		await screen.findByText(/Provider validated and saved/);
	});

	it("clears the TLS bypass when the saved provider is removed", async () => {
		vi.mocked(getAccountSettings).mockResolvedValue({ status: "OK", data: { accountEnvironment: [], aiProvider: { ...savedProvider, ignoreTlsErrors: true } } });
		render(<MemoryRouter><AccountPage /></MemoryRouter>);
		await screen.findByText(/Certificate identity will not be verified/);
		fireEvent.click(screen.getByRole("button", { name: "Remove saved provider" }));
		await screen.findByText(/Saved API key removed/);
		expect(screen.getByRole("checkbox", { name: "Ignore SSL certificate errors" })).not.toBeChecked();
		expect(updateAccountSettings).toHaveBeenCalledWith({ aiProvider: null });
	});

	it("updates the model without asking for the saved API key again", async () => {
		render(<MemoryRouter><AccountPage /></MemoryRouter>);
		await screen.findByDisplayValue(savedProvider.endpoint);
		fireEvent.change(screen.getByLabelText("Model"), { target: { value: "updated-model" } });
		fireEvent.click(screen.getByRole("button", { name: "Validate & save" }));
		await waitFor(() => expect(updateAccountSettings).toHaveBeenCalledWith({ aiProvider: { ...savedProvider, model: "updated-model", ignoreTlsErrors: false, ignoreInvalidModels: false } }));
	});

	it("uses the fixed OpenAI URL and sends the model-list override", async () => {
		render(<MemoryRouter><AccountPage /></MemoryRouter>);
		await screen.findByDisplayValue(savedProvider.endpoint);
		fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai" } });
		fireEvent.click(screen.getByRole("checkbox", { name: "Allow model even if it is not listed by the provider" }));
		fireEvent.change(screen.getByLabelText(/^API key/), { target: { value: "openai-key" } });
		fireEvent.click(screen.getByRole("button", { name: "Validate & save" }));
		await waitFor(() => expect(updateAccountSettings).toHaveBeenCalledWith({ aiProvider: { ...savedProvider, endpoint: "https://api.openai.com/v1", apiKey: "openai-key", ignoreTlsErrors: false, ignoreInvalidModels: true } }));
	});

	it("requires a new key when changing provider endpoints", async () => {
		render(<MemoryRouter><AccountPage /></MemoryRouter>);
		await screen.findByDisplayValue(savedProvider.endpoint);
		fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openrouter" } });
		fireEvent.click(screen.getByRole("button", { name: "Validate & save" }));
		await screen.findByText("Enter an API key before saving.");
		expect(updateAccountSettings).not.toHaveBeenCalled();
	});
});

describe("Account log analysis settings", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("is off by default, discloses the data flow, and checks the model when enabling", async () => {
		vi.mocked(getAccountSettings).mockResolvedValue({ status: "OK", data: { accountEnvironment: [], aiProvider: null, logAnalysis: { enabled: false, model: null, keySource: "instance", ready: false, reason: "Log analysis is turned off for this account." } } });
		vi.mocked(updateAccountSettings).mockResolvedValue({ status: "OK", message: "Saved", data: { accountEnvironment: [], logAnalysis: { enabled: true, model: "vendor/decider", keySource: "instance", ready: true, reason: null } } });
		render(<MemoryRouter><AccountPage /></MemoryRouter>);
		await screen.findByText("Off. No logs leave this server.");
		expect(screen.getByText(/Old logs are never sent/)).toBeInTheDocument();
		const enable = screen.getByRole("button", { name: "Turn on log analysis" });
		expect(enable).toBeDisabled();
		fireEvent.change(screen.getByLabelText("Decisions model"), { target: { value: "vendor/decider" } });
		fireEvent.click(enable);
		await waitFor(() => expect(updateAccountSettings).toHaveBeenCalledWith({ logAnalysis: { enabled: true, model: "vendor/decider" } }));
		await screen.findByText(/On for this account using vendor\/decider with the instance OpenRouter key/);
		expect(screen.getByRole("button", { name: "Turn off log analysis" })).toBeInTheDocument();
	});

	it("shows actionable configuration errors from the server", async () => {
		vi.mocked(getAccountSettings).mockResolvedValue({ status: "OK", data: { accountEnvironment: [], aiProvider: null, logAnalysis: { enabled: false, model: "bad/model", keySource: null, ready: false, reason: "Log analysis is turned off for this account." } } });
		vi.mocked(updateAccountSettings).mockResolvedValue({ status: "FAILED", message: "Log analysis check failed: The configured model is not available on the Decisions API." });
		render(<MemoryRouter><AccountPage /></MemoryRouter>);
		fireEvent.click(await screen.findByRole("button", { name: "Turn on log analysis" }));
		await screen.findByText(/configured model is not available/);
	});

	it("explains why an enabled account is not running", async () => {
		vi.mocked(getAccountSettings).mockResolvedValue({ status: "OK", data: { accountEnvironment: [], aiProvider: null, logAnalysis: { enabled: true, model: "m", keySource: null, ready: false, reason: "No OpenRouter API key is configured." } } });
		render(<MemoryRouter><AccountPage /></MemoryRouter>);
		await screen.findByText("On, but not running: No OpenRouter API key is configured.");
	});
});
