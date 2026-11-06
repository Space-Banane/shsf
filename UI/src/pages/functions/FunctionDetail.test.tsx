import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import FunctionDetail from "./FunctionDetail";
import { createOrUpdateFile, getFiles, getFolders } from "../../services/backend.files";
import { executeFunctionStreaming, getFunctionById } from "../../services/backend.functions";
import { getNamespace } from "../../services/backend.namespaces";
import { getTriggers } from "../../services/backend.triggers";
import type { FunctionFile, XFunction } from "../../types/Prisma";

vi.mock("../..", () => ({ BASE_URL: "", PUBLIC_BASE_URL: "http://shsf.test" }));
vi.mock("../../App", async () => {
	const { createContext } = await import("react");
	return { UserContext: createContext({ user: null }) };
});
vi.mock("@monaco-editor/react", () => ({
	default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
		<textarea aria-label="editor" value={value} onChange={(e) => onChange(e.target.value)} />
	),
}));
vi.mock("../../services/backend.files");
vi.mock("../../services/backend.namespaces");
vi.mock("../../services/backend.triggers");
vi.mock("../../services/backend.functions", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../services/backend.functions")>()),
	getFunctionById: vi.fn(),
	getDeprecatedImages: vi.fn().mockResolvedValue([]),
	getLogsByFuncId: vi.fn().mockResolvedValue({ status: "OK", data: [] }),
	executeFunction: vi.fn(),
	executeFunctionStreaming: vi.fn(),
	installDependencies: vi.fn(),
	updateFunction: vi.fn(),
}));
vi.mock("../../services/backend.function.logs", () => ({
	getLoggingConfig: vi.fn().mockResolvedValue({ status: 500, message: "n/a" }),
	updateLoggingConfig: vi.fn(),
	deleteAllLogs: vi.fn(),
}));
vi.mock("../../services/backend.function.ratelimit", () => ({
	getRateLimitConfig: vi.fn().mockResolvedValue({ status: 500, message: "n/a" }),
}));
const confirm = vi.fn();
vi.mock("../../components/modals/ConfirmModal", () => ({ useConfirm: () => confirm }));
vi.mock("../../components/modals/guests/GuestManagement", () => ({
	default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>guest dialog</div> : null),
}));

const file = (id: number, name: string, content: string): FunctionFile =>
	({ id, name, content, functionId: 1 }) as FunctionFile;

const baseFunction = {
	id: 1,
	name: "demo",
	description: "",
	image: "python:3.12",
	executionId: "abc",
	namespaceId: 2,
	allow_http: true,
	startup_file: "main.py",
	cache_enabled: false,
	git_url: null,
	env: [],
} as unknown as XFunction;

function mockBackend(overrides: Partial<XFunction> = {}, files = [file(1, "main.py", "print(1)"), file(2, "util.py", "x = 1")]) {
	vi.mocked(getFunctionById).mockResolvedValue({
		status: "OK",
		data: { ...baseFunction, ...overrides },
	} as never);
	vi.mocked(getFiles).mockResolvedValue({ status: "OK", data: files });
	vi.mocked(getFolders).mockResolvedValue({ status: "OK", data: [] });
	vi.mocked(getTriggers).mockResolvedValue({ status: "OK", data: [] });
	vi.mocked(getNamespace).mockResolvedValue({ status: "OK", data: { id: 2, name: "prod" } } as never);
}

function renderRoute(url = "/functions/1") {
	const router = createMemoryRouter(
		[
			{ path: "/functions/:id", element: <FunctionDetail /> },
			{ path: "/functions", element: <div>functions list</div> },
		],
		{ initialEntries: ["/functions", url] , initialIndex: 1 },
	);
	render(<RouterProvider router={router} />);
	return router;
}

