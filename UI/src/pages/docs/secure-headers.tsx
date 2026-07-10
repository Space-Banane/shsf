import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const SecureHeadersPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Secure Headers (x-secure-header)">
				When the <strong>Secure Header</strong> setting is enabled on a
				function, every HTTP request must include the correct{" "}
				<code>x-secure-header</code> value or it is rejected before your code
				ever runs. Requests made by the function owner from the SHSF UI are
				always permitted.
			</DocHeader>

			<h2>How it works</h2>
			<p>
				Enable <strong>Secure Header</strong> in the Create or Update Function
				modal and set your chosen secret value. SHSF validates the header on
				every incoming HTTP request. Requests missing or with a wrong value
				receive a <code>403</code> before the function container is even
				contacted.
			</p>
			<Callout variant="warning" title="Platform-enforced, not code-enforced">
				<p>
					You do not need to validate the header in your function code — SHSF
					handles it. However, you can still read the header inside your function
					for logging or double-checking purposes.
				</p>
			</Callout>

			<h2>Sending the header from clients</h2>
			<CodeCaption>curl</CodeCaption>
			<pre>
				<code>{`curl -H "x-secure-header: YOUR_SECRET" https://your-shsf-instance/exec/my-function`}</code>
			</pre>

			<CodeCaption>fetch (browser / Node.js)</CodeCaption>
			<pre>
				<code>{`fetch("https://your-shsf-instance/exec/my-function", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-secure-header": "YOUR_SECRET"
  },
  body: JSON.stringify({ hello: "world" })
})`}</code>
			</pre>

			<CodeCaption>Python requests</CodeCaption>
			<pre>
				<code>{`import requests

resp = requests.post(
    "https://your-shsf-instance/exec/my-function",
    headers={"x-secure-header": "YOUR_SECRET"},
    json={"hello": "world"}
)`}</code>
			</pre>

			<h2>Reading the header inside your function</h2>
			<p>
				The header is available via <code>args["headers"]</code> (lowercase
				keys) if you need to inspect it for logging:
			</p>
			<CodeCaption>Python — inspecting the header value</CodeCaption>
			<pre>
				<code>{`def main(args):
    headers = args.get("headers", {})
    token = headers.get("x-secure-header", "")
    # Note: SHSF already validated this before calling your function.
    # This read is only useful for logging.
    return {"_shsf": "v2", "_code": 200, "_res": {"ok": True}}`}</code>
			</pre>

			<h2>Using an access token instead</h2>
			<p>
				An SHSF <a href="/docs/access-tokens" className="text-blue-400 hover:text-blue-300">Access Token</a>{" "}
				passed via the <code>x-access-key</code> header also satisfies the
				secure-header check — useful for scripts and automation.
			</p>

			<h2>Notes</h2>
			<ul>
				<li>
					Store the header secret in an{" "}
					<a href="/docs/environment-variables" className="text-blue-400 hover:text-blue-300">
						environment variable
					</a>{" "}
					on the client side — never hardcode it in public-facing source files.
				</li>
				<li>
					The header value is compared exactly (case-sensitive). Trailing
					whitespace will cause failures.
				</li>
				<li>
					Changing the value takes effect immediately; update any clients that
					use the old value.
				</li>
			</ul>

			<NextStep href="/docs/persistent-data" label="#6 Persistent Data">
				Endpoint is secured. Next: how to read and write data that persists
				between function invocations.
			</NextStep>
		</DocsContentShell>
	);
};
