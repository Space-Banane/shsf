import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader } from "./_components";

export const CustomCorsDocPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Custom CORS">
				SHSF and its own UI are always allowed to call your function. For
				calls from other origins — your frontend, a third-party app — you can
				configure a per-function allowlist of trusted origins. The server
				rejects requests from any other origin with a <code>403</code>.
			</DocHeader>

			<Callout variant="warning" title="Use exact origins, not *">
				<p>
					SHSF compares the request's <code>Origin</code> header with each entry
					as an exact string. A <code>*</code> entry can be saved but never
					matches anything. Write the full origin, including the scheme and any
					non-standard port.
				</p>
			</Callout>

			<Callout variant="note" title="Only the function URL uses the allowlist">
				<p>
					The allowlist applies to the function URL shown on the function page,{" "}
					<code>/api/exec/&lt;namespace-id&gt;/&lt;execution-id&gt;</code>. Browser
					calls to <code>/exec/&lt;alias&gt;</code> only accept origins in the
					instance's <code>CORS_URLS</code>.
				</p>
			</Callout>

			<h2>Setting allowed origins</h2>
			<p>
				Open the <strong>Create Function</strong> or{" "}
				<strong>Update Function</strong> modal and find the{" "}
				<strong>CORS Origins</strong> field. Type one origin and click{" "}
				<strong>Add</strong> (or press Enter). Repeat for each origin.
			</p>
			<CodeCaption>Example origins</CodeCaption>
			<pre>
				<code>{`https://myapp.com
https://admin.myapp.com
http://localhost:3000`}</code>
			</pre>
			<p>
				With this config, browser requests from those three origins are
				allowed. Requests from any other origin get a <code>403</code> response
				with the message <em>SERVER CORS Policy: This origin is not allowed access</em>.
			</p>

			<h2>You can also use the CLI</h2>
			<CodeCaption>shsf-cli</CodeCaption>
			<pre>
				<code>{`# Add an origin
shsf cors add https://myapp.com --id func_42a7c1

# List current origins
shsf cors list --id func_42a7c1`}</code>
			</pre>

			<h2>How CORS works in SHSF</h2>
			<ul>
				<li>
					SHSF sets the <code>Access-Control-Allow-Origin</code> response header
					to the matched origin from the allowlist.
				</li>
				<li>
					SHSF and the configured <code>CORS_URLS</code> instance variable are
					always allowed regardless of per-function settings.
				</li>
				<li>
					If no origins are configured for a function, only SHSF itself and the
					instance CORS URLs are permitted.
				</li>
				<li>
					The check only runs when a request has an <code>Origin</code>{" "}
					header. Server-to-server calls without one are not affected.
				</li>
			</ul>

			<h2>Development tip</h2>
			<Callout variant="tip" title="Add localhost during development, remove before production">
				<p>
					It's fine to temporarily add <code>http://localhost:3000</code> (or
					your local dev port) to the allowlist while building. Remove it before
					making the function production-facing so your endpoint isn't
					accidentally callable from any local origin.
				</p>
			</Callout>

		</DocsContentShell>
	);
};
