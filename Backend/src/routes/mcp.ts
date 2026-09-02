import { fileRouter } from "..";
import {
	DEPRECATED_MCP_MESSAGE,
	deprecatedMcpTool,
	handleMcpRequest,
	McpRequest,
} from "../lib/mcp/mcp";

export = new fileRouter.Path("/")
	.http("GET", "/mcp", (http) =>
		http
			.ratelimit((limit) => limit.hits(20).window(60000).penalty(2000))
			.onRequest(async (ctr) => {
				return ctr.print({
					name: "shsf",
					version: "2.1.0",
					description: DEPRECATED_MCP_MESSAGE,
					transport: "streamable-http",
					tools: [deprecatedMcpTool],
				});
			}),
	)
	.http("POST", "/mcp", (http) =>
		http
			.ratelimit((limit) => limit.hits(60).window(60000).penalty(5000))
			.onRequest(async (ctr) => {
				const [body, bindErr] = await ctr.bindBody((z) =>
					z.object({
						jsonrpc: z.literal("2.0"),
						id: z.union([z.string(), z.number(), z.null()]).optional(),
						method: z.string(),
						params: z.unknown().optional(),
					}),
				);

				if (!body) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						jsonrpc: "2.0",
						id: null,
						error: { code: -32700, message: `Parse error: ${bindErr}` },
					});
				}

				const { status, body: responseBody } = handleMcpRequest(body as McpRequest);
				return ctr.status(status).print(responseBody);
			}),
	);
