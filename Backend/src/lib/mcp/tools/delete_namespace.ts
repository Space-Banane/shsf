import { prisma } from "../../..";
import { cleanupFunctionContainer } from "../../Runner";
import { McpToolDef, text, errResult } from "./shared";

const tool: McpToolDef = {
	name: "delete_namespace",
	description:
		"Delete a namespace and all its functions. This is irreversible and cleans up all containers.",
	inputSchema: {
		type: "object",
		required: ["id"],
		properties: {
			id: { type: "integer", description: "Namespace ID" },
		},
	},
	async handler(args, { userId }) {
		const id = args.id as number | undefined;
		if (typeof id !== "number") return errResult("id is required");
		const ns = await prisma.namespace.findFirst({ where: { id, userId } });
		if (!ns) return errResult("Namespace not found");

		const fns = await prisma.function.findMany({ where: { namespaceId: id } });
		for (const fn of fns) {
			await cleanupFunctionContainer(fn.id);
		}
		await prisma.namespace.delete({ where: { id }, include: { functions: true } });
		return text(`Namespace "${ns.name}" and ${fns.length} function(s) deleted.`);
	},
};

export default tool;
