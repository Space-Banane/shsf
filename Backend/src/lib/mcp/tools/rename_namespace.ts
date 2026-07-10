import { prisma } from "../../..";
import { McpToolDef, json, errResult } from "./shared";

const tool: McpToolDef = {
	name: "rename_namespace",
	description: "Rename an existing namespace.",
	inputSchema: {
		type: "object",
		required: ["id", "new_name"],
		properties: {
			id: { type: "integer", description: "Namespace ID" },
			new_name: { type: "string", description: "New namespace name (1–128 chars)" },
		},
	},
	async handler(args, { userId }) {
		const id = args.id as number | undefined;
		const newName = args.new_name as string | undefined;
		if (typeof id !== "number") return errResult("id is required");
		if (!newName || newName.length < 1 || newName.length > 128) {
			return errResult("new_name must be 1–128 characters");
		}
		const ns = await prisma.namespace.findFirst({ where: { id, userId } });
		if (!ns) return errResult("Namespace not found");
		const conflict = await prisma.namespace.findFirst({ where: { name: newName, userId } });
		if (conflict) return errResult(`Namespace "${newName}" already exists`);
		const updated = await prisma.namespace.update({
			where: { id },
			data: { name: newName },
		});
		return json({ id: updated.id, name: updated.name });
	},
};

export default tool;
