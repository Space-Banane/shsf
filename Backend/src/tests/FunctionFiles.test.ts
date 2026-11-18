import { beforeEach, describe, expect, it, vi } from "vitest";
import "../routes/api/files";

interface TestContext {
	cookies: { get: () => null };
	headers: { get: () => null };
	getAuth: () => { success: true; method: "session"; user: { id: number } };
	params: { get: (key: string) => string | undefined };
	queries: { get: (key: string) => string | undefined };
	$status: Record<string, number>;
	status: (code: number) => TestContext;
	print: (body: unknown) => unknown;
}

const harness = vi.hoisted(() => ({
	handlers: new Map<string, (context: TestContext) => Promise<unknown>>(),
	functionData: { id: 10, git_url: "" as string | null },
	files: [
		{
			id: 20,
			name: "main.py",
			content: "print('secret')",
			updatedAt: new Date("2026-01-01T00:00:00Z"),
		},
	],
	findMany: vi.fn(),
}));

vi.mock("../index", () => ({
	COOKIE: "session",
	API_KEY_HEADER: "api-key",
	INSTANCE_SECRET: "function-files-test-secret",
	prisma: {
		function: {
			findFirst: vi.fn(async () => ({ ...harness.functionData })),
			findUnique: vi.fn(async () => ({ ...harness.functionData })),
		},
		functionFile: {
			findMany: harness.findMany,
			findFirst: vi.fn(async ({ where }: { where: { name: string } }) => {
				const file = harness.files.find((entry) => entry.name === where.name);
				return file ? { name: file.name, content: file.content } : null;
			}),
		},
	},
	fileRouter: {
		Path: class {
			http(
				method: string,
				path: string,
				configure: (route: unknown) => unknown,
			) {
				const route = {
					document: () => route,
					onRequest: (
						handler: (context: TestContext) => Promise<unknown>,
					) => {
						harness.handlers.set(`${method} ${path}`, handler);
						return route;
					},
				};
				configure(route);
				return this;
			}
		},
	},
}));

vi.mock("../lib/Authentication", () => ({
	checkAuthentication: async () => ({ success: true, user: { id: 2 } }),
}));
vi.mock("../lib/GitEditGuards", () => ({ getGitEditBlock: async () => null }));
vi.mock("../lib/Runner", () => ({
	cleanupFunctionContainer: vi.fn(),
	deleteContainerForFunction: vi.fn(),
}));
vi.mock("../lib/DataManager", () => ({ getDisabledImages: async () => [] }));
vi.mock("../lib/LogAnalysis", () => ({ toExecutionLogAnalysis: vi.fn() }));

async function request(route: string, queries: Record<string, string> = {}) {
	const context: TestContext = {
		cookies: { get: () => null },
		headers: { get: () => null },
		getAuth: () => ({ success: true, method: "session", user: { id: 2 } }),
		params: { get: (key) => (key === "id" ? "10" : undefined) },
		queries: { get: (key) => queries[key] },
		$status: {
			BAD_REQUEST: 400,
			UNAUTHORIZED: 401,
			NOT_FOUND: 404,
			INTERNAL_SERVER_ERROR: 500,
		},
		status: vi.fn(() => context),
		print: (response) => response,
	};
	const handler = harness.handlers.get(route);
	if (!handler) throw new Error(`Missing route ${route}`);
	return { response: await handler(context), context };
}

beforeEach(() => {
	vi.clearAllMocks();
	harness.functionData = { id: 10, git_url: "" };
	harness.findMany.mockImplementation(async () =>
		harness.files.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })),
	);
});

describe("function file listing", () => {
	it("returns only metadata and never selects content", async () => {
		const { response } = await request("GET /api/function/{id}/files");

		expect(harness.findMany).toHaveBeenCalledWith({
			where: { functionId: 10 },
			select: { id: true, name: true, updatedAt: true },
		});
		expect(response).toEqual({
			status: "OK",
			data: [
				{
					id: 20,
					name: "main.py",
					updatedAt: new Date("2026-01-01T00:00:00Z"),
				},
			],
		});
		expect(JSON.stringify(response)).not.toContain("secret");
	});
});

describe("function file content", () => {
	it("loads one file by name", async () => {
		const { response } = await request("GET /api/function/{id}/file-content", {
			name: "main.py",
		});

		expect(response).toEqual({
			status: "OK",
			data: { name: "main.py", content: "print('secret')" },
		});
	});

	it("rejects a missing or traversing name", async () => {
		const missing = await request("GET /api/function/{id}/file-content");
		expect(missing.context.status).toHaveBeenCalledWith(400);

		const traversing = await request("GET /api/function/{id}/file-content", {
			name: "../outside.py",
		});
		expect(traversing.context.status).toHaveBeenCalledWith(400);
	});

	it("returns 404 for unknown files", async () => {
		const { response, context } = await request(
			"GET /api/function/{id}/file-content",
			{ name: "missing.py" },
		);

		expect(context.status).toHaveBeenCalledWith(404);
		expect(response).toEqual({ status: 404, message: "File not found" });
	});
});
