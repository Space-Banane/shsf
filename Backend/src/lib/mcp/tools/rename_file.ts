import * as fs from "fs/promises";
import path from "path";
import { prisma } from "../../..";
import { getGitEditBlock } from "../../GitEditGuards";
import { getFunctionAppDir } from "../../StoragePaths";
import { getFunctionExecInfo, replaceApiBaseInContent } from "../../FileHelpers";
import { createLogger } from "../../logger";
import { McpToolDef, json, errResult, resolveFunction, FUNCTION_ID_SCHEMA } from "./shared";

const log = createLogger("mcp:rename_file");

async function isHtmlOnlyFunction(functionId: number): Promise<boolean> {
	const fn = await prisma.function.findUnique({
		where: { id: functionId },
		select: { startup_file: true },
	});
	return (fn?.startup_file ?? "").toLowerCase().endsWith(".html");
}

const tool: McpToolDef = {
	name: "rename_file",
	description:
		"Rename a source file in a function. Identify the function by id, execution_alias, or name + namespace.",
	inputSchema: {
		type: "object",
		...FUNCTION_ID_SCHEMA,
		properties: {
			...FUNCTION_ID_SCHEMA.oneOf[0].properties,
			...FUNCTION_ID_SCHEMA.oneOf[1].properties,
			...FUNCTION_ID_SCHEMA.oneOf[2].properties,
			filename: { type: "string", description: "Current filename" },
			new_filename: { type: "string", description: "New filename (1–256 chars)" },
		},
	},
	async handler(args, { userId }) {
		const filename = args.filename as string | undefined;
		const newFilename = args.new_filename as string | undefined;

		if (!filename) return errResult("filename is required");
		if (!newFilename || newFilename.length < 1 || newFilename.length > 256)
			return errResult("new_filename must be 1–256 characters");

		const fn = await resolveFunction(args, userId);
		if (!fn) return errResult("Function not found");

		const gitBlock = await getGitEditBlock(fn.id, prisma);
		if (gitBlock) return errResult(gitBlock.message);

		if (!newFilename.toLowerCase().endsWith(".html") && await isHtmlOnlyFunction(fn.id))
			return errResult("This function only allows .html files");

		const file = await prisma.functionFile.findFirst({
			where: { functionId: fn.id, name: filename },
		});
		if (!file) return errResult(`File "${filename}" not found`);

		const conflict = await prisma.functionFile.findFirst({
			where: { functionId: fn.id, name: newFilename },
		});
		if (conflict) return errResult(`A file named "${newFilename}" already exists`);

		const updated = await prisma.functionFile.update({
			where: { id: file.id },
			data: { name: newFilename },
		});

		// Keep disk in sync for dependency file renames
		const isDepFile = (n: string) => n === "requirements.txt" || n === "package.json";
		if (isDepFile(filename) || isDepFile(newFilename)) {
			const funcAppDir = getFunctionAppDir(fn.id);
			try {
				if (isDepFile(filename)) {
					await fs.writeFile(path.join(funcAppDir, filename), "# File was renamed\n");
				}
				if (isDepFile(newFilename)) {
					const funcInfo = await getFunctionExecInfo(fn.id);
					const toWrite = funcInfo
						? replaceApiBaseInContent(updated.content, funcInfo.namespaceId, funcInfo.executionId)
						: updated.content;
					await fs.writeFile(path.join(funcAppDir, newFilename), toWrite as string, { encoding: "utf-8" });
				}
			} catch (err) {
				log.warn({ err, functionId: fn.id, filename, newFilename }, "Failed to sync file rename to disk");
			}
		}

		return json({ id: updated.id, name: updated.name, updatedAt: updated.updatedAt });
	},
};

export default tool;
