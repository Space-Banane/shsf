import { prisma } from "../../..";
import { executeFunction } from "../../Runner";
import { createLogger } from "../../logger";
import { McpToolDef, json, errResult, resolveTrigger } from "./shared";

const log = createLogger("mcp:run_trigger_now");

const tool: McpToolDef = {
	name: "run_trigger_now",
	description:
		"Immediately execute a cron trigger's function once, regardless of its schedule or enabled state.",
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

		const func = await prisma.function.findUnique({
			where: { id: trigger.functionId },
			include: { files: true },
		});
		if (!func) return errResult("Function not found");

		let triggerDataPayload: Record<string, unknown> = {};
		if (trigger.data) {
			try {
				triggerDataPayload = JSON.parse(trigger.data as string);
			} catch {
				triggerDataPayload = { data: trigger.data };
			}
		}

		const payload = JSON.stringify({
			ran_by: "trigger",
			triggerId: trigger.id,
			...triggerDataPayload,
		});

		const runStartedAt = new Date();
		let result: Awaited<ReturnType<typeof executeFunction>> | null = null;

		try {
			result = await executeFunction(func.id, func, func.files, { enabled: false }, payload, {});
		} catch (error) {
			log.error({ err: error, funcId: func.id }, "executeFunction failed for trigger");
			return errResult("Failed to execute function");
		}

		try {
			await prisma.functionTrigger.update({
				where: { id: trigger.id },
				data: { lastRun: runStartedAt, lastRunSuccessful: result?.exit_code === 0 },
			});
		} catch (updateError) {
			log.error({ err: updateError, triggerId: trigger.id }, "Failed to persist run metadata for trigger");
		}

		return json({
			result: result?.result,
			exit_code: result?.exit_code,
			logs: result?.logs,
		});
	},
};

export default tool;
