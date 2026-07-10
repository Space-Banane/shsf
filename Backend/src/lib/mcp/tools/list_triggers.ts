import { prisma } from "../../..";
import { McpToolDef, json, errResult, resolveFunction, FUNCTION_ID_SCHEMA } from "./shared";

const tool: McpToolDef = {
	name: "list_triggers",
	description:
		"List cron triggers. If a function is identified (by id, execution_alias, or name + namespace), only that function's triggers are returned; otherwise all triggers across the user's functions are returned.",
	inputSchema: {
		type: "object",
		properties: {
			...FUNCTION_ID_SCHEMA.oneOf[0].properties,
			...FUNCTION_ID_SCHEMA.oneOf[1].properties,
			...FUNCTION_ID_SCHEMA.oneOf[2].properties,
		},
	},
	async handler(args, { userId }) {
		const hasFunctionIdentifier =
			args.id !== undefined ||
			args.execution_alias !== undefined ||
			(args.name !== undefined && args.namespace !== undefined);

		let functionId: number | undefined;
		if (hasFunctionIdentifier) {
			const fn = await resolveFunction(args, userId);
			if (!fn) return errResult("Function not found");
			functionId = fn.id;
		}

		const triggers = await prisma.functionTrigger.findMany({
			where: {
				function: { userId, ...(functionId !== undefined ? { id: functionId } : {}) },
			},
			include: { function: { select: { name: true, namespace: { select: { name: true } } } } },
			orderBy: { id: "asc" },
		});

		return json(
			triggers.map((t) => ({
				id: t.id,
				name: t.name,
				description: t.description,
				cron: t.cron,
				data: t.data,
				enabled: t.enabled,
				functionId: t.functionId,
				function: t.function.name,
				namespace: t.function.namespace.name,
				nextRun: t.nextRun,
				lastRun: t.lastRun,
				lastRunSuccessful: t.lastRunSuccessful,
			})),
		);
	},
};

export default tool;
