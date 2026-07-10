import { prisma } from "../../..";
import { cleanupFunctionContainer } from "../../Runner";
import { McpToolDef, text, errResult, resolveFunction, FUNCTION_ID_SCHEMA } from "./shared";

const tool: McpToolDef = {
	name: "delete_function",
	description:
		"Delete a function and clean up its container. Identify it by id, execution_alias, or name + namespace.",
	inputSchema: { type: "object", ...FUNCTION_ID_SCHEMA },
	async handler(args, { userId }) {
		const fn = await resolveFunction(args, userId);
		if (!fn) return errResult("Function not found");

		await prisma.function.delete({ where: { id: fn.id } });
		await cleanupFunctionContainer(fn.id);

		return text(`Function "${fn.name}" in namespace "${fn.namespace.name}" deleted.`);
	},
};

export default tool;
