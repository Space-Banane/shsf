import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { UserContext, createAppRoutes } from "./App";
import type { User } from "./types/Prisma";

vi.mock(".", () => ({
	BASE_URL: "",
	PUBLIC_BASE_URL: "",
	VERSION: { type: "SHSF UI", major: 2, minor: 1, patch: 0, toString: () => "2.1.0" },
}));

vi.mock("./Routes", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./Routes")>();
	const React = await import("react");
	return {
		...actual,
		routes: actual.routes.map((route) => ({
			...route,
			// The page-local admin guard is intentionally absent so the router gate is what is tested.
			component: () => React.createElement("div", null, `page:${route.path}`),
		})),
	};
});

const fetchMock = vi.fn();

const makeUser = (role: User["role"]): User => ({
	id: 1,
	displayName: "Test User",
	email: "test@example.com",
	role,
});

const renderRoute = (
	path: string,
	{ user = null, loading = false, error = null }: { user?: User | null; loading?: boolean; error?: string | null } = {},
) => {
	const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
	render(
		<UserContext.Provider value={{ user, loading, error, refreshUser: vi.fn() }}>
			<RouterProvider router={router} />
		</UserContext.Provider>,
	);
	return router;
};

describe("app router auth gate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(global, "fetch", {
			writable: true,
			value: fetchMock.mockResolvedValue({ json: async () => ({}) }),
		});
	});

	it("redirects an anonymous visitor from a protected route to the login page", () => {
		const router = renderRoute("/functions");

		expect(router.state.location.pathname).toBe("/login");
		expect(screen.queryByText("page:/functions")).not.toBeInTheDocument();
	});

	it("renders a protected page for a signed-in user", () => {
		renderRoute("/functions", { user: makeUser("User") });

		expect(screen.getByText("page:/functions")).toBeInTheDocument();
	});

	it("does not render the admin page for a signed-in non-admin", () => {
		const router = renderRoute("/admin", { user: makeUser("User") });

		expect(router.state.location.pathname).toBe("/");
		expect(screen.queryByText("page:/admin")).not.toBeInTheDocument();
		expect(screen.getByText("page:/")).toBeInTheDocument();
	});

	it("renders the admin page for an admin", () => {
		renderRoute("/admin", { user: makeUser("Admin") });

		expect(screen.getByText("page:/admin")).toBeInTheDocument();
	});

	it("shows the recovery UI when the server is unavailable", () => {
		renderRoute("/functions", { error: "SHSF is offline" });

		expect(screen.getByText("SHSF is unavailable")).toBeInTheDocument();
		expect(screen.getByText("SHSF is offline")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
	});

	it("renders the 404 page for an unknown route", () => {
		renderRoute("/does-not-exist");

		expect(screen.getByText("404 - Not Found")).toBeInTheDocument();
	});
});
