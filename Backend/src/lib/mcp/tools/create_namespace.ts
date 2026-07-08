import { prisma } from "../../..";
import { McpToolDef, json, errResult } from "./shared";

const tool: McpToolDef = {
	name: "create_namespace",
	description: "Create a new namespace for the authenticated user.",
	inputSchema: {
		type: "object",
		required: ["name"],
		properties: {
			name: { type: "string", description: "Namespace name (1–128 chars)" },
		},
	},
	async handler(args, { userId }) {
		const name = args.name as string | undefined;
		if (!name || name.length < 1 || name.length > 128) {
			return errResult("name must be 1–128 characters");
		}
		const existing = await prisma.namespace.findFirst({ where: { name, userId } });
		if (existing) return errResult(`Namespace "${name}" already exists`);
		const ns = await prisma.namespace.create({ data: { name, userId } });
		return json({ id: ns.id, name: ns.name, createdAt: ns.createdAt });
	},
};

export default tool;
