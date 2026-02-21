import { OpenRouter } from "@openrouter/sdk";
import { env } from "process";
import {
	API_KEY_HEADER,
	COOKIE,
	fileRouter,
	prisma,
} from "../..";
import { checkAuthentication } from "../../lib/Authentication";

const DisallowedFiles = ["_runner.py", "_runner.js", "init.sh"];

// ─── SHSF platform knowledge injected into every generation prompt ───────────
const AIDOC = `
## SHSF Platform Reference — read this carefully before writing any code

---

### 1. Entry-point conventions

Every function MUST expose a single entry-point that the SHSF runtime calls.

**Python** (file extension: .py)
\`\`\`python
def main(args):
    # args is a dict injected by the runtime (see §2)
    return {"hello": "world"}  # plain dict → 200 JSON response
\`\`\`

**Go** (file extension: .go, package must be \`main\`)
\`\`\`go
package main

func main_user(args interface{}) (interface{}, error) {
    return map[string]string{"hello": "world"}, nil
}
\`\`\`
• Go functions MUST use \`main_user\`, NOT \`main\`, as the user entry-point.
• Dependencies go in a \`go.mod\` file (auto-downloaded by the runtime).
• Supported Go versions: 1.20 / 1.21 / 1.22 / 1.23

---

### 2. The \`args\` object

The runtime injects these fields. Always use .get() / nil-checks — never assume a field is present.

| Field      | Type          | Description                                                  |
|------------|---------------|--------------------------------------------------------------|
| body       | string        | Raw JSON string of the HTTP POST body — MUST be parsed with json.loads() before use |
| queries    | dict / map    | URL query parameters (?key=value)                            |
| route      | string        | Sub-path after the function URL (no slashes). Default: "default" |
| headers    | dict / map    | Incoming HTTP request headers (lowercased keys)              |
| raw_body   | bytes/string  | Raw request body bytes (for file uploads, binary data)       |
| method     | string        | HTTP method (GET, POST, …)                                   |

> ⚠️ **Important**: \`body\` is a raw JSON **string** — you MUST call \`json.loads(body)\` before accessing fields.
> Skipping this step will cause \`AttributeError\` / \`TypeError\` at runtime.

Python example:
\`\`\`python
import json

def main(args):
    body    = args.get("body", "{}")
    body    = json.loads(body)          # ← required: parse the JSON string first
    queries = args.get("queries", {})
    route   = args.get("route", "default")
    name    = body.get("name", "stranger")
    page    = queries.get("page", "1")
    return {"greeting": f"Hello {name}", "page": page, "route": route}
\`\`\`

Go example:
\`\`\`go
package main

func main_user(args interface{}) (interface{}, error) {
    payload, _ := args.(map[string]interface{})
    body, _    := payload["body"].(map[string]interface{})
    name, _    := body["name"].(string)
    if name == "" { name = "stranger" }
    return map[string]string{"greeting": "Hello, " + name + "!"}, nil
}
\`\`\`

---

### 3. Custom responses (SHSF v2 protocol)

Return a plain dict/map for a simple 200 JSON response.
Return the v2 envelope to control status code, headers, and body:

\`\`\`python
def main(args):
    # Success with custom status and headers
    return {
        "_shsf": "v2",
        "_code": 201,
        "_headers": {"X-My-Header": "value", "Content-Type": "application/json"},
        "_res": {"created": True, "id": 42}
    }
\`\`\`

\`\`\`python
def main(args):
    # Error response
    return {
        "_shsf": "v2",
        "_code": 400,
        "_res": {"error": "missing required field 'name'"}
    }
\`\`\`

v2 envelope fields:
- _shsf (required): must be "v2"
- _code (int): HTTP status code to return
- _res (any): response body (string, dict, …)
- _headers (dict): extra response headers to send
- _location (string): redirect URL — only valid when _code is 301 or 302

Go equivalent:
\`\`\`go
package main

func main_user(args interface{}) (interface{}, error) {
    return map[string]interface{}{
        "_shsf":    "v2",
        "_code":    201,
        "_headers": map[string]string{"Content-Type": "application/json"},
        "_res":     map[string]interface{}{"created": true},
    }, nil
}
\`\`\`

---

### 4. Redirects

Set _code to 301 (permanent) or 302 (temporary) AND supply _location:

\`\`\`python
def main(args):
    return {
        "_shsf": "v2",
        "_code": 302,
        "_location": "https://example.com/target"
    }
\`\`\`

---

### 5. Environment variables

Define them in the SHSF dashboard — NEVER hard-code secrets in source files.

\`\`\`python
import os

def main(args):
    api_key = os.getenv("MY_API_KEY", "")
    if not api_key:
        return {"_shsf": "v2", "_code": 500, "_res": {"error": "MY_API_KEY not set"}}
    # use api_key …
    return {"ok": True}
\`\`\`

Go:
\`\`\`go
import "os"
apiKey := os.Getenv("MY_API_KEY")
\`\`\`

---

### 6. Persistent storage

Filesystem (recommended for caching / local state):
- /app/  — files persist between invocations. Use for cached data, state files, etc.
- /tmp/  — ephemeral; wiped between container restarts. Use for truly temporary work.

\`\`\`python
import json, os

CACHE = "/app/cache.json"

def main(args):
    if os.path.exists(CACHE):
        with open(CACHE, "r") as f:
            data = json.load(f)
    else:
        data = {}

    data["hits"] = data.get("hits", 0) + 1

    with open(CACHE, "w") as f:
        json.dump(data, f)

    return {"hits": data["hits"]}
\`\`\`

Redis (for fast key-value storage shared across invocations):
\`\`\`python
import redis

r = redis.Redis(host="localhost", port=6379, db=0)

def main(args):
    r.incr("counter")
    return {"counter": int(r.get("counter"))}
\`\`\`

---

### 7. SHSF Database Communication (_db_com) — Python

The _db_com.py helper is auto-provisioned. Add \`requests\` to requirements.txt.

\`\`\`python
from _db_com import database

db = database()

def main(args):
    # Create a storage bucket (idempotent — safe to call every invocation)
    db.create_storage("my_app", purpose="application data")

    # Write a value
    db.set("my_app", "username", "alice")

    # Write with TTL
    from datetime import datetime, timedelta
    expires = (datetime.utcnow() + timedelta(hours=1)).isoformat()
    db.set("my_app", "session", "tok_abc", expires_at=expires)

    # Read (returns None if missing)
    username = db.get("my_app", "username")

    # Existence check
    if db.exists("my_app", "username"):
        pass  # user found

    # List all keys in a storage
    items = db.list_items("my_app")

    # Delete a key
    db.delete_item("my_app", "username")

    return {"username": username, "items": items}
\`\`\`

Go dbcom equivalent:
\`\`\`go
package main

import "myfunction/dbcom"

func main_user(args interface{}) (interface{}, error) {
    db := dbcom.New()
    if _, err := db.Set("my-storage", "key", "value", nil); err != nil {
        return nil, err
    }
    value, err := db.Get("my-storage", "key")
    if err != nil {
        return nil, err
    }
    return map[string]interface{}{"value": value}, nil
}
\`\`\`

---

### 8. Routing (single sub-path segment)

args["route"] contains the URL segment after the function base URL (no leading slash).
Default when no sub-path is given: "default".
Only ONE segment is supported (e.g. .../exec/<id>/register — NOT .../exec/<id>/a/b).

\`\`\`python
def main(args):
    route = args.get("route", "default")
    if route == "register":
        return handle_register(args)
    elif route == "login":
        return handle_login(args)
    elif route == "status":
        return {"status": "ok"}
    else:
        return {"_shsf": "v2", "_code": 404, "_res": {"error": "route not found"}}
\`\`\`

---

### 9. Serving HTML (user interfaces)

Return HTML content as a string with Content-Type text/html:

\`\`\`python
def main(args):
    with open("index.html", "r") as f:
        html = f.read()
    return {
        "_shsf": "v2",
        "_code": 200,
        "_headers": {"Content-Type": "text/html"},
        "_res": html
    }
\`\`\`

For a fully static page: have exactly ONE .html file set as the startup file and zero
other files. SHSF auto-detects this "Serve Only HTML" mode and serves the file directly
without spinning up Python/Go.

---

### 10. Raw body / file uploads

\`\`\`python
def main(args):
    raw = args.get("raw_body")
    if raw is None:
        return {"_shsf": "v2", "_code": 400, "_res": {"error": "no body provided"}}
    if isinstance(raw, str):
        raw = raw.encode("latin-1")  # convert to bytes when needed
    with open("/app/upload.bin", "wb") as f:
        f.write(raw)
    return {"_shsf": "v2", "_code": 200, "_res": {"saved": True}}
\`\`\`

---

### 11. Secure headers (x-secure-header)

When a function has the secure-header feature enabled, SHSF validates the
x-secure-header request header before invoking the function — you do NOT need
to re-validate it in your code. You can read it for logging purposes:

\`\`\`python
def main(args):
    headers = args.get("headers", {})
    token = headers.get("x-secure-header", "")
    # at this point the platform has already rejected invalid tokens
    return {"authenticated": True, "token_preview": token[:4] + "…"}
\`\`\`

---

### 12. Dependency files

| Runtime | File            | How it works                              |
|---------|-----------------|-------------------------------------------|
| Python  | requirements.txt | pip-installed before first run            |
| Go      | go.mod + go.sum | module dependencies, auto-downloaded      |

Python requirements.txt example:
\`\`\`
requests==2.31.0
beautifulsoup4==4.12.2
pillow>=10.0.0
\`\`\`

Go go.mod example:
\`\`\`
module myfunction

go 1.23

require (
    github.com/google/uuid v1.3.0
)
\`\`\`

---

### 13. Absolute rules — violations will cause the function to fail

- FORBIDDEN filenames: _runner.py, _runner.js, init.sh  (reserved by the SHSF runtime)
- Filenames must NEVER contain / or \\\\ (no subdirectories)
- Never write partial files or placeholder comments like "# ... rest of code"
- Never hard-code secrets — always use environment variables (§5)
- Go entry-point is main_user(), never main()
- Never invent SHSF-specific APIs that are not documented in this reference
- **Always \`import json\` and call \`json.loads(args.get("body", "{}"))\` in Python before accessing body fields**
`;
// ─────────────────────────────────────────────────────────────────────────────

