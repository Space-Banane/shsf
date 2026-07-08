import { PORT, API_KEY_HEADER, prisma } from "../../..";
import { McpToolDef, errResult } from "./shared";

const tool: McpToolDef = {
	name: "execute_function",
	description:
		"Execute a serverless function by its database ID. An execution alias can optionally be provided as an alternative identifier when the ID is unknown.",
	inputSchema: {
		type: "object",
		required: ["id"],
		properties: {
			id: { type: "integer", description: "Database ID of the function to execute" },
			alias: {
				type: "string",
				description: "Optional execution alias — used as a fallback when id is not available",
			},
			body: {
				type: "object",
				description: "Optional JSON body to pass to the function",
				additionalProperties: true,
			},
			route: { type: "string", description: "Optional sub-route (e.g. 'users/list')" },
		},
	},
	async handler(args, { apiKey, userId }) {
		const id = typeof args.id === "number" ? args.id : undefined;
		const alias = args.alias as string | undefined;

		const routeSuffix = args.route
			? `/${String(args.route).replace(/^\/+/, "")}`
			: "";

		let url: string;

		if (id !== undefined) {
			const fn = await prisma.function.findFirst({
				where: { id, userId },
				select: { executionId: true, namespaceId: true },
			});
			if (!fn) return errResult(`Function with ID ${id} not found`);

			url = `http://127.0.0.1:${PORT}/api/exec/${fn.namespaceId}/${encodeURIComponent(fn.executionId)}${routeSuffix}`;
		} else if (alias) {
			url = `http://127.0.0.1:${PORT}/exec/${encodeURIComponent(alias)}${routeSuffix}`;
		} else {
			return errResult("id is required");
		}

		try {
			const res = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					[API_KEY_HEADER]: apiKey,
				},
				body: JSON.stringify(args.body ?? {}),
			});
			const responseText = await res.text();
			return { content: [{ type: "text", text: responseText }], isError: !res.ok };
		} catch (e) {
			return errResult(`Execution failed: ${e instanceof Error ? e.message : "unknown error"}`);
		}
	},
};

export default tool;
