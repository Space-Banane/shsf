import { documentation, documentationRoutes, getDocumentationNavigation, validateDocumentationRoutes } from "./docsRegistry";

jest.mock("react-router-dom", () => ({ useLocation: () => ({ pathname: "/docs/getting-started" }) }), { virtual: true });

describe("documentation registry", () => {
	it("keeps every configured link on a registered documentation route", () => {
		expect(validateDocumentationRoutes(documentationRoutes.map((route) => route.path))).toEqual([]);
		expect(validateDocumentationRoutes(documentationRoutes.slice(1).map((route) => route.path))).toContain("Missing route: /docs/getting-started");
		expect(validateDocumentationRoutes([...documentationRoutes.map((route) => route.path), "/docs/not-indexed"])).toContain("Unindexed route: /docs/not-indexed");
		expect(new Set(documentation.map((entry) => entry.key)).size).toBe(documentation.length);
		expect(new Set(documentation.map((entry) => entry.path)).size).toBe(documentation.length);
	});

	it("derives previous and next pages from the configured order", () => {
		const first = getDocumentationNavigation(documentation[0].path);
		const middle = getDocumentationNavigation(documentation[1].path);
		const last = getDocumentationNavigation(documentation[documentation.length - 1].path);

		expect(first.previous).toBeUndefined();
		expect(first.next).toBe(documentation[1]);
		expect(middle.previous).toBe(documentation[0]);
		expect(last.next).toBeUndefined();
	});
});
