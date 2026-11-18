import { beforeEach, describe, expect, it, vi } from "vitest";
import { z, type ZodType } from "zod";
import { invalidateFunctionCache } from "../lib/Caching";
import "../routes/api/functions/execute";

interface TestContext {
	cookies: { get: () => null };
	headers: {
		entries: () => IterableIterator<[string, string]>;
		get: (name: string) => string | null;
		set: ReturnType<typeof vi.fn>;
	};
	getAuth: () => { success: true; method: "session"; user: { id: number } };
	queries: {
		get: (key: string) => string | null;
		entries: () => IterableIterator<[string, string]>;
	};
	params: { get: (key: string) => string | undefined };
	client: { ip: { usual: () => string } };
	$status: Record<string, number>;
	status: (code: number) => TestContext;
	print: (body: unknown) => unknown;
	printChunked: (callback: (print: (content: string) => Promise<void>) => Promise<unknown>) => Promise<unknown>;
	$abort: (callback: () => void) => void;
	$body: () => { text: () => Promise<string> };
	bindBody: (schema: (builder: typeof z) => ZodType) => Promise<[unknown, unknown]>;
}

const harness = vi.hoisted(() => ({
	handlers: new Map<string, (context: TestContext) => Promise<unknown>>(),
	executeFunction: vi.fn(),
	findFunction: vi.fn(),
	findFiles: vi.fn(),
	cache: {
		findFirst: vi.fn(),
		upsert: vi.fn(),
		deleteMany: vi.fn(),
	},
}));

vi.mock("../index", () => ({
	COOKIE: "session",
	API_KEY_HEADER: "api-key",
	prisma: {
		function: { findFirst: harness.findFunction },
		functionFile: { findMany: harness.findFiles },
		functionCache: harness.cache,
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
vi.mock("../lib/Authentication", () => ({
	checkAuthentication: async () => ({
		success: true,
		user: { id: 1 },
		method: "session",
	}),
}));
vi.mock("../lib/Sharing", () => ({ functionAccessWhere: () => ({}) }));
vi.mock("../lib/DataManager", () => ({ getExternalAccessDisabled: async () => false }));
vi.mock("../lib/Runner", () => ({ executeFunction: harness.executeFunction }));

const functionData = {
	id: 10,
	cache_enabled: true,
	cache_ttl: 30,
};

function createContext(
	query: Record<string, string> = {},
	chunks: string[] = [],
): TestContext {
	const context = {
		cookies: { get: () => null },
		headers: {
			entries: () => new Map([["content-type", "application/json"]]).entries(),
			get: (name: string) =>
				name.toLowerCase() === "content-type" ? "application/json" : null,
			set: vi.fn(),
		},
		getAuth: () => ({ success: true, method: "session", user: { id: 1 } }),
		queries: {
			get: (key: string) => query[key] ?? null,
			entries: () => new Map(Object.entries(query)).entries(),
		},
		params: { get: (key: string) => (key === "id" ? "10" : undefined) },
		client: { ip: { usual: () => "127.0.0.1" } },
		$status: {
			BAD_REQUEST: 400,
			UNAUTHORIZED: 401,
			FORBIDDEN: 403,
			NOT_FOUND: 404,
			INTERNAL_SERVER_ERROR: 500,
		},
	} as unknown as TestContext;

	context.status = vi.fn(() => context) as unknown as TestContext["status"];
	context.print = vi.fn((body: unknown) => body);
	context.printChunked = async (callback) => {
		await callback(async (content: string) => {
			chunks.push(content);
		});
		return "chunked";
	};
	context.$abort = vi.fn();
	context.$body = () => ({ text: async () => '{"run":{}}' });
	context.bindBody = async (schema) => {
		const parsed = schema(z).safeParse({ run: {} });
		return parsed.success ? [parsed.data, null] : [null, parsed.error];
	};

	return context;
}

async function execute(query: Record<string, string> = {}, chunks: string[] = []) {
	const handler = harness.handlers.get("POST /api/function/{id}/execute");
	if (!handler) throw new Error("Missing execute route");
	const context = createContext(query, chunks);
	return { response: await handler(context), context };
}

beforeEach(() => {
	vi.clearAllMocks();
	harness.findFunction.mockResolvedValue(functionData);
	harness.findFiles.mockResolvedValue([
		{ id: 1, functionId: 10, name: "main.py", content: "" },
	]);
	harness.executeFunction.mockResolvedValue({
		exit_code: 0,
		result: { answer: 42 },
		tooks: [],
	});
	harness.cache.upsert.mockResolvedValue({});
	harness.cache.deleteMany.mockResolvedValue({ count: 1 });
});

describe("streaming function cache", () => {
	it("replays a cache hit as an end event without fabricating stdout", async () => {
		harness.cache.findFirst.mockResolvedValue({
			result: JSON.stringify({ cached: true }),
		});
		const chunks: string[] = [];

		await execute({}, chunks);

		expect(harness.executeFunction).not.toHaveBeenCalled();
		expect(harness.cache.findFirst).toHaveBeenCalledTimes(1);
		expect(chunks.map((chunk) => JSON.parse(chunk))).toEqual([
			{
				type: "end",
				exitCode: 0,
				output: "",
				result: { cached: true },
				took: [],
			},
		]);
	});

	it("executes and writes the cache on a miss", async () => {
		harness.cache.findFirst.mockResolvedValue(null);
		harness.executeFunction.mockImplementation(
			async (
				_id: number,
				_functionData: unknown,
				_files: unknown,
				options: { onChunk: (text: string) => Promise<void> },
			) => {
				await options.onChunk("hello ");
				await options.onChunk("world");
				return {
					exit_code: 0,
					result: { answer: 42 },
					tooks: [],
				};
			},
		);
		const chunks: string[] = [];

		const { context } = await execute({}, chunks);

		expect(context.headers.set).toHaveBeenCalledWith("X-SHSF-Cache", "MISS");
		expect(harness.cache.upsert).toHaveBeenCalledTimes(1);
		const upsertArgs = harness.cache.upsert.mock.calls[0][0];
		expect(upsertArgs.create.functionId).toBe(10);
		expect(upsertArgs.create.result).toBe(JSON.stringify({ answer: 42 }));
		expect(chunks.map((chunk) => JSON.parse(chunk)).at(-1)).toMatchObject({
			type: "end",
			exitCode: 0,
			output: "hello world",
			result: { answer: 42 },
		});
	});

	it("serves a non-stream cache hit without executing", async () => {
		harness.cache.findFirst.mockResolvedValue({
			result: JSON.stringify({ cached: true }),
		});
		const chunks: string[] = [];

		const { context } = await execute({ stream: "false" }, chunks);

		expect(harness.executeFunction).not.toHaveBeenCalled();
		expect(context.headers.set).toHaveBeenCalledWith("X-SHSF-Cache", "HIT");
		expect(context.print).toHaveBeenCalledWith({ cached: true });
	});
});

describe("function cache invalidation", () => {
	it("deletes every cached entry for the function", async () => {
		await invalidateFunctionCache(10);

		expect(harness.cache.deleteMany).toHaveBeenCalledWith({
			where: { functionId: 10 },
		});
	});

	it("does not throw when cache invalidation fails", async () => {
		harness.cache.deleteMany.mockRejectedValue(new Error("database unavailable"));

		await expect(invalidateFunctionCache(10)).resolves.toEqual({ count: 0 });
	});
});
