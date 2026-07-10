import { prisma } from "../../..";
import { validateCronExpression } from "../../Cron";
import { McpToolDef, json, errResult, resolveTrigger } from "./shared";

const tool: McpToolDef = {
	name: "update_trigger",
	description:
		"Update an existing cron trigger's name, description, cron expression, data, or enabled state. Only provided fields are changed.",
	inputSchema: {
		type: "object",
		required: ["id"],
		properties: {
			id: { type: "integer", description: "Database ID of the trigger" },
			name: { type: "string", description: "New trigger name (1–128 chars)" },
			description: { type: "string", description: "New description (max 256 chars)" },
			cron: { type: "string", description: "New cron expression" },
			data: { type: "string", description: "New JSON-stringified payload passed to the function on each run" },
			enabled: { type: "boolean", description: "Enable or disable the trigger" },
		},
	},
	async handler(args, { userId }) {
		const id = typeof args.id === "number" ? args.id : undefined;
		if (id === undefined) return errResult("id is required");

		const trigger = await resolveTrigger(id, userId);
		if (!trigger) return errResult("Trigger not found");

		const name = args.name as string | undefined;
		const description = args.description as string | undefined;
		const cron = args.cron as string | undefined;
		const data = args.data as string | undefined;
		const enabled = typeof args.enabled === "boolean" ? args.enabled : undefined;

		if (name !== undefined && (name.length < 1 || name.length > 128))
			return errResult("name must be 1–128 characters");
		if (description !== undefined && description.length > 256)
			return errResult("description must be at most 256 characters");
		if (cron !== undefined && !(await validateCronExpression(cron)))
			return errResult(`Invalid cron expression: "${cron}"`);

		const updated = await prisma.functionTrigger.update({
			where: { id: trigger.id },
			data: {
				...(name !== undefined && { name }),
				...(description !== undefined && { description }),
				...(cron !== undefined && { cron, nextRun: null }),
				...(data !== undefined && { data }),
				...(enabled !== undefined && { enabled }),
			},
		});

		return json({
			id: updated.id,
			name: updated.name,
			description: updated.description,
			cron: updated.cron,
			data: updated.data,
			enabled: updated.enabled,
			nextRun: updated.nextRun,
		});
	},
};

export default tool;
