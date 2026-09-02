import { describe, expect, it } from "vitest";
import {
	DEPRECATED_MCP_MESSAGE,
	deprecatedMcpTool,
	handleMcpRequest,
} from "../lib/mcp/mcp";

describe("deprecated MCP compatibility endpoint", () => {
	it("advertises only the deprecated tool", () => {
		const response = handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });

		expect(response).toEqual({
			status: 200,
			body: {
				jsonrpc: "2.0",
				id: 1,
				result: { tools: [deprecatedMcpTool] },
			},
		});
	});

	it("returns the CLI migration message without requiring authentication", () => {
		const response = handleMcpRequest({
			jsonrpc: "2.0",
			id: "call-1",
			method: "tools/call",
			params: { name: "deprecated" },
		});

		expect(response.status).toBe(200);
		expect(response.body.result).toEqual({
			content: [{ type: "text", text: DEPRECATED_MCP_MESSAGE }],
		});
	});

	it("rejects removed tool names", () => {
		const response = handleMcpRequest({
			jsonrpc: "2.0",
			id: 2,
			method: "tools/call",
			params: { name: "list_functions" },
		});

		expect(response.body.error).toEqual({ code: -32601, message: "Unknown tool: list_functions" });
	});
});
