import { prisma } from "../../..";
import { validateCronExpression } from "../../Cron";
import { McpToolDef, json, errResult, resolveFunction, FUNCTION_ID_SCHEMA } from "./shared";

const tool: McpToolDef = {
	name: "create_trigger",
	description:
		"Create a scheduled cron trigger for a function. Identify the function by id, execution_alias, or name + namespace.",
	inputSchema: {
		type: "object",
		...FUNCTION_ID_SCHEMA,
		properties: {
			...FUNCTION_ID_SCHEMA.oneOf[0].properties,
			...FUNCTION_ID_SCHEMA.oneOf[1].properties,
			...FUNCTION_ID_SCHEMA.oneOf[2].properties,
			name: { type: "string", description: "Trigger name (1–128 chars)" },
			description: { type: "string", description: "Trigger description (max 256 chars)" },
			cron: { type: "string", description: "Cron expression for scheduling (e.g. '*/5 * * * *')" },
			data: {
				type: "string",
				description: "Optional JSON-stringified payload passed to the function on each run",
			},
			enabled: { type: "boolean", description: "Whether the trigger is enabled (default true)" },
		},
	},
	async handler(args, { userId }) {
		const name = args.name as string | undefined;
		const cron = args.cron as string | undefined;
		const description = (args.description as string | undefined) ?? "";
		const data = args.data as string | undefined;
		const enabled = typeof args.enabled === "boolean" ? args.enabled : undefined;

		if (!name || name.length < 1 || name.length > 128)
			return errResult("name must be 1–128 characters");
		if (description.length > 256) return errResult("description must be at most 256 characters");
		if (!cron) return errResult("cron is required");
		if (!(await validateCronExpression(cron)))
			return errResult(`Invalid cron expression: "${cron}"`);

		const fn = await resolveFunction(args, userId);
		if (!fn) return errResult("Function not found");

		const trigger = await prisma.functionTrigger.create({
			data: {
				functionId: fn.id,
				name,
				description,
				cron,
				data,
				...(enabled !== undefined ? { enabled } : {}),
			},
		});

		return json({
			id: trigger.id,
			name: trigger.name,
			cron: trigger.cron,
			enabled: trigger.enabled,
			functionId: fn.id,
		});
	},
};

export default tool;
