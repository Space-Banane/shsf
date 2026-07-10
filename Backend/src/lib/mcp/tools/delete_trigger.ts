import { prisma } from "../../..";
import { McpToolDef, text, errResult, resolveTrigger } from "./shared";

const tool: McpToolDef = {
	name: "delete_trigger",
	description: "Delete a cron trigger by its database ID.",
	inputSchema: {
		type: "object",
		required: ["id"],
		properties: {
			id: { type: "integer", description: "Database ID of the trigger" },
		},
	},
	async handler(args, { userId }) {
		const id = typeof args.id === "number" ? args.id : undefined;
		if (id === undefined) return errResult("id is required");

		const trigger = await resolveTrigger(id, userId);
		if (!trigger) return errResult("Trigger not found");

		await prisma.functionTrigger.delete({ where: { id: trigger.id } });

		return text(`Trigger "${trigger.name}" deleted from function "${trigger.function.name}".`);
	},
};

export default tool;
