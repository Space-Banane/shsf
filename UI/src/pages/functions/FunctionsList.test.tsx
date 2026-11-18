import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import FunctionsList from "./FunctionsList";
import { getFunctions } from "../../services/backend.functions";
import { getNamespaces } from "../../services/backend.namespaces";

vi.mock("../..", () => ({ BASE_URL: "", PUBLIC_BASE_URL: "http://shsf.test" }));
vi.mock("../../App", async () => {
	const { createContext } = await import("react");
	return { UserContext: createContext({ user: { apiKeyConfigured: false } }) };
});
vi.mock("../../services/backend.functions");
vi.mock("../../services/backend.namespaces");

function renderList(initialEntry: string) {
	const router = createMemoryRouter(
		[{ path: "/functions", element: <FunctionsList /> }],
		{ initialEntries: [initialEntry] },
	);
	render(<RouterProvider router={router} />);
	return router;
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
});