describe("FunctionDetail route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.history.replaceState({}, "", "/functions/1");
	});

	it("composes header, URL, files and the startup file in the editor", async () => {
		mockBackend();
		renderRoute();

		expect(await screen.findByText("demo")).toBeInTheDocument();
		expect(screen.getByText("prod")).toBeInTheDocument();
		expect(screen.getByText("2 files")).toBeInTheDocument();
		expect(screen.getByText("HTTP on")).toBeInTheDocument();
		expect(screen.getByDisplayValue("http://shsf.test/api/exec/2/abc")).toBeInTheDocument();
		expect(screen.getByLabelText("editor")).toHaveValue("print(1)");
		expect(screen.getByText("Saved")).toBeInTheDocument();
	});

	it("shows a not-found state when the function can't be loaded", async () => {
		vi.mocked(getFunctionById).mockResolvedValue({ status: 404, message: "gone" } as never);
		vi.mocked(getFiles).mockResolvedValue({ status: "OK", data: [] });
		vi.mocked(getFolders).mockResolvedValue({ status: "OK", data: [] });
		vi.mocked(getTriggers).mockResolvedValue({ status: "OK", data: [] });
		renderRoute();

		expect(await screen.findByText("Function Not Found")).toBeInTheDocument();
	});

	it("marks edits as unsaved and enables Save", async () => {
		mockBackend();
		renderRoute();
		const editor = await screen.findByLabelText("editor");
		expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

		fireEvent.change(editor, { target: { value: "print(2)" } });

		expect(screen.getByText("Unsaved")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
	});

	it("saves an edit and displays the output of a subsequent run", async () => {
		mockBackend();
		vi.mocked(createOrUpdateFile).mockResolvedValue({ status: "OK", data: file(1, "main.py", "print(2)") });
		vi.mocked(executeFunctionStreaming).mockImplementation(async (_id, onChunk) => {
			onChunk({ type: "output", content: "run output: 2\n" });
			onChunk({ type: "end", exitCode: 0 });
		});
		renderRoute();
		fireEvent.change(await screen.findByLabelText("editor"), { target: { value: "print(2)" } });
		fireEvent.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
		expect(createOrUpdateFile).toHaveBeenCalledWith(1, { filename: "main.py", code: "print(2)" });
		fireEvent.click(screen.getByRole("button", { name: "Run Function" }));
		expect(await screen.findByText("run output: 2")).toBeInTheDocument();
	});

	it("asks before navigating away with unsaved edits and stays when declined", async () => {
		mockBackend();
		confirm.mockResolvedValue(false);
		const router = renderRoute();
		fireEvent.change(await screen.findByLabelText("editor"), { target: { value: "dirty" } });

		await router.navigate("/functions");

		await waitFor(() =>
			expect(confirm).toHaveBeenCalledWith(
				expect.objectContaining({ title: "Unsaved Changes", confirmText: "Leave Page" }),
			),
		);
		await waitFor(() => expect(router.state.location.pathname).toBe("/functions/1"));
		expect(screen.getByLabelText("editor")).toHaveValue("dirty");
	});

	it("leaves the page when the user confirms discarding edits", async () => {
		mockBackend();
		confirm.mockResolvedValue(true);
		const router = renderRoute();
		fireEvent.change(await screen.findByLabelText("editor"), { target: { value: "dirty" } });

		await router.navigate("/functions");

		expect(await screen.findByText("functions list")).toBeInTheDocument();
	});

	it("navigates freely when nothing is unsaved", async () => {
		mockBackend();
		const router = renderRoute();
		await screen.findByLabelText("editor");

		await router.navigate("/functions");

		expect(await screen.findByText("functions list")).toBeInTheDocument();
		expect(confirm).not.toHaveBeenCalled();
	});

	it("warns on tab close only while there are unsaved edits", async () => {
		mockBackend();
		renderRoute();
		const editor = await screen.findByLabelText("editor");

		const clean = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(clean);
		expect(clean.defaultPrevented).toBe(false);

		fireEvent.change(editor, { target: { value: "dirty" } });
		const dirty = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(dirty);
		expect(dirty.defaultPrevented).toBe(true);
	});

	it("confirms before switching files with unsaved edits", async () => {
		mockBackend();
		confirm.mockResolvedValue(true);
		renderRoute();
		fireEvent.change(await screen.findByLabelText("editor"), { target: { value: "dirty" } });

		fireEvent.click(screen.getByText("util.py"));

		await waitFor(() => expect(screen.getByLabelText("editor")).toHaveValue("x = 1"));
		expect(confirm).toHaveBeenCalledWith(
			expect.objectContaining({ confirmText: "Switch File" }),
		);
	});

	it("opens the guests dialog from the preopen query param and cleans the URL", async () => {
		mockBackend();
		window.history.replaceState({}, "", "/functions/1?preopen=guests");
		renderRoute("/functions/1?preopen=guests");

		expect(await screen.findByText("guest dialog")).toBeInTheDocument();
	});

	it("locks run settings and disables HTTP-less state for HTML-only functions", async () => {
		mockBackend({ startup_file: "index.html", allow_http: false }, [file(1, "index.html", "<p/>")]);
		renderRoute();

		await screen.findByLabelText("editor");
		expect(screen.getByLabelText("Run mode")).toBeDisabled();
		expect(screen.getByRole("button", { name: "Run Params" })).toBeDisabled();
		expect(screen.getByRole("button", { name: /Env$/ })).toBeDisabled();
		expect(screen.getByText("HTTP off")).toBeInTheDocument();
		expect(screen.getByDisplayValue("No HTTP Access 🚫")).toBeInTheDocument();
	});

	it("disables the editor and file actions for git-backed functions", async () => {
		mockBackend({ git_url: "https://example.test/repo.git" } as never);
		renderRoute();

		expect(await screen.findByText("Editor Disabled")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Load Defaults" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Install requirements.txt" })).toBeInTheDocument();
	});

	it("builds the CLI pull command from the function", async () => {
		mockBackend({ name: "My Func" });
		renderRoute();

		expect(await screen.findByLabelText("CLI pull command")).toHaveValue(
			"shsf remote pull --id 1 --into ./my-func --force",
		);
	});

	it("toggles the Run Params textarea and flags invalid JSON", async () => {
		mockBackend();
		renderRoute();
		fireEvent.click(await screen.findByRole("button", { name: "Run Params" }));

		const params = screen.getByPlaceholderText("Enter JSON run parameters...");
		fireEvent.change(params, { target: { value: "{bad" } });
		expect(params).toHaveClass("text-red-400");
		fireEvent.change(params, { target: { value: "{}" } });
		expect(params).toHaveClass("text-text");
	});

	it("toggles result modals", async () => {
		mockBackend();
		renderRoute();

		fireEvent.click(await screen.findByRole("button", { name: "Modals On" }));
		expect(screen.getByRole("button", { name: "Modals Off" })).toBeInTheDocument();
	});
});
