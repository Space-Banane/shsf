import { prisma } from "../../..";
import { listGitAppFiles } from "../../GitOps";
import { McpToolDef, json, errResult, resolveFunction, FUNCTION_ID_SCHEMA } from "./shared";

const tool: McpToolDef = {
	name: "list_files",
	description:
		"List all source files in a serverless function. Returns filename, id, size, and last-modified date. Identify the function by id, execution_alias, or name + namespace.",
	inputSchema: { type: "object", ...FUNCTION_ID_SCHEMA },
	async handler(args, { userId }) {
		const fn = await resolveFunction(args, userId);
		if (!fn) return errResult("Function not found");

		if (fn.git_url?.trim()) {
			const files = await listGitAppFiles(fn.id);
			return json(files);
		}

		const files = await prisma.functionFile.findMany({
			where: { functionId: fn.id },
			orderBy: { name: "asc" },
		});

		return json(
			files.map((f) => ({
				id: f.id,
				name: f.name,
				size: f.content.length,
				updatedAt: f.updatedAt,
			})),
		);
	},
};

export default tool;
