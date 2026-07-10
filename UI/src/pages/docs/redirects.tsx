import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const RedirectsPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Redirects">
				Return a SHSF v2 envelope with a <code>_location</code> field and a{" "}
				<code>301</code> or <code>302</code> status code to issue an HTTP
				redirect. SHSF handles the rest — no extra headers to set manually.
			</DocHeader>

			<Callout variant="note" title="301 vs 302">
				<p>
					Use <strong>302 (temporary)</strong> for most cases — login flows,
					form submissions, short-link lookups. Use <strong>301 (permanent)</strong>{" "}
					only when the URL has changed forever and you want browsers and search
					engines to update their cache.
				</p>
			</Callout>

			<h2>Basic redirect</h2>
			<CodeCaption>Python — temporary redirect (302)</CodeCaption>
			<pre>
				<code>{`def main(args):
    return {
        "_shsf":     "v2",
        "_code":     302,
        "_location": "https://example.com/dashboard"
    }`}</code>
			</pre>

			<CodeCaption>Go — permanent redirect (301)</CodeCaption>
			<pre>
				<code>{`func main_user(args interface{}) (interface{}, error) {
    return map[string]interface{}{
        "_shsf":     "v2",
        "_code":     301,
        "_location": "https://example.com/new-page",
    }, nil
}`}</code>
			</pre>

			<h2>Conditional redirect</h2>
			<CodeCaption>Python — redirect on login success</CodeCaption>
			<pre>
				<code>{`import json

def main(args):
    data = json.loads(args.get("body", "{}"))
    username = data.get("username", "")
    password = data.get("password", "")

    if check_credentials(username, password):
        return {"_shsf": "v2", "_code": 302, "_location": "/dashboard"}
    else:
        return {"_shsf": "v2", "_code": 302, "_location": "/login?error=1"}

def check_credentials(u, p):
    # your auth logic here
    return u == "admin" and p == "secret"`}</code>
			</pre>

			<h2>Short-link pattern</h2>
			<CodeCaption>Python — look up a code and redirect</CodeCaption>
			<pre>
				<code>{`from _db_com import database

db = database()

def main(args):
    code = args.get("route", "")
    if not code or code == "default":
        return {"_shsf": "v2", "_code": 400, "_res": {"error": "no code"}}

    target = db.get("links", code)
    if not target:
        return {"_shsf": "v2", "_code": 404, "_res": {"error": "not found"}}

    return {"_shsf": "v2", "_code": 302, "_location": target}`}</code>
			</pre>

			<h2>Rules</h2>
			<ul>
				<li>
					<code>_code</code> must be <code>301</code> or <code>302</code>. Any
					other code with <code>_location</code> present will not trigger a
					redirect.
				</li>
				<li>
					<code>_location</code> must be a valid URL string; if it is missing or
					not a string, no redirect occurs.
				</li>
				<li>
					Other envelope fields (<code>_res</code>, <code>_headers</code>) are
					ignored when a redirect fires.
				</li>
			</ul>

			<NextStep href="/docs/raw-body" label="#8 Raw Body Handling">
				Next: how to handle binary request bodies — file uploads, audio, and
				custom data formats via <code>args.raw_body</code>.
			</NextStep>
		</DocsContentShell>
	);
};
