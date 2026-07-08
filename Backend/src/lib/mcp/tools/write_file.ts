import * as fs from "fs/promises";
import path from "path";
import Docker from "dockerode";
import { prisma } from "../../..";
import { getGitEditBlock } from "../../GitEditGuards";
import { getFunctionAppDir } from "../../StoragePaths";
import { getFunctionExecInfo, replaceApiBaseInContent } from "../../FileHelpers";
import { createLogger } from "../../logger";
import { McpToolDef, json, errResult, resolveFunction, FUNCTION_ID_SCHEMA } from "./shared";

const log = createLogger("mcp:write_file");
const docker = new Docker();

const DISALLOWED_FILES = ["_runner.py", "_runner.js", "init.sh"];

async function isHtmlOnlyFunction(functionId: number): Promise<boolean> {
	const fn = await prisma.function.findUnique({
		where: { id: functionId },
		select: { startup_file: true },
	});
	return (fn?.startup_file ?? "").toLowerCase().endsWith(".html");
}

const tool: McpToolDef = {
	name: "write_file",
	description:
		"Create or update a source file in a function. If the file already exists its content is replaced; otherwise a new file is created. Identify the function by id, execution_alias, or name + namespace.",
	inputSchema: {
		type: "object",
		...FUNCTION_ID_SCHEMA,
		properties: {
			...FUNCTION_ID_SCHEMA.oneOf[0].properties,
			...FUNCTION_ID_SCHEMA.oneOf[1].properties,
			...FUNCTION_ID_SCHEMA.oneOf[2].properties,
			filename: { type: "string", description: "Name of the file (e.g. 'main.py')" },
			content: { type: "string", description: "Full file content" },
		},
	},
	async handler(args, { userId }) {
		const filename = args.filename as string | undefined;
		const content = args.content as string | undefined;

		if (!filename || filename.length < 1 || filename.length > 256)
			return errResult("filename must be 1–256 characters");
		if (content === undefined) return errResult("content is required");
		if (DISALLOWED_FILES.includes(filename))
			return errResult(`File "${filename}" is reserved and cannot be written`);

		const fn = await resolveFunction(args, userId);
		if (!fn) return errResult("Function not found");

		const gitBlock = await getGitEditBlock(fn.id, prisma);
		if (gitBlock) return errResult(gitBlock.message);

		if (filename.toLowerCase().endsWith(".html") === false && await isHtmlOnlyFunction(fn.id))
			return errResult("This function only allows .html files");

		const existing = await prisma.functionFile.findFirst({
			where: { functionId: fn.id, name: filename },
		});

		const out = existing
			? await prisma.functionFile.update({ where: { id: existing.id }, data: { content } })
			: await prisma.functionFile.create({ data: { name: filename, content, functionId: fn.id } });

		// Sync to host filesystem so persistent bind-mount containers see the change
		try {
			const funcInfo = await getFunctionExecInfo(fn.id);
			const funcAppDir = getFunctionAppDir(fn.id);
			await fs.mkdir(funcAppDir, { recursive: true });
			const toWrite = funcInfo
				? replaceApiBaseInContent(content, funcInfo.namespaceId, funcInfo.executionId)
				: content;
			await fs.writeFile(path.join(funcAppDir, filename), toWrite as string, { encoding: "utf-8" });

			if (filename === "requirements.txt" || filename === "package.json") {
				try {
					await docker.getContainer(`shsf_func_${fn.id}`).restart();
				} catch (err) {
					log.warn({ err, functionId: fn.id }, "Container restart after dependency update failed");
				}
			}
		} catch (err) {
			log.error({ err, functionId: fn.id, filename }, "Failed to sync file to host");
		}

		return json({ id: out.id, name: out.name, updatedAt: out.updatedAt });
	},
};

export default tool;
