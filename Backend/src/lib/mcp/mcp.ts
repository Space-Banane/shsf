export const DEPRECATED_MCP_MESSAGE =
	"The SHSF MCP integration is deprecated. Use the SHSF CLI instead: https://gitea.reversed.dev/shsf/shsf-cli";

export const deprecatedMcpTool = {
	name: "deprecated",
	description: DEPRECATED_MCP_MESSAGE,
	inputSchema: {
		type: "object",
		properties: {},
		additionalProperties: false,
	},
} as const;

type JsonRpcId = string | number | null | undefined;

export type McpRequest = {
	jsonrpc: "2.0";
	id?: JsonRpcId;
	method: string;
	params?: unknown;
};

type McpResponse = {
	jsonrpc: "2.0";
	id: string | number | null;
	result?: unknown;
	error?: { code: number; message: string };
};

function ok(id: JsonRpcId, result: unknown): { status: number; body: McpResponse } {
	return { status: 200, body: { jsonrpc: "2.0", id: id ?? null, result } };
}

function rpcErr(id: JsonRpcId, code: number, message: string): { status: number; body: McpResponse } {
	return { status: 200, body: { jsonrpc: "2.0", id: id ?? null, error: { code, message } } };
}

export function handleMcpRequest(req: McpRequest): { status: number; body: McpResponse } {
	const { id, method, params } = req;

	if (method.startsWith("notifications/") || method === "initialized") {
		return { status: 202, body: { jsonrpc: "2.0", id: null, result: {} } };
	}

	switch (method) {
		case "initialize":
			return ok(id, {
				protocolVersion: "2024-11-05",
				capabilities: { tools: { listChanged: false } },
				serverInfo: { name: "shsf", version: "2.1.0" },
				instructions: DEPRECATED_MCP_MESSAGE,
			});

		case "ping":
			return ok(id, {});

		case "tools/list":
			return ok(id, { tools: [deprecatedMcpTool] });

		case "tools/call": {
			const callParams = params as { name?: unknown } | undefined;
			if (typeof callParams?.name !== "string") {
				return rpcErr(id, -32602, "Invalid params: missing name");
			}

			if (callParams.name !== deprecatedMcpTool.name) {
				return rpcErr(id, -32601, `Unknown tool: ${callParams.name}`);
			}

			return ok(id, { content: [{ type: "text", text: DEPRECATED_MCP_MESSAGE }] });
		}

		default:
			return rpcErr(id, -32601, `Method not found: ${method}`);
	}
}
