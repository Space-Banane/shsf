import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NavBar } from "./NavBar";

vi.mock("../../index", () => ({
	BASE_URL: "",
	PUBLIC_BASE_URL: "",
	VERSION: { type: "SHSF UI", major: 2, minor: 1, patch: 0, toString: () => "2.1.0" },
}));

vi.mock("../../Routes", () => {
	const page = () => null;
	return {
		routes: [
			{ path: "/", name: "Home", component: page, requireAuth: false, show_nav: true },
			{ path: "/functions", name: "Functions", component: page, requireAuth: true, show_nav: true },
			{ path: "/analytics", name: "Analytics", component: page, requireAuth: true, show_nav: true },
			{ path: "/docs", name: "Docs", component: page, requireAuth: false, show_nav: true },
			{ path: "/login", name: "Login", component: page, requireAuth: false },
			{ path: "/account", name: "Account", component: page, requireAuth: true },
		],
	};
});

const renderNav = () => render(
	<MemoryRouter initialEntries={["/"]}>
		<NavBar user={null} loading={false} refreshUser={vi.fn()} />
		<Routes>
			<Route path="/functions" element={<p>functions page</p>} />
			<Route path="/login" element={<p>login page</p>} />
		</Routes>
	</MemoryRouter>,
);

describe("NavBar navigation", () => {
	it("navigates internal routes through the router", async () => {
		renderNav();
		fireEvent.click(screen.getByRole("link", { name: "Functions" }));
		await screen.findByText("functions page");
	});

	it("keeps the OpenAPI reference as a plain anchor", () => {
		renderNav();
		expect(screen.getByRole("link", { name: "API Reference" })).toHaveAttribute("href", "/api/openapi.json");
	});
});
