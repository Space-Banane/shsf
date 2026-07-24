import { prisma } from "../../..";

// ── types ─────────────────────────────────────────────────────────────────────

export type McpToolResult = {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
};

export type ToolContext = {
	userId: number;
	apiKey: string;
};

export type ToolHandler = (
	args: Record<string, unknown>,
	ctx: ToolContext,
) => Promise<McpToolResult>;

export type McpToolDef = {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	handler: ToolHandler;
};

// ── response helpers ──────────────────────────────────────────────────────────

export function text(s: string): McpToolResult {
	return { content: [{ type: "text", text: s }] };
}

export function json(v: unknown): McpToolResult {
	return text(JSON.stringify(v, null, 2));
}

export function errResult(message: string): McpToolResult {
	return { content: [{ type: "text", text: message }], isError: true };
}

// ── image helpers ─────────────────────────────────────────────────────────────

export const VALID_IMAGES = [
	"python:3.11",
	"python:3.12",
	"python:3.13",
	"python:3.14",
	"python:3.15",
	"golang:1.22",
	"golang:1.23",
	"node:20",
	"node:22",
	"node:24",
];

export function imageFamily(image: string) {
	return image.split(":")[0];
}

// ── function lookup ───────────────────────────────────────────────────────────

export const FUNCTION_ID_SCHEMA = {
	oneOf: [
		{
			required: ["id"],
			properties: { id: { type: "integer", description: "Database ID of the function" } },
		},
		{
			required: ["execution_alias"],
			properties: { execution_alias: { type: "string", description: "Execution alias" } },
		},
		{
			required: ["name", "namespace"],
			properties: {
				name: { type: "string", description: "Function name" },
				namespace: { type: "string", description: "Namespace name" },
			},
		},
	],
};

/** Resolve a function belonging to the user by id, alias, or name+namespace. */
export async function resolveFunction(
	args: Record<string, unknown>,
	userId: number,
) {
	const id = typeof args.id === "number" ? args.id : undefined;
	const alias = typeof args.execution_alias === "string" ? args.execution_alias : undefined;
	const name = typeof args.name === "string" ? args.name : undefined;
	const ns = typeof args.namespace === "string" ? args.namespace : undefined;

	if (id !== undefined) {
		return prisma.function.findFirst({
			where: { id, userId },
			include: { namespace: { select: { name: true, id: true } } },
		});
	}
	if (alias) {
		return prisma.function.findFirst({
			where: { executionAlias: alias, namespace: { userId } },
			include: { namespace: { select: { name: true, id: true } } },
		});
	}
	if (name && ns) {
		return prisma.function.findFirst({
			where: { name, namespace: { name: ns, userId } },
			include: { namespace: { select: { name: true, id: true } } },
		});
	}
	return null;
}

// ── trigger lookup ────────────────────────────────────────────────────────────

/** Resolve a cron trigger by id, scoped to functions owned by the user. */
export async function resolveTrigger(triggerId: number, userId: number) {
	return prisma.functionTrigger.findFirst({
		where: { id: triggerId, function: { userId } },
		include: { function: { select: { id: true, name: true, namespace: { select: { name: true } } } } },
	});
}
