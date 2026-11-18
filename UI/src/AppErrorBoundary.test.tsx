import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { UserContext, createAppRoutes } from "./App";

vi.mock(".", () => ({
	BASE_URL: "",
	PUBLIC_BASE_URL: "",
	VERSION: { type: "SHSF UI", major: 2, minor: 1, patch: 0, toString: () => "2.1.0" },
}));

vi.mock("./Routes", () => ({
	routes: [
		{ path: "/", component: () => <div>home page</div>, name: "Home", requireAuth: false, show_nav: true },
		{
			path: "/broken",
			component: () => {
				throw new Error("render exploded");
			},
			name: "Broken",
			requireAuth: false,
		},
	],
}));

it("shows the root error boundary for a render failure and recovers", async () => {
	const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
	const router = createMemoryRouter(createAppRoutes(), { initialEntries: ["/broken"] });

	render(
		<UserContext.Provider value={{ user: null, loading: false, error: null, refreshUser: vi.fn() }}>
			<RouterProvider router={router} />
		</UserContext.Provider>,
	);

	expect(screen.getByRole("alert")).toBeInTheDocument();
	expect(screen.getByText("Something went wrong")).toBeInTheDocument();
	expect(screen.getByText("render exploded")).toBeInTheDocument();

	fireEvent.click(screen.getByRole("link", { name: "Go home" }));
	expect(await screen.findByText("home page")).toBeInTheDocument();

	consoleError.mockRestore();
});
