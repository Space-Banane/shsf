import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import FunctionsList from "./FunctionsList";
import { getFunctions } from "../../services/backend.functions";
import { getNamespaces } from "../../services/backend.namespaces";

vi.mock("../..", () => ({ BASE_URL: "", PUBLIC_BASE_URL: "http://shsf.test" }));
vi.mock("../../App", async () => {
	const { createContext } = await import("react");
	return { UserContext: createContext({ user: { apiKeyConfigured: false } }) };
});
vi.mock("../../services/backend.functions", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../services/backend.functions")>()),
	getFunctions: vi.fn(),
	getDeprecatedImages: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../services/backend.namespaces");

function renderList(initialEntry: string) {
	const router = createMemoryRouter(
		[{ path: "/functions", element: <FunctionsList /> }],
		{ initialEntries: [initialEntry] },
	);
	render(<RouterProvider router={router} />);
	return router;
}

function makeFunction(id: number, name: string) {
	return {
		id,
		name,
		namespaceId: 2,
		description: "",
		startup_file: "main.py",
		imported: false,
		ai_kicked_off: false,
		shared: false,
	} as never;
}

function makeListResponse(data: unknown[], total = data.length) {
	return {
		status: "OK",
		data,
		pagination: { page: 1, limit: 25, total, totalPages: 1 },
	} as never;
}

describe("FunctionsList URL state", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getNamespaces).mockResolvedValue({
			status: "OK",
			data: [{ id: 2, name: "prod" }],
		} as never);
		vi.mocked(getFunctions).mockResolvedValue({
			status: "OK",
			data: [],
			pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
		} as never);
	});

	it("loads filters, sort and page from the URL", async () => {
		renderList(
			"/functions?search=alpha&namespace=2&runtime=python&tag=api&status=has-run&sort=createdAt&order=desc&page=3",
		);

		await waitFor(() =>
			expect(getFunctions).toHaveBeenCalledWith(
				false,
				expect.objectContaining({
					search: "alpha",
					namespaceId: 2,
					runtime: "python",
					tag: "api",
					status: "has-run",
					sort: "createdAt",
					order: "desc",
					page: 3,
				}),
			),
		);
		expect(screen.getByPlaceholderText("Search functions…")).toHaveValue("alpha");
		expect(screen.getByLabelText("Tag filter")).toHaveValue("api");
	});

	it("replaces the history entry when a filter changes", async () => {
		const router = renderList("/functions");
		await waitFor(() => expect(getFunctions).toHaveBeenCalled());

		fireEvent.change(screen.getByLabelText("Sort functions"), {
			target: { value: "name-desc" },
		});

		await waitFor(() => expect(router.state.location.search).toBe("?order=desc"));
		expect(router.state.historyAction).toBe("REPLACE");
		await waitFor(() =>
			expect(getFunctions).toHaveBeenLastCalledWith(
				false,
				expect.objectContaining({ sort: "name", order: "desc", page: 1 }),
			),
		);
	});

	it("debounces the search and tag inputs and fetches namespaces once", async () => {
		renderList("/functions");
		await waitFor(() => expect(getFunctions).toHaveBeenCalledTimes(1));
		expect(getNamespaces).toHaveBeenCalledTimes(1);

		const search = screen.getByPlaceholderText("Search functions…");
		fireEvent.change(search, { target: { value: "a" } });
		fireEvent.change(search, { target: { value: "ab" } });
		fireEvent.change(search, { target: { value: "abc" } });

		expect(search).toHaveValue("abc");
		expect(getFunctions).toHaveBeenCalledTimes(1);

		await waitFor(() =>
			expect(getFunctions).toHaveBeenLastCalledWith(
				false,
				expect.objectContaining({ search: "abc" }),
			),
		);
		expect(getFunctions).toHaveBeenCalledTimes(2);
		expect(getNamespaces).toHaveBeenCalledTimes(1);

		const tag = screen.getByLabelText("Tag filter");
		fireEvent.change(tag, { target: { value: "a" } });
		fireEvent.change(tag, { target: { value: "api" } });

		expect(tag).toHaveValue("api");
		expect(getFunctions).toHaveBeenCalledTimes(2);

		await waitFor(() =>
			expect(getFunctions).toHaveBeenLastCalledWith(
				false,
				expect.objectContaining({ search: "abc", tag: "api" }),
			),
		);
		expect(getFunctions).toHaveBeenCalledTimes(3);
		expect(getNamespaces).toHaveBeenCalledTimes(1);
	});

	it("ignores a stale response that resolves after a newer query", async () => {
		const router = renderList("/functions");
		await waitFor(() =>
			expect(screen.getByText("No functions found.")).toBeInTheDocument(),
		);

		const resolvers: Array<(value: unknown) => void> = [];
		vi.mocked(getFunctions).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolvers.push(resolve);
				}) as never,
		);

		fireEvent.change(screen.getByLabelText("Sort functions"), {
			target: { value: "name-desc" },
		});
		await waitFor(() => expect(router.state.location.search).toBe("?order=desc"));
		await waitFor(() => expect(resolvers).toHaveLength(1));

		fireEvent.change(screen.getByLabelText("Sort functions"), {
			target: { value: "createdAt-desc" },
		});
		await waitFor(() =>
			expect(router.state.location.search).toContain("sort=createdAt"),
		);
		await waitFor(() => expect(resolvers).toHaveLength(2));

		await act(async () => {
			resolvers[1](makeListResponse([makeFunction(2, "newest")], 1));
		});
		expect(await screen.findByText("newest")).toBeInTheDocument();

		await act(async () => {
			resolvers[0](makeListResponse([makeFunction(1, "stale")], 1));
		});

		expect(screen.queryByText("stale")).not.toBeInTheDocument();
		expect(screen.getByText("newest")).toBeInTheDocument();
	});
});
