import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../..";
import { checkAuthentication } from "../../lib/Authentication";
import { OpenAPITags } from "../../lib/openapi";
import { env } from "../../lib/env";
import { AIDOC } from "../../lib/aidoc";

const Images: string[] = [
	"python:3.9",
	"python:3.10",
	"python:3.11",
	"python:3.12",
	"python:3.13",
	"python:3.14",
	"python:3.15",
	"golang:1.20",
	"golang:1.21",
	"golang:1.22",
	"golang:1.23",
	"node:20",
	"node:22",
	"node:24",
];

const DisallowedFiles = ["_runner.py", "_runner.js", "_shsf_runner.js", "init.sh"];

type RuntimeFamily = "python" | "golang" | "javascript" | "html";

interface RuntimeFilePolicy {
	runtime: RuntimeFamily;
	startupFile: string;
	maxFilesKickoff: number;
	maxFilesRevision: number;
	isAllowedFilename: (filename: string) => boolean;
	systemInstruction: string;
	docSection: string;
}

function getRuntimeFamily(image: string, startupFile: string): RuntimeFamily {
	if (startupFile.toLowerCase().endsWith(".html")) {
		return "html";
	}

	if (image.startsWith("golang:")) {
		return "golang";
	}

	if (image.startsWith("node:")) {
		return "javascript";
	}

	return "python";
}

function createRuntimeFilePolicy(image: string, startupFile: string): RuntimeFilePolicy {
	const runtime = getRuntimeFamily(image, startupFile);

	if (runtime === "html") {
		return {
			runtime,
			startupFile,
			maxFilesKickoff: 5,
			maxFilesRevision: 3,
			isAllowedFilename: (filename) => filename.toLowerCase().endsWith(".html"),
			systemInstruction: `Only write root-level HTML files for routed pages. The default page is "${startupFile}", and any additional pages must also be \`.html\` files.`,
			docSection: `- Serve-only HTML functions may write root-level \`.html\` files only.
- The default page is \`${startupFile}\`; routed pages may use additional HTML files such as \`about.html\` or \`docs.html\`.
- Do not create CSS, JS, helper, or dependency files for HTML-only functions.`,
		};
	}

	if (runtime === "golang") {
		return {
			runtime,
			startupFile,
			maxFilesKickoff: 5,
			maxFilesRevision: 3,
			isAllowedFilename: () => true,
			systemInstruction: `Always include the startup file "${startupFile}" and keep every file at the function root. Non-code assets are allowed when the function reads them at runtime.`,
			docSection: `- Go functions may write root-level files only.
- Include the startup Go source file and optional \`go.mod\` / \`go.sum\` files.
- Non-code assets such as templates, JSON fixtures, SQL, or prompt text are allowed when stored at the function root.`,
		};
	}

	if (runtime === "javascript") {
		return {
			runtime,
			startupFile,
			maxFilesKickoff: 5,
			maxFilesRevision: 3,
			isAllowedFilename: () => true,
			systemInstruction: `Always include the startup file "${startupFile}" which must export a \`main\` function via \`module.exports = { main }\`. Keep every file at the function root. Non-code assets are allowed when the function reads them at runtime.`,
			docSection: `- Node.js functions may write root-level files only.
- The startup file must export \`async function main(args)\` via \`module.exports = { main }\`.
- Include an optional \`package.json\` for npm dependencies.
- Non-code assets such as templates, JSON fixtures, or prompt text are allowed when stored at the function root.
- Do not use ES module syntax (\`import\`/\`export\`); use CommonJS (\`require\`/\`module.exports\`).`,
		};
	}

	return {
		runtime: "python",
		startupFile,
		maxFilesKickoff: 5,
		maxFilesRevision: 3,
		isAllowedFilename: () => true,
		systemInstruction: `Always include the startup file "${startupFile}" and keep every file at the function root. Non-code assets are allowed when the function reads them at runtime.`,
		docSection: `- Python functions may write root-level files only.
- Include the startup Python source file and an optional \`requirements.txt\`.
- Non-code assets such as templates, JSON fixtures, SQL, or prompt text are allowed when stored at the function root.`,
	};
}

