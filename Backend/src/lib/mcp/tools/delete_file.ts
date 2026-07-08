import * as fs from "fs/promises";
import path from "path";
import { prisma } from "../../..";
import { getGitEditBlock } from "../../GitEditGuards";
import { getFunctionAppDir } from "../../StoragePaths";
import { createLogger } from "../../logger";
import { McpToolDef, text, errResult, resolveFunction, FUNCTION_ID_SCHEMA } from "./shared";

const log = createLogger("mcp:delete_file");

const tool: McpToolDef = {
	name: "delete_file",
	description:
		"Delete a source file from a function by name. The function must have more than one file. Identify the function by id, execution_alias, or name + namespace.",
	inputSchema: {
		type: "object",
		...FUNCTION_ID_SCHEMA,
		properties: {
			...FUNCTION_ID_SCHEMA.oneOf[0].properties,
			...FUNCTION_ID_SCHEMA.oneOf[1].properties,
			...FUNCTION_ID_SCHEMA.oneOf[2].properties,
			filename: { type: "string", description: "Name of the file to delete" },
		},
	},
	async handler(args, { userId }) {
		const filename = args.filename as string | undefined;
		if (!filename) return errResult("filename is required");

		const fn = await resolveFunction(args, userId);
		if (!fn) return errResult("Function not found");

		const gitBlock = await getGitEditBlock(fn.id, prisma);
		if (gitBlock) return errResult(gitBlock.message);

		const totalFiles = await prisma.functionFile.count({ where: { functionId: fn.id } });
		if (totalFiles <= 1) return errResult("Cannot delete the only file in a function");

		const file = await prisma.functionFile.findFirst({
			where: { functionId: fn.id, name: filename },
		});
		if (!file) return errResult(`File "${filename}" not found`);

		await prisma.functionFile.delete({ where: { id: file.id } });

		// Remove from disk; for dependency files leave an empty placeholder
		const funcAppDir = getFunctionAppDir(fn.id);
		try {
			await fs.unlink(path.join(funcAppDir, filename));
		} catch (err) {
			log.warn({ err, functionId: fn.id, filename }, "Failed to delete file from disk");
		}

		const placeholder =
			filename === "package.json" ? '{\n  "dependencies": {}\n}\n'
			: filename === "requirements.txt" ? "requests\n"
			: null;

		if (placeholder !== null) {
			try {
				await fs.writeFile(path.join(funcAppDir, filename), placeholder);
			} catch (err) {
				log.warn({ err, functionId: fn.id, filename }, "Failed to write placeholder after delete");
			}
		}

		return text(`File "${filename}" deleted from function "${fn.name}".`);
	},
};

export default tool;
