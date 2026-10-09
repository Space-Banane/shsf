import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UserContext } from "../../App";
import LoginPage from "./LoginPage";

const mockNavigate = vi.fn();
const mockLocation = vi.fn();
const refreshUser = vi.fn();
const fetchMock = vi.fn();

vi.mock("../..", () => ({ BASE_URL: "" }));

vi.mock("../../App", () => {
	const React = require("react");
	return {
		UserContext: React.createContext({ user: null, loading: false, refreshUser: vi.fn() }),
	};
});

vi.mock("react-router-dom", () => ({
	useLocation: () => mockLocation(),
	useNavigate: () => mockNavigate,
}), { virtual: true });

const renderLoginPage = () => render(
	<UserContext.Provider value={{ user: null, loading: false, refreshUser }}>
		<LoginPage />
	</UserContext.Provider>,
);

describe("LoginPage demo login", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLocation.mockReturnValue({ state: null });
		Object.defineProperty(global, "fetch", { writable: true, value: fetchMock });
	});

	it("does not offer demo login when the instance is not a demo", async () => {
		fetchMock.mockResolvedValueOnce({ json: async () => ({ isDemo: false }) });

		renderLoginPage();

		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
			"/api/config",
			expect.objectContaining({ signal: expect.any(Object) }),
		));
		expect(screen.queryByRole("button", { name: "Log in as demo user" })).not.toBeInTheDocument();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("logs in with demo credentials and redirects through the normal flow", async () => {
		fetchMock
			.mockResolvedValueOnce({ json: async () => ({ isDemo: true }) })
			.mockResolvedValueOnce({ json: async () => ({ status: "OK" }) });

		renderLoginPage();

		fireEvent.click(await screen.findByRole("button", { name: "Log in as demo user" }));

		await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/account/login", expect.objectContaining({
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ email: "demo@shsf.local", password: "demo-password" }),
			signal: expect.any(Object),
		})));
		expect(refreshUser).toHaveBeenCalledTimes(1);
		expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
	});

	it("disables the demo action while its request is pending", async () => {
		let resolveLogin: (response: { json: () => Promise<{ status: string }> }) => void;
		const loginResponse = new Promise<{ json: () => Promise<{ status: string }> }>((resolve) => {
			resolveLogin = resolve;
		});
		fetchMock
			.mockResolvedValueOnce({ json: async () => ({ isDemo: true }) })
			.mockReturnValueOnce(loginResponse);

		renderLoginPage();

		const demoButton = await screen.findByRole("button", { name: "Log in as demo user" });
		fireEvent.click(demoButton);

		await waitFor(() => expect(demoButton).toBeDisabled());
		fireEvent.click(demoButton);
		expect(fetchMock).toHaveBeenCalledTimes(2);

		resolveLogin!({ json: async () => ({ status: "OK" }) });
		await waitFor(() => expect(demoButton).not.toBeDisabled());
	});
});
