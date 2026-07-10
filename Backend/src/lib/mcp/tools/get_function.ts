import { McpToolDef, json, errResult, resolveFunction, FUNCTION_ID_SCHEMA } from "./shared";

const tool: McpToolDef = {
	name: "get_function",
	description:
		"Get detailed information about a specific function. Identify it by id, execution_alias, or name + namespace.",
	inputSchema: { type: "object", ...FUNCTION_ID_SCHEMA },
	async handler(args, { userId }) {
		const fn = await resolveFunction(args, userId);
		if (!fn) return errResult("Function not found");
		return json({
			id: fn.id,
			name: fn.name,
			namespace: fn.namespace.name,
			description: fn.description,
			image: fn.image,
			startup_file: fn.startup_file,
			execution_alias: fn.executionAlias ?? null,
			execution_id: fn.executionId,
			timeout: fn.timeout,
			max_ram: fn.max_ram,
			allow_http: fn.allow_http,
			retry_on_failure: fn.retry_on_failure,
			cache_enabled: fn.cache_enabled,
			cache_ttl: fn.cache_ttl,
			tags: fn.tags ? fn.tags.split(",").filter(Boolean) : [],
			lastRun: fn.lastRun,
			createdAt: fn.createdAt,
		});
	},
};

export default tool;
