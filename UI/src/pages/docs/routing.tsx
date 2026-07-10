import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const RoutingDocPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Routing">
				A single SHSF function can serve multiple logical endpoints by reading
				the <code>route</code> argument from <code>args</code>. The route is
				the full path after the function URL — no framework, no config file
				needed.
			</DocHeader>

			<Callout variant="info" title="Deep paths are fully supported">
				<p>
					Everything after the function URL is captured as the route, including
					nested segments. <code>/exec/func/a/b/c</code> gives{" "}
					<code>route = "a/b/c"</code>. When no segment is present the value is{" "}
					<code>"default"</code>. Leading and trailing slashes are stripped; the
					value never contains a leading slash.
				</p>
			</Callout>

			<h2>How routing works</h2>
			<CodeCaption>URL → route value</CodeCaption>
			<pre>
				<code>{`GET    /exec/my-func               → route = "default"
GET    /exec/my-func/users         → route = "users"
POST   /exec/my-func/register      → route = "register"
GET    /exec/my-func/health        → route = "health"
GET    /exec/my-func/users/42      → route = "users/42"
DELETE /exec/my-func/items/7/tag   → route = "items/7/tag"`}</code>
			</pre>

			<h2>Dispatching routes (Python)</h2>
			<CodeCaption>Python — simple dispatcher</CodeCaption>
			<pre>
				<code>{`def main(args):
    route = args.get("route", "default")

    if route == "register":
        return handle_register(args)
    elif route == "login":
        return handle_login(args)
    elif route == "health":
        return {"ok": True}
    else:
        return {"_shsf": "v2", "_code": 404, "_res": {"error": "not found"}}

def handle_register(args):
    # registration logic
    return {"_shsf": "v2", "_code": 201, "_res": {"registered": True}}

def handle_login(args):
    # login logic
    return {"_shsf": "v2", "_code": 200, "_res": {"token": "..."}}`}</code>
			</pre>

			<h2>Deep path routing (Python)</h2>
			<p>
				Split <code>route</code> on <code>"/"</code> to handle nested paths like{" "}
				<code>/exec/func/users/42</code>:
			</p>
			<CodeCaption>Python — deep path dispatcher</CodeCaption>
			<pre>
				<code>{`def main(args):
    parts = args.get("route", "default").split("/")
    resource = parts[0]           # e.g. "users"
    resource_id = parts[1] if len(parts) > 1 else None  # e.g. "42"

    if resource == "users":
        if resource_id:
            return get_user(resource_id)
        return list_users()
    elif resource == "health":
        return {"ok": True}
    else:
        return {"_shsf": "v2", "_code": 404, "_res": {"error": "not found"}}`}</code>
			</pre>

			<h2>Dispatching routes (Go)</h2>
			<CodeCaption>Go — type-assert args and switch on route</CodeCaption>
			<pre>
				<code>{`package main

import "fmt"

func main_user(args interface{}) (interface{}, error) {
    payload, _ := args.(map[string]interface{})
    route, _ := payload["route"].(string)
    if route == "" { route = "default" }

    switch route {
    case "users":
        return getUsers(payload)
    case "health":
        return map[string]bool{"ok": true}, nil
    default:
        return map[string]interface{}{
            "_shsf": "v2", "_code": 404,
            "_res": fmt.Sprintf("unknown route: %s", route),
        }, nil
    }
}`}</code>
			</pre>

			<h2>Combining routes with HTTP methods</h2>
			<p>
				Use <code>args["method"]</code> together with the route to build
				REST-style endpoints:
			</p>
			<CodeCaption>Python — RESTful handler</CodeCaption>
			<pre>
				<code>{`import json

def main(args):
    route  = args.get("route", "default")
    method = args.get("method", "GET")

    if route == "items":
        if method == "GET":
            return list_items()
        elif method == "POST":
            data = json.loads(args.get("body", "{}"))
            return create_item(data)
        else:
            return {"_shsf": "v2", "_code": 405, "_res": {"error": "method not allowed"}}

    return {"_shsf": "v2", "_code": 404, "_res": {"error": "not found"}}`}</code>
			</pre>

			<h2>Best practices</h2>
			<ul>
				<li>
					Use lowercase route names — e.g. <code>users</code>,{" "}
					<code>register</code>, <code>health</code>.
				</li>
				<li>
					Always provide a default/fallback case and return a <code>404</code>{" "}
					rather than crashing.
				</li>
				<li>
					Keep each route handler in its own function for readability as the
					number of routes grows.
				</li>
				<li>
					Document the available routes so callers know what to expect — consider
					returning them from the <code>default</code> route.
				</li>
			</ul>

			<NextStep href="/docs/custom-cors" label="#16 Custom CORS">
				Next: control which origins can call your function — useful when
				building browser-based apps.
			</NextStep>
		</DocsContentShell>
	);
};
