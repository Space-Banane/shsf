import { prisma } from "../../..";
import { McpToolDef, json } from "./shared";

const tool: McpToolDef = {
	name: "list_functions",
	description:
		"List all serverless functions for the authenticated user. Optionally filter by namespace.",
	inputSchema: {
		type: "object",
		properties: {
			namespace: { type: "string", description: "Filter by namespace name" },
		},
	},
	async handler(args, { userId }) {
		const nsFilter = typeof args.namespace === "string" ? args.namespace : undefined;
		const fns = await prisma.function.findMany({
			where: {
				namespace: { userId, ...(nsFilter ? { name: nsFilter } : {}) },
			},
			include: { namespace: { select: { name: true } } },
			orderBy: [{ namespace: { name: "asc" } }, { name: "asc" }],
		});
		return json(
			fns.map((fn) => ({
				id: fn.id,
				name: fn.name,
				namespace: fn.namespace.name,
				description: fn.description,
				image: fn.image,
				execution_alias: fn.executionAlias ?? null,
				execution_id: fn.executionId,
				timeout: fn.timeout,
				max_ram: fn.max_ram,
				lastRun: fn.lastRun,
			})),
		);
	},
};

export default tool;
