import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import FunctionSettings from "./FunctionSettings";
import {
	getDeprecatedImages,
	getFunctionById,
	getLogsByFuncId,
	isFunctionImageDeprecated,
	updateFunction,
} from "../../services/backend.functions";
import { getNamespaces } from "../../services/backend.namespaces";
import {
	getRateLimitConfig,
	updateRateLimitConfig,
} from "../../services/backend.function.ratelimit";
import type { XFunction } from "../../types/Prisma";

vi.mock("../../", () => ({ BASE_URL: "" }));
vi.mock("../../services/backend.functions");
vi.mock("../../services/backend.namespaces");
vi.mock("../../services/backend.function.ratelimit");
const confirm = vi.fn();
vi.mock("../../components/modals/ConfirmModal", () => ({
	useConfirm: () => confirm,
}));

const baseFunction = {
	id: 1,
	name: "demo",
	description: "A demo function",
	image: "python:3.12",
	executionId: "abc",
	executionAlias: "demo-alias",
	namespaceId: 2,
	allow_http: true,
	startup_file: "main.py",
	secure_header: "",
	cors_origins: "https://allowed.test",
	docker_mount: false,
	network_restricted: false,
	ffmpeg_install: false,
	opencv_install: false,
	imported: false,
	ai_kicked_off: false,
	cache_enabled: false,
	cache_ttl: 60,
	max_ram: 512,
	timeout: 30,
	git_url: null,
	env: [],
	access: "owner",
} as unknown as XFunction;

function mockBackend(overrides: Partial<XFunction> = {}) {
	const functionData = { ...baseFunction, ...overrides };
	vi.mocked(getFunctionById).mockResolvedValue({
		status: "OK",
		data: functionData,
	} as never);
	vi.mocked(updateFunction).mockResolvedValue({
		status: "OK",
		data: functionData,
	} as never);
	vi.mocked(getNamespaces).mockResolvedValue({
		status: "OK",
		data: [{ id: 2, name: "prod" }],
	} as never);
	vi.mocked(getDeprecatedImages).mockResolvedValue([]);
	vi.mocked(isFunctionImageDeprecated).mockResolvedValue(false);
	vi.mocked(getLogsByFuncId).mockResolvedValue({ status: "OK", data: [] });
	vi.mocked(getRateLimitConfig).mockResolvedValue({
		status: "OK",
		data: { enabled: false },
	} as never);
	vi.mocked(updateRateLimitConfig).mockResolvedValue({
		status: "OK",
		message: "",
		data: { enabled: false },
	} as never);
	return functionData;
}

function renderRoute(url = "/functions/1/settings") {
	const router = createMemoryRouter(
		[
			{ path: "/functions/:id", element: <div>function detail</div> },
			{ path: "/functions/:id/settings", element: <FunctionSettings /> },
		],
		{ initialEntries: [url] },
	);
	render(<RouterProvider router={router} />);
	return router;
}

