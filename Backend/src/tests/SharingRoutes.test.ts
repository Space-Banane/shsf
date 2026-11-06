import { beforeEach, describe, expect, it, vi } from "vitest";
import { z, type ZodType } from "zod";
import { encryptSecret } from "../lib/GitOps";
import "../routes/api/files";
import "../routes/api/functions/manage";
import "../routes/api/functions/git";

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
	userId: 2,
	access: "edit",
	fn: {
		id: 10, userId: 1, namespaceId: 3, name: "original", description: "original description",
		image: "python:3.12", startup_file: "main.py", docker_mount: false,
		git_url: "https://git.example/owner/repo.git", git_username: "owner", git_password: "",
	},
	file: { id: 20, functionId: 10, name: "main.py", content: "original code" },
	findFunction: vi.fn(), findFile: vi.fn(), updateFunction: vi.fn(), updateFile: vi.fn(),
	runGit: vi.fn(),
}));

vi.mock("../index", () => ({
	COOKIE: "session", API_KEY_HEADER: "api-key", INSTANCE_SECRET: "sharing-route-test-secret",
	prisma: {
		function: { findFirst: harness.findFunction, findUnique: harness.findFunction, update: harness.updateFunction },
		functionFile: { findFirst: harness.findFile, findUnique: harness.findFile, update: harness.updateFile },
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
vi.mock("../lib/Authentication", () => ({ checkAuthentication: async () => ({ success: true, user: { id: harness.userId } }) }));
vi.mock("../lib/GitEditGuards", () => ({ getGitEditBlock: async () => null }));
vi.mock("../lib/Runner", () => ({ cleanupFunctionContainer: vi.fn(), deleteContainerForFunction: vi.fn() }));
vi.mock("../lib/DataManager", () => ({ getDisabledImages: async () => [] }));
vi.mock("../lib/LogAnalysis", () => ({ toExecutionLogAnalysis: vi.fn() }));
vi.mock("../lib/GitOps", async (importOriginal) => ({
	...await importOriginal<typeof import("../lib/GitOps")>(),
	clearAppDirectory: vi.fn(), runGitCommand: harness.runGit,
}));

async function request(route: string, body: unknown, params = { id: "10", fileId: "20" }) {
	const context: TestContext = {
		cookies: { get: () => null }, headers: { get: () => null },
		params: { get: (key) => params[key as keyof typeof params] },
		$status: { BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, INTERNAL_SERVER_ERROR: 500 },
		status: vi.fn(() => context), print: (response) => response,
		bindBody: async (schema) => {
			const parsed = schema(z).safeParse(body);
			return parsed.success ? [parsed.data, null] : [null, parsed.error];
		},
	};
	const handler = harness.handlers.get(route);
	if (!handler) throw new Error(`Missing route ${route}`);
	return { response: await handler(context), context };
}

beforeEach(() => {
	vi.clearAllMocks();
	harness.userId = 2;
	harness.access = "edit";
	harness.file.content = "original code";
	harness.fn.name = "original";
	harness.fn.description = "original description";
	harness.fn.git_url = "https://git.example/owner/repo.git";
	harness.fn.git_username = "owner";
	harness.fn.git_password = encryptSecret("owner-git-token", "sharing-route-test-secret");
	harness.findFunction.mockImplementation(async ({ where }: { where: { id: number; AND?: unknown } }) => {
		if (where.id !== harness.fn.id || (where.AND && harness.access !== "edit" && harness.userId !== 1)) return null;
		return { ...harness.fn };
	});
	harness.findFile.mockImplementation(async ({ where }: { where: { id: number; functionId?: number } }) =>
		where.id === harness.file.id && (where.functionId === undefined || where.functionId === harness.file.functionId)
			? { ...harness.file } : null);
	harness.updateFunction.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => Object.assign(harness.fn, data));
	harness.updateFile.mockImplementation(async ({ data }: { data: { content: string } }) => Object.assign(harness.file, data));
	harness.runGit.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
});

describe("shared function authorization regressions", () => {
	const fillRoute = "POST /api/function/{id}/file/{fileId}/load-fill_default";
	it.each(["view", "none"])("denies template writes with %s access", async (access) => {
		harness.access = access;
		const { response, context } = await request(fillRoute, { defaultToLoad: "python_http_api" });
		expect(context.status).toHaveBeenCalledWith(404);
		expect(response).toMatchObject({ status: 404 });
		expect(harness.file.content).toBe("original code");
	});
	it("binds the template target file to the authorized function", async () => {
		harness.file.functionId = 999;
		try {
			const { response, context } = await request(fillRoute, { defaultToLoad: "python_http_api" });
			expect(context.status).toHaveBeenCalledWith(404);
			expect(response).toMatchObject({ status: 404 });
			expect(harness.file.content).toBe("original code");
		} finally { harness.file.functionId = 10; }
	});
	it("lets an editor load a template into the shared function's own file", async () => {
		const { response } = await request(fillRoute, { defaultToLoad: "python_http_api" });
		expect(response).toMatchObject({ status: "OK", data: { id: 20, functionId: 10 } });
		expect(harness.file.content).toContain("def main(args):");
	});
	it("denies renaming by editors", async () => {
		const { response, context } = await request("PATCH /api/function/{id}", { name: "renamed" });
		expect(context.status).toHaveBeenCalledWith(403);
		expect(response).toMatchObject({ status: 403 });
		expect(harness.fn.name).toBe("original");
	});
	it("redacts credentials from successful editor updates", async () => {
		const { response } = await request("PATCH /api/function/{id}", { description: "edited description" });
		expect(response).toMatchObject({ status: "OK", data: { description: "edited description", git_password: null } });
		expect(harness.fn.description).toBe("edited description");
	});
	it("preserves owner renames and owner responses", async () => {
		harness.userId = 1;
		const { response } = await request("PATCH /api/function/{id}", { name: "renamed" });
		expect(response).toMatchObject({ status: "OK", data: { name: "renamed", git_password: harness.fn.git_password } });
	});
	it.each(["clone", "branches", "tree"])("never sends saved credentials to an editor's replacement URL via %s", async (operation) => {
		const { response } = await request(`POST /api/function/{id}/git/${operation}`, {
			git_url: "https://attacker.example/repo.git", git_username: "attacker",
		});
		expect(response).toMatchObject({ status: "OK" });
		const args: string[] = harness.runGit.mock.calls[0][1];
		expect(args).toContain("https://attacker.example/repo.git");
		expect(args.join(" ")).not.toContain("owner-git-token");
		if (operation === "clone") {
			expect(harness.fn.git_password).toBeNull();
			await request("POST /api/function/{id}/git/branches", {});
			expect(harness.runGit.mock.calls[1][1].join(" ")).not.toContain("owner-git-token");
		}
	});
	it("reuses saved credentials for the configured repository", async () => {
		const { response } = await request("POST /api/function/{id}/git/branches", {});
		expect(response).toMatchObject({ status: "OK", data: [] });
		expect(harness.runGit.mock.calls[0][1]).toEqual(["ls-remote", "--heads", "https://owner:owner-git-token@git.example/owner/repo.git"]);
	});
});
