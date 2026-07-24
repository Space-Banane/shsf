/**
 * SHSF platform reference injected into AI generation prompts and exposed
 * via the MCP get_docs tool. Keep this as the single source of truth.
 */
export const AIDOC = `
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
| route      | string        | Sub-path after the function URL (no leading slash). Default: "default" |
| headers    | dict / map    | Incoming HTTP request headers (lowercased keys)              |
| raw_body   | bytes/string  | Raw request body bytes (for file uploads, binary data)       |
| method     | string        | HTTP method (GET, POST, PUT, PATCH, DELETE, QUERY, …)        |

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

The _db_com.py helper is auto-provisioned by SHSF. Do not add \`requests\` only for this helper; storage communication uses SHSF's internal execution transport.

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

### 8. Routing

args["route"] contains the URL sub-path after the function base URL (no leading slash).
Default when no sub-path is given: "default".

Arbitrary depth routes are fully supported — e.g. \`.../exec/<alias>/users/profile\` or
\`.../exec/<alias>/api/v1/items\`. The \`route\` field will contain the full sub-path joined
with slashes (e.g. "users/profile", "api/v1/items").

\`\`\`python
def main(args):
    route = args.get("route", "default")
    if route == "register":
        return handle_register(args)
    elif route == "login":
        return handle_login(args)
    elif route == "users/profile":
        return handle_user_profile(args)
    elif route == "status":
        return {"status": "ok"}
    else:
        return {"_shsf": "v2", "_code": 404, "_res": {"error": "route not found"}}
\`\`\`

All HTTP methods are supported: GET, POST, PUT, PATCH, DELETE, QUERY. The method is
available in args["method"] so a single function can behave as a REST API:

\`\`\`python
import json

def main(args):
    method = args.get("method", "GET")
    route  = args.get("route", "default")
    body   = json.loads(args.get("body", "{}"))

    if route == "items":
        if method == "GET":
            return {"items": []}
        if method == "POST":
            return {"created": body.get("name")}
        return {"_shsf": "v2", "_code": 405, "_res": {"error": "method not allowed"}}

    return {"_shsf": "v2", "_code": 404, "_res": {"error": "not found"}}
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

- When the image is set to python, don't create go files, and vice versa
- Only create files allowed by the runtime file policy appended below.
- If no packages are needed, don't create a requirements.txt or go.mod file — these are optional and only needed if you have dependencies.
- FORBIDDEN filenames: _runner.py, _runner.js, init.sh  (reserved by the SHSF runtime)
- Filenames must NEVER contain / or \\\\ (no subdirectories)
- Never write partial files or placeholder comments like "# ... rest of code"
- Never hard-code secrets — always use environment variables (§5)
- Go entry-point is main_user(), never main()
- Never invent SHSF-specific APIs that are not documented in this reference
- **Always \`import json\` and call \`json.loads(args.get("body", "{}"))\` in Python before accessing body fields**
`;
