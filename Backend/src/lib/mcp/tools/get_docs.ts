import { AIDOC } from "../../aidoc";
import { McpToolDef, text } from "./shared";

const tool: McpToolDef = {
	name: "get_docs",
	description:
		"Return the SHSF platform reference: entry-point conventions, the args object, custom responses, routing, storage, database communication, dependency files, and the absolute rules. Call this before writing any function code.",
	inputSchema: { type: "object", properties: {} },
	async handler(_args, _ctx) {
		return text(AIDOC);
	},
};

export default tool;