// Define the write_file tool spec for OpenRouter
const writeFileTool = {
	type: "function",
	function: {
		name: "write_file",
		description:
			"Write a file with the given filename and complete content. Use this to create or fully overwrite a file in the function's file system. Always provide the entire file content — never partial updates.",
		parameters: {
			type: "object",
			properties: {
				filename: {
					type: "string",
					description:
						"The filename to write including extension (e.g. main.py, utils.js). Must not include any path separators.",
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

export = new fileRouter.Path("/").http(
	"POST",
	"/api/function/{id}/ai/generate",
	(http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);

			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}

			// Resolve OpenRouter key: user key takes priority, then server env var
			const openRouterKey =
				(authCheck.success && authCheck.user.openRouterKey) || env.OPENROUTER_KEY;

			if (!openRouterKey) {
				return ctr.status(ctr.$status.SERVICE_UNAVAILABLE).print({
					status: 503,
					message:
						"AI features are unavailable: configure an OpenRouter API key in your account settings or ask the server admin to set OPENROUTER_KEY",
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

			const openRouter = new OpenRouter({
				apiKey: openRouterKey,
				httpReferer: "https://github.com/Space-Banane/shsf",
				xTitle: "SHSF - Self-Hostable Serverless Functions",
			});

			const maxFiles = data.mode === "kickoff" ? 5 : 3;

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
2. Always include the startup file "${func.startup_file}".
3. You may write at most ${maxFiles} files total.
4. These filenames are FORBIDDEN (never use them): ${DisallowedFiles.join(", ")}.
5. Write the FULL content of each file — no TODOs, no placeholders, no "…existing code…" markers.
6. Filenames must not contain path separators (/ or \\).

${AIDOC}`;

			const messages: any[] = [{ role: "system", content: systemPrompt }];

			if (data.mode === "revision") {
				// Attach current file contents so the AI has full context
				const filenames = data.files ?? [];
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
