import { beforeEach, describe, expect, it, vi } from "vitest";
import { z, type ZodType } from "zod";
import "../routes/api/files";
import "../routes/api/functions/manage";

interface TestContext {
	cookies: { get: () => null };
	headers: { get: () => null };
	params: { get: (key: string) => string | undefined };
	$status: Record<string, number>;
	status: (code: number) => TestContext;
	print: (body: unknown) => unknown;
	bindBody: (schema: (builder: typeof z) => ZodType) => Promise<[unknown, unknown]>;
}

const harness = vi.hoisted(() => ({
	handlers: new Map<string, (context: TestContext) => Promise<unknown>>(),
	invalidateCache: vi.fn(),
	findFunction: vi.fn(),
	findFunctionUnique: vi.fn(),
	findFile: vi.fn(),
	createFile: vi.fn(),
	updateFile: vi.fn(),
	updateFunction: vi.fn(),
	function: {
		id: 10, userId: 1, namespaceId: 3, name: "demo", description: "demo",
		image: "python:3.12", startup_file: "main.py", docker_mount: false,
	},
}));

vi.mock("../index", () => ({
	COOKIE: "session",
	API_KEY_HEADER: "api-key",
	INSTANCE_SECRET: "cache-invalidation-test-secret",
	prisma: {
		function: {
			findFirst: harness.findFunction,
			findUnique: harness.findFunctionUnique,
			update: harness.updateFunction,
		},
		functionFile: {
			findFirst: harness.findFile,
			findUnique: harness.findFile,
			create: harness.createFile,
			update: harness.updateFile,
		},
		functionFolder: {
			createMany: vi.fn(),
			findFirst: vi.fn().mockResolvedValue(null),
			findMany: vi.fn().mockResolvedValue([]),
			delete: vi.fn(),
			upsert: vi.fn(),
		},
	},
	fileRouter: {
		Path: class {
			http(method: string, path: string, configure: (route: unknown) => unknown) {
				const route = {
					document: () => route,
					onRequest: (handler: (context: TestContext) => Promise<unknown>) => {
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
vi.mock("../lib/Caching", () => ({
	invalidateFunctionCache: harness.invalidateCache,
}));
vi.mock("../lib/Authentication", () => ({
	checkAuthentication: async () => ({ success: true, user: { id: 1 } }),
}));
vi.mock("../lib/Sharing", () => ({
	functionAccessWhere: () => ({}),
	functionAccessInclude: () => ({}),
	describeFunctionAccess: () => ({}),
	redactFunctionForAccess: (fn: unknown) => fn,
}));
vi.mock("../lib/GitEditGuards", () => ({ getGitEditBlock: async () => null }));
vi.mock("../lib/FileHelpers", () => ({
	getFunctionExecInfo: async () => null,
	replaceApiBaseInContent: (content: string) => content,
}));
vi.mock("../lib/StoragePaths", () => ({
	getFunctionAppDir: () => "/tmp/shsf-cache-invalidation-test",
}));
vi.mock("../lib/GitOps", () => ({ listGitAppFiles: vi.fn() }));
vi.mock("../lib/Runner", () => ({
	cleanupFunctionContainer: vi.fn(),
	deleteContainerForFunction: vi.fn(),
}));
vi.mock("../lib/DataManager", () => ({ getDisabledImages: async () => [] }));
vi.mock("../lib/LogAnalysis", () => ({ toExecutionLogAnalysis: vi.fn() }));

async function request(route: string, body: unknown) {
	const context = {
		cookies: { get: () => null },
		headers: { get: () => null },
		params: { get: (key: string) => (key === "id" ? "10" : undefined) },
		$status: {
			BAD_REQUEST: 400,
			UNAUTHORIZED: 401,
			FORBIDDEN: 403,
			NOT_FOUND: 404,
			INTERNAL_SERVER_ERROR: 500,
		},
	} as unknown as TestContext;

	context.status = vi.fn(() => context) as unknown as TestContext["status"];
	context.print = (response: unknown) => response;
	context.bindBody = async (schema) => {
		const parsed = schema(z).safeParse(body);
		return parsed.success ? [parsed.data, null] : [null, parsed.error];
	};

	const handler = harness.handlers.get(route);
	if (!handler) throw new Error(`Missing route ${route}`);
	const response = await handler(context);
	return { response, context };
}

beforeEach(() => {
	vi.clearAllMocks();
	harness.findFunction.mockResolvedValue({ id: 10 });
	harness.findFunctionUnique.mockResolvedValue({ startup_file: "main.py" });
	harness.findFile.mockResolvedValue(null);
	harness.createFile.mockImplementation(
		async ({ data }: { data: Record<string, unknown> }) => ({ id: 5, ...data }),
	);
	harness.updateFunction.mockImplementation(
		async ({ data }: { data: Record<string, unknown> }) => ({
			...harness.function,
			...data,
		}),
	);
	harness.invalidateCache.mockResolvedValue({ count: 1 });
});

describe("function cache invalidation wiring", () => {
	it("invalidates the cache when a function file is saved", async () => {
		const { response } = await request("PUT /api/function/{id}/file", {
			filename: "main.py",
			code: "print('updated')",
		});

		expect(response).toMatchObject({ status: "OK" });
		expect(harness.invalidateCache).toHaveBeenCalledWith(10);
	});

	it("invalidates the cache when execution settings change", async () => {
		const { response } = await request("PATCH /api/function/{id}", {
			settings: { cache_enabled: true },
		});

		expect(response).toMatchObject({ status: "OK" });
		expect(harness.invalidateCache).toHaveBeenCalledWith(10);
	});
});