// ─── SHSF platform knowledge ─────────────────────────────────────────────────
// Imported from lib/aidoc.ts — single source of truth shared with MCP get_docs.

// (removed inline AIDOC block)
// Define the write_file tool spec for OpenRouter
const writeFileTool = {
	type: "function",
	function: {
		name: "write_file",
		description:
			"Write a file with the given filename and complete content. Use this only for runtime-allowed files in the function's file system. Always provide the entire file content — never partial updates.",
		parameters: {
			type: "object",
			properties: {
				filename: {
					type: "string",
					description:
						"The filename to write including extension (e.g. main.py, main_user.go, Program.cs). Must not include any path separators and must match the runtime file policy.",
				},
				content: {
					type: "string",
					description:
						"The complete file content. Always write the full file, never a partial or placeholder.",
				},
			},
			required: ["filename", "content"],
		},
	},
};

export = new fileRouter.Path("/")
	.http("POST", "/api/ai/kickoff/config", (http) =>
		http
			.document({
				description: "Suggest a function name and startup file based on user description and chosen image",
				tags: ["AI", "KICKOFF"] as OpenAPITags[],
				operationId: "aiSuggestKickoffConfig",
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["prompt", "image"],
								properties: {
									prompt: {
										type: "string",
										description: "The user description of the function",
									},
									image: {
										type: "string",
										description: "The Docker image/runtime to use",
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "Suggested configuration",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: {
											type: "object",
											properties: {
												name: { type: "string" },
												description: { type: "string" },
												startup_file: { type: "string" },
											},
										},
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(ctr.cookies.get(COOKIE), ctr.headers.get(API_KEY_HEADER));
				if (!authCheck.success) return ctr.print({ status: 401, message: authCheck.message });

				const [body, error] = await ctr.bindBody((z) =>
					z.object({
						prompt: z.string().min(1),
						image: z.enum(Images as [string, ...string[]]),
					}),
				);

				if (error || !body) return ctr.status(400).print({ status: 400, message: "Invalid request body" });

				const { OpenRouter } = await import("@openrouter/sdk");
				const or = new OpenRouter({
					apiKey: authCheck.user.openRouterKey || env.OPENROUTER_API_KEY,
					httpReferer: "https://github.com/Space-Banane/shsf",
					xTitle: "SHSF - Self-Hostable Serverless Functions",
				});

				const response = await or.chat.send({
					chatGenerationParams: {
						model: "qwen/qwen3-coder-next",
						messages: [
							{
								role: "system",
								content: `You are an AI that helps users configure their serverless functions on the SHSF platform.
Based on the user's description and chosen runtime, suggest:
1. A concise, professional name for the function (alphanumeric, max 128 chars).
2. A clear, helpful description.
3. The most appropriate startup file name (e.g., "main.py" for Python, "main_user.go" for Go, or an empty string for .NET project-based functions).

Return ONLY a JSON object with the following structure:
{
    "name": "string",
    "description": "string",
    "startup_file": "string"
}

Platform Rules:
- Go functions MUST use "main_user.go" as the startup file.
- Python functions should typically use "main.py".
- .NET functions MUST return an empty startup_file string.
- Available runtimes: ${Images.join(", ")}`,
							},
							{
								role: "user",
								content: `User Description: ${body.prompt}\nChosen Runtime: ${body.image}`,
							},
						],
						response_format: { type: "json_object" },
					},
				} as any);

				const content = response.choices[0].message.content;
				if (!content) return ctr.status(500).print({ status: 500, message: "AI failed to respond" });

				try {
					const rawContent = typeof content === "string" ? content : JSON.stringify(content);
					const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
					const config = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
					const fallbackStartupFile = body.image.startsWith("python")
						? "main.py"
						: body.image.startsWith("golang")
							? "main_user.go"
							: "";

					return ctr.print({
						status: "OK",
						data: {
							name: config.name || "My Function",
							description: config.description || body.prompt,
							startup_file: config.startup_file ?? fallbackStartupFile,
						},
					});
				} catch {
					return ctr.status(500).print({ status: 500, message: "AI returned invalid JSON: " + content });
				}
			}),
	)
	.http("POST", "/api/function/{id}/ai/generate", (http) =>
		http
			.document({
				description: "Generate or revise function files using AI code generation",
				tags: ["KICKOFF"] as OpenAPITags[],
				operationId: "aiGenerateFunctionFiles",
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["mode", "prompt"],
								properties: {
									mode: {
										type: "string",
										enum: ["kickoff", "revision"],
										description:
											"Generation mode: 'kickoff' for new, 'revision' for update",
									},
									prompt: {
										type: "string",
										description: "User prompt describing the function or revision",
									},
									files: {
										type: "array",
										items: { type: "string" },
										description: "List of filenames to revise (only for 'revision' mode)",
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "AI generation completed successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										message: { type: "string" },
										data: {
											type: "object",
											properties: {
												writtenFiles: {
													type: "array",
													items: { type: "string" },
												},
												model: { type: "string" },
											},
										},
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);

				if (!authCheck.success) {
					return ctr.print({ status: 401, message: authCheck.message });
				}

				const openRouterKey =
					authCheck.user.openRouterKey || env.OPENROUTER_API_KEY;

				if (!openRouterKey) {
					return ctr.status(ctr.$status.SERVICE_UNAVAILABLE).print({
						status: 503,
						message:
							"AI features are unavailable: add your OpenRouter API key in Account Settings",
					});
				}

				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						mode: z.enum(["kickoff", "revision"]),
						prompt: z.string().min(1).max(4096),
						files: z.array(z.string().min(1).max(256)).max(3).optional(),
					}),
				);

				if (!data) {
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print({ status: 400, message: error.toString() });
				}

				const id = ctr.params.get("id");
				if (!id) {
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print({ status: 400, message: "Missing function id" });
				}

				const functionId = parseInt(id);
				if (isNaN(functionId)) {
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print({ status: 400, message: "Invalid function id" });
				}

				const func = await prisma.function.findFirst({
					where: { id: functionId, userId: authCheck.user.id },
					include: { files: true },
				});

				if (!func) {
					return ctr
						.status(ctr.$status.NOT_FOUND)
						.print({ status: 404, message: "Function not found" });
				}

				const model = "qwen/qwen3-coder-next";

				const { OpenRouter } = await import("@openrouter/sdk");
				const openRouter = new OpenRouter({
					apiKey: openRouterKey,
					httpReferer: "https://github.com/Space-Banane/shsf",
					xTitle: "SHSF - Self-Hostable Serverless Functions",
				});

				const runtimePolicy = createRuntimeFilePolicy(func.image, func.startup_file);
				const maxFiles =
					data.mode === "kickoff" ? runtimePolicy.maxFilesKickoff : runtimePolicy.maxFilesRevision;

				const systemPrompt = `You are an expert code-generation assistant integrated into SHSF (Self-Hostable Serverless Functions).
Your sole job is to write complete, production-ready code files using the write_file tool.

Function context:
  Name: ${func.name}
  Description: ${func.description}
  Runtime image: ${func.image}
  Startup / entry-point file: ${func.startup_file}

Entry-point conventions:
  Python  → def main(args): ...  return result
  Go      → func main_user(args interface{}) (interface{}, error) { ... }

Rules you MUST follow:
1. Use the write_file tool for EVERY file you produce. Do NOT just describe code.
2. ${
		runtimePolicy.systemInstruction
	}
3. You may write at most ${maxFiles} files total.
4. These filenames are FORBIDDEN (never use them): ${DisallowedFiles.join(", ")}.
5. Write the FULL content of each file — no TODOs, no placeholders, no "…existing code…" markers.
6. Filenames must not contain path separators (/ or \\).
7. Only create files allowed by the runtime file policy below.

${AIDOC}

Runtime file policy:
${runtimePolicy.docSection}`;

				const messages: any[] = [{ role: "system", content: systemPrompt }];

				if (data.mode === "revision") {
					// Attach current file contents so the AI has full context
					const filenames = data.files ?? [];
					const disallowedSelectedFiles = filenames.filter(
						(filename) => !runtimePolicy.isAllowedFilename(filename),
					);

					if (disallowedSelectedFiles.length > 0) {
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: 400,
							message: `These files are not allowed for the ${runtimePolicy.runtime} runtime: ${disallowedSelectedFiles.join(", ")}`,
						});
					}

					const existingFiles = func.files.filter((f) => filenames.includes(f.name));

					if (existingFiles.length === 0 && filenames.length > 0) {
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: 400,
							message: "None of the specified files were found for this function",
						});
					}

					const fileContext = existingFiles
						.map(
							(f) => `=== FILE: ${f.name} ===\n${f.content}\n=== END: ${f.name} ===`,
						)
						.join("\n\n");

					messages.push({
						role: "user",
						content: `Revise the following files based on this request:\n\n${data.prompt}\n\nCurrent file contents:\n\n${fileContext}\n\nIMPORTANT: Use write_file and return the COMPLETE revised file — no partials.`,
					});
				} else {
					// KICKOFF — generate from scratch
					messages.push({
						role: "user",
						content: `Create the serverless function as described:\n\n${data.prompt}`,
					});
				}

				// Agentic loop — keep calling OpenRouter until the model stops requesting tools
				const writtenFiles: string[] = [];
				const MAX_ITERATIONS = 20;
				let iterations = 0;

				while (iterations < MAX_ITERATIONS) {
					iterations++;

					const response = await openRouter.chat.send({
						chatGenerationParams: {
							model,
							messages,
							tools: [writeFileTool] as any,
							stream: false,
						},
					} as any);

					const responseMessage = response.choices[0].message;
					// Push the raw assistant message so the model has full context in subsequent turns
					messages.push(responseMessage);

					// Normalise tool_calls vs toolCalls (SDK may differ from raw API)
					const toolCalls: any[] =
						(responseMessage as any).toolCalls ??
						(responseMessage as any).tool_calls ??
						[];

					if (toolCalls.length === 0) {
						// No more tool calls — model is done
						break;
					}

					for (const toolCall of toolCalls) {
						const toolName: string = toolCall.function?.name ?? "";
						const toolArgs: { filename?: string; content?: string } = JSON.parse(
							toolCall.function?.arguments ?? "{}",
						);
						const toolCallId: string = toolCall.id ?? "";

						let toolResult: string;

						if (toolName === "write_file") {
							const { filename, content = "" } = toolArgs;

							if (!filename || filename.length === 0) {
								toolResult = "Error: filename is required";
							} else if (filename.includes("/") || filename.includes("\\")) {
								toolResult = "Error: filename must not contain path separators";
							} else if (!runtimePolicy.isAllowedFilename(filename)) {
								toolResult = `Error: filename "${filename}" is not allowed for the ${runtimePolicy.runtime} runtime`;
							} else if (DisallowedFiles.includes(filename)) {
								toolResult = `Error: filename "${filename}" is reserved and cannot be used`;
							} else if (
								writtenFiles.length >= maxFiles &&
								!writtenFiles.includes(filename)
							) {
								toolResult = `Error: maximum file limit of ${maxFiles} reached`;
							} else {
								try {
									const existing = await prisma.functionFile.findFirst({
										where: { functionId, name: filename },
									});

									if (existing) {
										await prisma.functionFile.update({
											where: { id: existing.id },
											data: { content },
										});
									} else {
										await prisma.functionFile.create({
											data: { name: filename, content, functionId },
										});
									}

									if (!writtenFiles.includes(filename)) {
										writtenFiles.push(filename);
									}

									toolResult = `File "${filename}" written successfully (${content.length} bytes)`;
								} catch (err) {
									toolResult = `Error writing file "${filename}": ${err}`;
								}
							}
						} else {
							toolResult = `Unknown tool: ${toolName}`;
						}

						messages.push({
							role: "tool",
							toolCallId,
							name: toolName || "write_file",
							content: toolResult,
						});
					}
				}

				return ctr.print({
					status: "OK",
					message: `AI generation complete. ${writtenFiles.length} file(s) written.`,
					data: { writtenFiles, model },
				});
			}),
);
