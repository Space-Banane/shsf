import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const DataPassingPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Data Passing">
				Every function receives a single <code>args</code> object that contains
				everything about the incoming request — body, query parameters, headers,
				the matched route segment, the HTTP method, and the raw body bytes.
			</DocHeader>

			<h2>The args object</h2>
			<p>
				SHSF builds the payload before calling your function. The shape differs
				slightly between GET and POST requests:
			</p>

			<CodeCaption>GET request — args fields</CodeCaption>
			<pre>
				<code>{`{
  "headers":   { "user-agent": "...", ... },   // all request headers (lowercase keys)
  "queries":   { "page": "2", ... },           // URL query parameters
  "route":     "default",                       // path segment after the function URL (or "default")
  "method":    "GET",
  "source_ip": "1.2.3.4"
}`}</code>
			</pre>

			<CodeCaption>POST request — adds body and raw_body</CodeCaption>
			<pre>
				<code>{`{
  "headers":   { "content-type": "application/json", ... },
  "queries":   { ... },
  "route":     "default",
  "method":    "POST",
  "source_ip": "1.2.3.4",
  "body":      "{ \\"name\\": \\"Alice\\" }",    // UTF-8 decoded request body string
  "raw_body":  "<binary string>"               // raw bytes as a binary (Latin-1) string
}`}</code>
			</pre>

			<Callout variant="warning" title="body is always a string">
				<p>
					<code>args["body"]</code> is the raw UTF-8 text of the request body —
					SHSF does not parse it for you. Call <code>json.loads(args["body"])</code>{" "}
					(Python) or <code>json.Unmarshal</code> (Go) to get a dict/map.
				</p>
			</Callout>

			<h2>Reading body data (Python)</h2>
			<CodeCaption>Example (Python)</CodeCaption>
			<pre>
				<code>{`import json

def main(args):
    raw = args.get("body", "{}")
    data = json.loads(raw)          # parse JSON string → dict
    name = data.get("name", "world")
    return {"_shsf": "v2", "_code": 200, "_res": {"greeting": f"Hello, {name}!"}}`}</code>
			</pre>

			<h2>Reading query parameters</h2>
			<CodeCaption>Example (Python)</CodeCaption>
			<pre>
				<code>{`def main(args):
    queries = args.get("queries", {})
    page   = int(queries.get("page", "1"))
    limit  = int(queries.get("limit", "20"))
    return {"page": page, "limit": limit}`}</code>
			</pre>

			<h2>Reading headers</h2>
			<CodeCaption>Example (Python)</CodeCaption>
			<pre>
				<code>{`def main(args):
    headers = args.get("headers", {})
    content_type = headers.get("content-type", "")
    auth_token   = headers.get("authorization", "")
    return {"content_type": content_type}`}</code>
			</pre>

			<h2>Routing via args.route</h2>
			<p>
				The path segment after the function URL becomes <code>args["route"]</code>.
				When no segment is present the value is <code>"default"</code>.
			</p>
			<CodeCaption>URL examples</CodeCaption>
			<pre>
				<code>{`GET /exec/my-func           → route = "default"
GET /exec/my-func/users     → route = "users"
GET /exec/my-func/health    → route = "health"`}</code>
			</pre>
			<CodeCaption>Dispatching on route (Python)</CodeCaption>
			<pre>
				<code>{`def main(args):
    route = args.get("route", "default")

    if route == "users":
        return get_users(args)
    elif route == "health":
        return {"ok": True}
    else:
        return {"_shsf": "v2", "_code": 404, "_res": {"error": "not found"}}`}</code>
			</pre>
			<Callout variant="note" title="Single-segment only">
				<p>
					Only one path segment after the function URL is supported. Deep paths
					like <code>/exec/func/a/b</code> are not routed — only the first
					segment (<code>a</code>) is captured. See the Routing page for more.
				</p>
			</Callout>

			<h2>Passing data from a cron trigger</h2>
			<p>
				When a trigger fires it calls your function with a POST-style payload.
				Any JSON you enter in the trigger's <em>Body</em> field becomes
				the <code>body</code> string in <code>args</code>.
			</p>
			<CodeCaption>Trigger payload (set in trigger config)</CodeCaption>
			<pre>
				<code>{`{ "event": "weekly-report", "send_to": "team@example.com" }`}</code>
			</pre>
			<CodeCaption>Reading it in your function</CodeCaption>
			<pre>
				<code>{`import json

def main(args):
    data = json.loads(args.get("body", "{}"))
    event = data.get("event")
    print(f"Triggered by: {event}")`}</code>
			</pre>

			<NextStep href="/docs/custom-responses" label="#3 Custom Responses">
				Now you know how data flows in. Next up: controlling what flows back
				out — custom HTTP status codes, headers, and response bodies.
			</NextStep>
		</DocsContentShell>
	);
};
