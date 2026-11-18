import { act, render, screen } from "@testing-library/react";
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
	const { usePageTitle } = await import("./hooks/usePageTitle");
	return {
		...actual,
		routes: actual.routes.map((route) => ({
			...route,
			component:
				route.path === "/functions/:id"
					? () => {
							usePageTitle("worker");
							return React.createElement("div", null, "function detail");
						}
					: () => React.createElement("div", null, `page:${route.path}`),
		})),
	};
});

const user: User = {
	id: 1,
	displayName: "Test User",
	email: "test@example.com",
	role: "User",
};

const renderRoute = (
	path: string,
	value: { user: User | null; loading: boolean; error: string | null } = {
		user,
		loading: false,
		error: null,
	},
) => {
	const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
	render(
		<UserContext.Provider value={{ ...value, refreshUser: vi.fn() }}>
			<RouterProvider router={router} />
		</UserContext.Provider>,
	);
	return router;
};

describe("document title", () => {
	beforeEach(() => {
		document.title = "SHSF - Serverless Functions for you";
	});

	it("uses the bare site name on home", () => {
		renderRoute("/");

		expect(document.title).toBe("SHSF");
	});

	it("uses the route name metadata for list pages", () => {
		renderRoute("/functions");

		expect(document.title).toBe("Functions · SHSF");
	});

	it("refines the title with the function name on the detail route", () => {
		renderRoute("/functions/12");

		expect(screen.getByText("function detail")).toBeInTheDocument();
		expect(document.title).toBe("worker · SHSF");
	});

	it("falls back to the not-found title for an unknown route", () => {
		renderRoute("/does-not-exist");

		expect(document.title).toBe("Not Found · SHSF");
	});

	it("titles the unavailable state when the session cannot be verified", () => {
		renderRoute("/functions", { user: null, loading: false, error: "SHSF is offline" });

		expect(document.title).toBe("Unavailable · SHSF");
	});

	it("restores the previous title after navigating back", async () => {
		const router = renderRoute("/functions");

		await act(async () => {
			await router.navigate("/functions/12");
		});
		expect(document.title).toBe("worker · SHSF");

		await act(async () => {
			await router.navigate(-1);
		});
		expect(document.title).toBe("Functions · SHSF");
	});

	it("restores the title present before mount once the app unmounts", () => {
		document.title = "previous title";
		const router = createMemoryRouter(createAppRoutes(), { initialEntries: ["/functions"] });
		const { unmount } = render(
			<UserContext.Provider
				value={{ user, loading: false, error: null, refreshUser: vi.fn() }}
			>
				<RouterProvider router={router} />
			</UserContext.Provider>,
		);

		expect(document.title).toBe("Functions · SHSF");
		unmount();
		expect(document.title).toBe("previous title");
	});
});
