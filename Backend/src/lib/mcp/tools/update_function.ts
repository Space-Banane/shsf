import { prisma } from "../../..";
import { McpToolDef, json, errResult, resolveFunction, FUNCTION_ID_SCHEMA } from "./shared";

const tool: McpToolDef = {
	name: "update_function",
	description:
		"Update properties of an existing function (name, description, timeout, ram, alias, allow_http). Identify it by id, execution_alias, or name + namespace.",
	inputSchema: {
		type: "object",
		...FUNCTION_ID_SCHEMA,
		properties: {
			...FUNCTION_ID_SCHEMA.oneOf[0].properties,
			...FUNCTION_ID_SCHEMA.oneOf[1].properties,
			...FUNCTION_ID_SCHEMA.oneOf[2].properties,
			new_name: { type: "string", description: "New function name" },
			description: { type: "string", description: "New description" },
			timeout: { type: "integer", description: "Timeout in seconds (1–300)" },
			max_ram: { type: "integer", description: "Max RAM in MB (128–1024)" },
			allow_http: { type: "boolean", description: "Allow outbound HTTP" },
			execution_alias: {
				type: ["string", "null"],
				description: "New execution alias, or null to remove it",
			},
		},
	},
	async handler(args, { userId }) {
		const fn = await resolveFunction(args, userId);
		if (!fn) return errResult("Function not found");

		const newName = args.new_name as string | undefined;
		const description = args.description as string | undefined;
		const timeout = typeof args.timeout === "number" ? args.timeout : undefined;
		const maxRam = typeof args.max_ram === "number" ? args.max_ram : undefined;
		const allowHttp = typeof args.allow_http === "boolean" ? args.allow_http : undefined;
		const aliasArg = "execution_alias" in args ? args.execution_alias : undefined;

		if (newName !== undefined && (newName.length < 1 || newName.length > 128))
			return errResult("new_name must be 1–128 characters");
		if (description !== undefined && (description.length < 3 || description.length > 128))
			return errResult("description must be 3–128 characters");
		if (timeout !== undefined && (timeout < 1 || timeout > 300))
			return errResult("timeout must be 1–300");
		if (maxRam !== undefined && (maxRam < 128 || maxRam > 1024))
			return errResult("max_ram must be 128–1024");

		const newAlias = aliasArg === null ? null : (aliasArg as string | undefined);
		if (typeof newAlias === "string") {
			const conflict = await prisma.function.findFirst({
				where: { executionAlias: newAlias, NOT: { id: fn.id } },
			});
			if (conflict) return errResult(`Execution alias "${newAlias}" is already in use`);
		}

		const updated = await prisma.function.update({
			where: { id: fn.id },
			data: {
				...(newName !== undefined && { name: newName }),
				...(description !== undefined && { description }),
				...(timeout !== undefined && { timeout }),
				...(maxRam !== undefined && { max_ram: maxRam }),
				...(allowHttp !== undefined && { allow_http: allowHttp }),
				...(aliasArg !== undefined && { executionAlias: newAlias }),
			},
			include: { namespace: { select: { name: true } } },
		});

		return json({
			id: updated.id,
			name: updated.name,
			namespace: updated.namespace.name,
			execution_alias: updated.executionAlias,
		});
	},
};

export default tool;
