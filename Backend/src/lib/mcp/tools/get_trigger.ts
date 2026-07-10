import { McpToolDef, json, errResult, resolveTrigger } from "./shared";

const tool: McpToolDef = {
	name: "get_trigger",
	description: "Get details of a single cron trigger by its database ID.",
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

		return json({
			id: trigger.id,
			name: trigger.name,
			description: trigger.description,
			cron: trigger.cron,
			data: trigger.data,
			enabled: trigger.enabled,
			functionId: trigger.functionId,
			function: trigger.function.name,
			namespace: trigger.function.namespace.name,
			nextRun: trigger.nextRun,
			lastRun: trigger.lastRun,
			lastRunSuccessful: trigger.lastRunSuccessful,
			createdAt: trigger.createdAt,
			updatedAt: trigger.updatedAt,
		});
	},
};

export default tool;
