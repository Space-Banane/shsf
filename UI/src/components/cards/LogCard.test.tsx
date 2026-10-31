import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LogsCard } from "./LogCard";
import { getLoggingConfig, updateLoggingConfig } from "../../services/backend.function.logs";

vi.mock("../../services/backend.function.logs", () => ({
	getLoggingConfig: vi.fn(), updateLoggingConfig: vi.fn(), deleteAllLogs: vi.fn(),
}));
vi.mock("../modals/ConfirmModal", () => ({ useConfirm: () => vi.fn() }));

const renderCard = () => render(
	<MemoryRouter>
		<LogsCard logs={[]} isLoadingLogs={false} showDetails onToggleDetails={vi.fn()} onRefreshLogs={vi.fn()} onViewLogs={vi.fn()} functionId={5} />
	</MemoryRouter>,
);
const ready = { enabled: true, model: "m", keySource: "account" as const, ready: true, reason: null };

describe("LogsCard analysis opt-in", () => {
	beforeEach(() => vi.clearAllMocks());

	it("cannot be turned on until the account is set up", async () => {
		vi.mocked(getLoggingConfig).mockResolvedValue({ status: "OK", data: { enabled: true, analyze: false, analysis: { ...ready, enabled: false, ready: false, reason: "Log analysis is turned off for this account.", effective: false } } });
		renderCard();
		await screen.findByRole("link", { name: "account settings" });
		expect(screen.getByRole("checkbox", { name: "Analyze new logs with OpenRouter" })).toBeDisabled();
	});

	it("opts the function in and shows the effective state", async () => {
		vi.mocked(getLoggingConfig).mockResolvedValue({ status: "OK", data: { enabled: true, analyze: false, analysis: { ...ready, effective: false } } });
		vi.mocked(updateLoggingConfig).mockResolvedValue({ status: "OK", message: "ok" });
		renderCard();
		await screen.findByText("Off. Logs stay on this server.");
		fireEvent.click(screen.getByRole("checkbox", { name: "Analyze new logs with OpenRouter" }));
		await waitFor(() => expect(updateLoggingConfig).toHaveBeenCalledWith(5, { analyze: true }));
		await screen.findByText(/Sanitized logs from new runs are sent/);
	});

	it("clears the analysis opt-in when logging is turned off", async () => {
		vi.mocked(getLoggingConfig).mockResolvedValue({ status: "OK", data: { enabled: true, analyze: true, analysis: { ...ready, effective: true } } });
		vi.mocked(updateLoggingConfig).mockResolvedValue({ status: "OK", message: "ok" });
		renderCard();
		const analyze = await screen.findByRole("checkbox", { name: "Analyze new logs with OpenRouter" });
		await waitFor(() => expect(analyze).toBeChecked());
		fireEvent.click(screen.getAllByRole("checkbox")[0]);
		await waitFor(() => expect(analyze).not.toBeChecked());
	});

	it("explains when an opted-in function is paused", async () => {
		vi.mocked(getLoggingConfig).mockResolvedValue({ status: "OK", data: { enabled: true, analyze: true, analysis: { ...ready, ready: false, reason: "No OpenRouter API key is configured.", effective: false } } });
		renderCard();
		await screen.findByText("Opted in, but paused: No OpenRouter API key is configured.");
		expect(screen.getByRole("checkbox", { name: "Analyze new logs with OpenRouter" })).toBeEnabled();
	});
});
