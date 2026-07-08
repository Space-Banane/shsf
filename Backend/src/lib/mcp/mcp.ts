import { tools, toolMap, ToolContext } from "./tools";

type JsonRpcId = string | number | null | undefined;

function ok(id: JsonRpcId, result: unknown) {
	return { status: 200, body: { jsonrpc: "2.0" as const, id: id ?? null, result } };
}

function rpcErr(id: JsonRpcId, code: number, message: string) {
	return { status: 200, body: { jsonrpc: "2.0" as const, id: id ?? null, error: { code, message } } };
}

export type McpRequest = {
	jsonrpc: "2.0";
	id?: JsonRpcId;
	method: string;
	params?: unknown;
};

export async function handleMcpRequest(
	req: McpRequest,
	ctx: ToolContext,
): Promise<{ status: number; body: unknown }> {
	const { id, method, params } = req;

	// Notifications — acknowledge with no body
	if (method.startsWith("notifications/") || method === "initialized") {
		return { status: 202, body: {} };
	}

	switch (method) {
		case "initialize":
			return ok(id, {
				protocolVersion: "2024-11-05",
				capabilities: { tools: { listChanged: false } },
				serverInfo: { name: "shsf", version: "1.0.0" },
				instructions:
					"Call get_docs first to learn SHSF platform conventions before writing any function code. Use list_namespaces and list_functions to explore the instance, then create/update/delete as needed. Use list_files/read_file/write_file to manage function source files. execute_function runs any function by its database ID.",
			});

		case "ping":
			return ok(id, {});

		case "tools/list":
			return ok(id, {
				tools: tools.map(({ name, description, inputSchema }) => ({
					name,
					description,
					inputSchema,
				})),
			});

		case "tools/call": {
			const p = params as { name?: string; arguments?: Record<string, unknown> } | undefined;
			const toolName = p?.name;
			const args = (p?.arguments ?? {}) as Record<string, unknown>;

			if (!toolName) return rpcErr(id, -32602, "Invalid params: missing name");

			const tool = toolMap.get(toolName);
			if (!tool) return rpcErr(id, -32601, `Unknown tool: ${toolName}`);

			const result = await tool.handler(args, ctx);
			return ok(id, result);
		}

		default:
			return rpcErr(id, -32601, `Method not found: ${method}`);
	}
}
