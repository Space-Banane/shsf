import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const CustomCorsDocPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Custom CORS">
				SHSF and its own UI are always allowed to call your function. For
				calls from other origins — your frontend, a third-party app — you can
				configure a per-function allowlist of trusted origins. Requests from
				any origin not on the list are blocked by the browser's CORS policy.
			</DocHeader>

			<Callout variant="warning" title="Wildcard * is not supported">
				<p>
					For security reasons, the <code>*</code> wildcard origin is not
					accepted. You must specify exact origins (including scheme and port if
					non-standard).
				</p>
			</Callout>

			<h2>Setting allowed origins</h2>
			<p>
				Open the <strong>Create Function</strong> or{" "}
				<strong>Update Function</strong> modal and find the{" "}
				<strong>CORS Origins</strong> section. Enter each allowed origin on its
				own line or separated by commas.
			</p>
			<CodeCaption>Example origins</CodeCaption>
			<pre>
				<code>{`https://myapp.com
https://admin.myapp.com
http://localhost:3000`}</code>
			</pre>
			<p>
				With this config, only requests from those three origins will include
				the correct CORS headers. All others will be blocked at the browser.
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
					CORS controls browser behaviour — server-to-server calls are not
					affected by CORS headers.
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

			<NextStep href="/docs/guest-users" label="#17 Guest Users">
				Next: create guest user credentials to grant controlled access to
				specific functions without sharing your main account.
			</NextStep>
		</DocsContentShell>
	);
};
