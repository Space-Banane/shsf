import { prisma } from "../../..";
import { McpToolDef, json, errResult, resolveFunction, FUNCTION_ID_SCHEMA } from "./shared";

const tool: McpToolDef = {
	name: "read_file",
	description:
		"Read the full content of a specific file in a function. Identify the function by id, execution_alias, or name + namespace.",
	inputSchema: {
		type: "object",
		...FUNCTION_ID_SCHEMA,
		required: [...(FUNCTION_ID_SCHEMA.oneOf[0].required ?? [])],
		properties: {
			...FUNCTION_ID_SCHEMA.oneOf[0].properties,
			...FUNCTION_ID_SCHEMA.oneOf[1].properties,
			...FUNCTION_ID_SCHEMA.oneOf[2].properties,
			filename: { type: "string", description: "Name of the file to read" },
		},
	},
	async handler(args, { userId }) {
		const filename = args.filename as string | undefined;
		if (!filename) return errResult("filename is required");

		const fn = await resolveFunction(args, userId);
		if (!fn) return errResult("Function not found");

		const file = await prisma.functionFile.findFirst({
			where: { functionId: fn.id, name: filename },
		});

		if (!file) return errResult(`File "${filename}" not found`);

		return json({
			id: file.id,
			name: file.name,
			content: file.content,
			updatedAt: file.updatedAt,
		});
	},
};

export default tool;
