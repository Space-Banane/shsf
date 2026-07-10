import { prisma } from "../../..";
import { McpToolDef, json } from "./shared";

const tool: McpToolDef = {
	name: "list_namespaces",
	description: "List all namespaces belonging to the authenticated user, with their function count.",
	inputSchema: { type: "object", properties: {} },
	async handler(_args, { userId }) {
		const namespaces = await prisma.namespace.findMany({
			where: { userId },
			include: { _count: { select: { functions: true } } },
			orderBy: { name: "asc" },
		});
		return json(
			namespaces.map((ns) => ({
				id: ns.id,
				name: ns.name,
				functionCount: ns._count.functions,
				createdAt: ns.createdAt,
			})),
		);
	},
};

export default tool;
