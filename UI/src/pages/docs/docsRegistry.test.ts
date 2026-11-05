import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { documentation, documentationRoutes, getDocumentationNavigation, validateDocumentationRoutes } from "./docsRegistry";

vi.mock("react-router-dom", () => ({ useLocation: () => ({ pathname: "/docs/getting-started" }) }), { virtual: true });

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

	it("adds Troubleshooting to every other page's related guides", () => {
		for (const entry of documentation) {
			const keys = getDocumentationNavigation(entry.path).related.map((related) => related.key);
			expect(keys.includes("troubleshooting")).toBe(entry.key !== "troubleshooting");
		}
	});

	it("only documents API routes the backend defines", () => {
		const routesDir = resolve(__dirname, "../../../../Backend/src/routes");
		const backendRoutes = readdirSync(routesDir, { recursive: true, encoding: "utf8" })
			.filter((file) => file.endsWith(".ts"))
			.flatMap((file) => [...readFileSync(resolve(routesDir, file), "utf8").matchAll(/\.http\("[A-Z]+",\s*"(\/api\/[^"]+)"/g)].map((match) => match[1]))
			.map((route) => new RegExp(`^${route.replace(/\{[^}]+\}/g, "[^/]+")}$`));
		const unknown = readdirSync(__dirname)
			.filter((file) => file.endsWith(".tsx"))
			.flatMap((file) => [...readFileSync(`${__dirname}/${file}`, "utf8").matchAll(/(\/api\/[\w{}&#;./-]*\w)/g)].map((match) => ({ file, route: match[1].replace(/&#123;\w+&#125;/g, "x").replace(/\{\w+\}/g, "x") })))
			.filter(({ route }) => !route.startsWith("/api/exec/") && !backendRoutes.some((pattern) => pattern.test(route)))
			.map(({ file, route }) => `${file}: ${route}`);

		expect(backendRoutes.length).toBeGreaterThan(50);
		expect(unknown).toEqual([]);
	});

	it("only links to registered documentation pages", () => {
		const known = new Set<string>(documentation.map((entry) => entry.path));
		const broken = readdirSync(__dirname)
			.filter((file) => file.endsWith(".tsx"))
			.flatMap((file) => [...readFileSync(`${__dirname}/${file}`, "utf8").matchAll(/href="(\/docs\/[^"#?]+)"/g)].map((match) => ({ file, href: match[1] })))
			.filter(({ href }) => !known.has(href))
			.map(({ file, href }) => `${file}: ${href}`);

		expect(broken).toEqual([]);
	});
});
