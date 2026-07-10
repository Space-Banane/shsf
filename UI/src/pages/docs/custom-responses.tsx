import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const CustomResponsesPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Custom Responses">
				By default SHSF serialises your function's return value as JSON with a
				200 status. The <strong>SHSF v2 response envelope</strong> lets you
				take full control: set any HTTP status code, add custom headers, send
				raw strings or HTML, or issue redirects.
			</DocHeader>

			<h2>The v2 envelope</h2>
			<p>
				Return a dict/map with <code>_shsf: "v2"</code> and SHSF will process
				it instead of serialising the object directly.
			</p>

			<CodeCaption>Full envelope — all fields</CodeCaption>
			<pre>
				<code>{`{
  "_shsf":     "v2",                          // required — activates the envelope
  "_code":     200,                            // HTTP status code (default: 200)
  "_res":      { ... } | "string",            // response body — any JSON value or a string
  "_headers":  { "Content-Type": "text/html" }, // extra response headers (optional)
  "_location": "https://example.com"          // redirect target — requires _code 301/302
}`}</code>
			</pre>

			<h2>Returning a JSON body with a status code</h2>
			<CodeCaption>Example (Python)</CodeCaption>
			<pre>
				<code>{`def main(args):
    return {
        "_shsf": "v2",
        "_code": 201,
        "_res": {"id": 42, "created": True}
    }`}</code>
			</pre>

			<h2>Error responses</h2>
			<CodeCaption>Example (Python)</CodeCaption>
			<pre>
				<code>{`def main(args):
    import json
    data = json.loads(args.get("body", "{}"))
    if "name" not in data:
        return {
            "_shsf": "v2",
            "_code": 400,
            "_res": {"error": "missing required field: name"}
        }
    return {"_shsf": "v2", "_code": 200, "_res": {"ok": True}}`}</code>
			</pre>

			<h2>Custom headers</h2>
			<CodeCaption>Example — setting Content-Type and a custom header</CodeCaption>
			<pre>
				<code>{`def main(args):
    return {
        "_shsf": "v2",
        "_code": 200,
        "_headers": {
            "Content-Type": "text/plain",
            "X-Powered-By": "SHSF"
        },
        "_res": "Hello, plain text!"
    }`}</code>
			</pre>

			<h2>Serving HTML</h2>
			<p>
				Set <code>Content-Type: text/html</code> and return the HTML string in{" "}
				<code>_res</code>. The browser will render it as a web page.
			</p>
			<CodeCaption>Example (Python)</CodeCaption>
			<pre>
				<code>{`def main(args):
    with open("index.html", "r") as f:
        html = f.read()
    return {
        "_shsf": "v2",
        "_code": 200,
        "_headers": {"Content-Type": "text/html"},
        "_res": html
    }`}</code>
			</pre>

			<h2>Returning binary data</h2>
			<p>
				Python functions can return <code>bytes</code> or <code>bytearray</code>{" "}
				inside <code>_res</code>. SHSF transports the raw bytes back to the
				caller automatically.
			</p>
			<CodeCaption>Example — returning image bytes</CodeCaption>
			<pre>
				<code>{`def main(args):
    with open("/app/output.png", "rb") as f:
        data = f.read()
    return {
        "_shsf": "v2",
        "_code": 200,
        "_headers": {"Content-Type": "image/png"},
        "_res": data          # bytes — SHSF handles encoding transparently
    }`}</code>
			</pre>

			<h2>Redirects</h2>
			<p>
				Set <code>_code</code> to <code>301</code> (permanent) or{" "}
				<code>302</code> (temporary) and add <code>_location</code> to issue an
				HTTP redirect. See the{" "}
				<a href="/docs/redirects" className="text-blue-400 hover:text-blue-300">
					Redirects
				</a>{" "}
				page for full details.
			</p>
			<CodeCaption>Example (Python)</CodeCaption>
			<pre>
				<code>{`def main(args):
    return {"_shsf": "v2", "_code": 302, "_location": "https://example.com"}`}</code>
			</pre>

			<Callout variant="note" title="Without the envelope">
				<p>
					If you return a plain dict/value (no <code>_shsf</code> key), SHSF
					serialises it as JSON with a 200 status and{" "}
					<code>Content-Type: application/json</code>. The envelope is only
					needed when you want to change status, headers, or response type.
				</p>
			</Callout>

			<NextStep href="/docs/environment-variables" label="#4 Environment Variables">
				Your function can now shape its response. Next: store secrets and
				configuration outside your code using environment variables.
			</NextStep>
		</DocsContentShell>
	);
};
