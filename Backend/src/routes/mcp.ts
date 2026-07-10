import { API_KEY_HEADER, fileRouter } from "..";
import { checkAuthentication } from "../lib/Authentication";
import { handleMcpRequest, McpRequest } from "../lib/mcp/mcp";
import { tools } from "../lib/mcp/tools";

export = new fileRouter.Path("/")
	.http("GET", "/mcp", (http) =>
		http
			.ratelimit((limit) => limit.hits(20).window(60000).penalty(2000))
			.onRequest(async (ctr) => {
				return ctr.print({
					name: "shsf",
					version: "1.0.0",
					description: "SHSF MCP Server — connect AI agents to your serverless functions",
					transport: "streamable-http",
					tools: tools.map(({ name, description }) => ({ name, description })),
				});
			}),
	)
	.http("POST", "/mcp", (http) =>
		http
			.ratelimit((limit) => limit.hits(60).window(60000).penalty(5000))
			.onRequest(async (ctr) => {
				const apiKey = ctr.headers.get(API_KEY_HEADER);
				if (!apiKey) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						jsonrpc: "2.0",
						id: null,
						error: { code: -32001, message: "Authentication required: provide x-access-key header" },
					});
				}

				const auth = await checkAuthentication(null, apiKey);
				if (!auth.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						jsonrpc: "2.0",
						id: null,
						error: { code: -32001, message: auth.message },
					});
				}

				const [body, bindErr] = await ctr.bindBody((z) =>
					z.object({
						jsonrpc: z.literal("2.0"),
						id: z.union([z.string(), z.number(), z.null()]).optional(),
						method: z.string(),
						params: z.any().optional(),
					}),
				);

				if (!body) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						jsonrpc: "2.0",
						id: null,
						error: { code: -32700, message: `Parse error: ${bindErr}` },
					});
				}

				const { status, body: responseBody } = await handleMcpRequest(
					body as McpRequest,
					{ userId: auth.user.id, apiKey },
				);

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				return ctr.status(status).print(responseBody as any);
			}),
	);