describe("FunctionSettings route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockBackend();
	});

	it("renders the general section and saves edits with the existing payload", async () => {
		const functionData = mockBackend();
		vi.mocked(updateFunction).mockResolvedValue({
			status: "OK",
			data: { ...functionData, name: "renamed" },
		} as never);
		renderRoute();

		const name = await screen.findByDisplayValue("demo");
		fireEvent.change(name, { target: { value: "renamed" } });
		expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");

		fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

		await waitFor(() =>
			expect(updateFunction).toHaveBeenCalledWith(
				1,
				expect.objectContaining({
					name: "renamed",
					image: "python:3.12",
					docker_mount: false,
					network_restricted: false,
					cors_origins: "https://allowed.test",
					settings: expect.objectContaining({
						max_ram: 512,
						timeout: 30,
						allow_http: true,
						cache_enabled: false,
						cache_ttl: 60,
					}),
				}),
			),
		);
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled(),
		);
	});

	it("keeps unsaved edits while switching sections through the URL", async () => {
		const router = renderRoute("/functions/1/settings?section=runtime");

		const maxRam = await screen.findByPlaceholderText("512");
		fireEvent.change(maxRam, { target: { value: "1024" } });

		fireEvent.click(screen.getByRole("button", { name: "General" }));
		const name = await screen.findByDisplayValue("demo");
		fireEvent.change(name, { target: { value: "draft-name" } });
		await waitFor(() =>
			expect(router.state.location.search).toBe("?section=general"),
		);

		fireEvent.click(screen.getByRole("button", { name: "Caching" }));
		await screen.findByText("Response Caching");
		fireEvent.click(screen.getByRole("button", { name: "General" }));

		expect(await screen.findByDisplayValue("draft-name")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Runtime" }));
		expect(await screen.findByPlaceholderText("512")).toHaveValue(1024);
	});

	it("only loads the data of the section that is open", async () => {
		renderRoute();

		await screen.findByDisplayValue("demo");
		await waitFor(() => expect(getNamespaces).toHaveBeenCalledTimes(1));
		expect(getDeprecatedImages).not.toHaveBeenCalled();
		expect(getRateLimitConfig).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Rate limits" }));

		expect(await screen.findByText("Rate limiting")).toBeInTheDocument();
		expect(getRateLimitConfig).toHaveBeenCalledWith(1);
		expect(getDeprecatedImages).not.toHaveBeenCalled();
	});

	it("saves rate limits from their own section", async () => {
		renderRoute("/functions/1/settings?section=rate-limits");

		await screen.findByText("Rate limiting");
		fireEvent.click(screen.getByRole("button", { name: "Save Rate Limits" }));

		await waitFor(() =>
			expect(updateRateLimitConfig).toHaveBeenCalledWith(1, {
				enabled: false,
			}),
		);
	});

	it("keeps unsaved rate limit edits while switching sections", async () => {
		renderRoute("/functions/1/settings?section=rate-limits");

		await screen.findByText("Rate limiting");
		fireEvent.click(screen.getByLabelText("Rate limiting"));
		expect(screen.getByText("Global bucket")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "General" }));
		await screen.findByDisplayValue("demo");
		fireEvent.click(screen.getByRole("button", { name: "Rate limits" }));

		expect(screen.getByLabelText("Rate limiting")).toBeChecked();
		expect(screen.getByText("Global bucket")).toBeInTheDocument();
		expect(getRateLimitConfig).toHaveBeenCalledTimes(1);
	});

	it.each([
		["network", "Network/CORS"],
		["caching", "Caching"],
		["access", "Access"],
	])("deep links to the %s section", async (section, title) => {
		renderRoute(`/functions/1/settings?section=${section}`);

		expect(
			await screen.findByRole("heading", { name: title, level: 2 }),
		).toBeInTheDocument();
	});

	it("recovers from a failed rate-limit load instead of saving defaults", async () => {
		vi.mocked(getRateLimitConfig)
			.mockRejectedValueOnce(new Error("boom"))
			.mockResolvedValue({ status: "OK", data: { enabled: false } } as never);
		renderRoute("/functions/1/settings?section=rate-limits");

		expect(
			await screen.findByText(/Failed to load rate limits/),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Save Rate Limits" }),
		).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Retry" }));

		expect(await screen.findByText("Rate limiting")).toBeInTheDocument();
		expect(getRateLimitConfig).toHaveBeenCalledTimes(2);
	});

	it("disables saving for read-only shares", async () => {
		mockBackend({ access: "view" } as never);
		renderRoute();

		expect(
			await screen.findByText(
				"You can view these settings but not change them.",
			),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Save changes" }),
		).toBeDisabled();
	});

	it("shows a not-found state when the function cannot be loaded", async () => {
		vi.mocked(getFunctionById).mockResolvedValue({
			status: 404,
			message: "gone",
		} as never);
		renderRoute();

		expect(await screen.findByText("Function Not Found")).toBeInTheDocument();
	});
});
