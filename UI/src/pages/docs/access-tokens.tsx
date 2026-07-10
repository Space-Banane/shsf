import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const AccessTokensDocPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Access Tokens">
				Access Tokens let you authenticate API requests and automate SHSF
				operations without using your account password. Each token is a
				long-lived secret tied to your account and can be scoped with a
				name and optional expiry date.
			</DocHeader>

			<Callout variant="danger" title="Tokens are shown only once">
				<p>
					Copy your token immediately after creating it. SHSF stores only a
					hashed version — the plaintext is never shown again. If you lose it,
					revoke it and generate a new one.
				</p>
			</Callout>

			<h2>Generating a token</h2>
			<ol>
				<li>
					Go to <strong>Account &gt; Access Tokens</strong>.
				</li>
				<li>
					Click <strong>Generate New Token</strong>.
				</li>
				<li>
					Enter a name, an optional purpose, and choose an expiry (or never
					expires).
				</li>
				<li>
					Click <strong>Generate Token</strong> and copy the value shown.
				</li>
			</ol>

			<h2>Using a token in requests</h2>
			<p>
				Pass the token in the <code>x-access-key</code> header on any API
				request:
			</p>
			<CodeCaption>curl</CodeCaption>
			<pre>
				<code>{`curl -H "x-access-key: YOUR_TOKEN" https://your-shsf-instance/api/functions`}</code>
			</pre>

			<CodeCaption>Python requests</CodeCaption>
			<pre>
				<code>{`import requests

headers = {"x-access-key": "YOUR_TOKEN"}
resp = requests.get("https://your-shsf-instance/api/functions", headers=headers)
print(resp.json())`}</code>
			</pre>

			<CodeCaption>Node.js fetch</CodeCaption>
			<pre>
				<code>{`const resp = await fetch("https://your-shsf-instance/api/functions", {
  headers: { "x-access-key": "YOUR_TOKEN" }
});
const data = await resp.json();`}</code>
			</pre>

			<h2>Bypassing secure headers</h2>
			<p>
				If a function has the <strong>Secure Header</strong> setting enabled,
				providing a valid <code>x-access-key</code> from the function's owner
				automatically satisfies the secure-header check — no need to also send
				the <code>x-secure-header</code> value.
			</p>
			<CodeCaption>curl — invoking a secure function with a token</CodeCaption>
			<pre>
				<code>{`curl -H "x-access-key: YOUR_TOKEN" https://your-shsf-instance/exec/my-secure-function`}</code>
			</pre>
			<Callout variant="warning" title="Token must belong to the function owner">
				<p>
					Access Token bypass of secure headers only works when the token was
					created by the same account that owns the function.
				</p>
			</Callout>

			<h2>Managing tokens</h2>
			<ul>
				<li>
					<strong>View</strong> — all tokens are listed on the Access Tokens page
					(values are masked).
				</li>
				<li>
					<strong>Edit</strong> — update the name or purpose at any time.
				</li>
				<li>
					<strong>Revoke</strong> — deletes the token immediately; any client
					using it will get a 401 on the next request.
				</li>
				<li>
					Expired tokens are rejected automatically; they do not need to be
					manually revoked.
				</li>
			</ul>

			<h2>Security tips</h2>
			<ul>
				<li>Never commit tokens to source control or share them in chat.</li>
				<li>
					Store tokens in environment variables or a secrets manager on the
					client side.
				</li>
				<li>
					Create separate tokens for separate integrations so you can revoke one
					without affecting others.
				</li>
				<li>Set an expiry date for tokens used in temporary scripts.</li>
			</ul>

			<NextStep href="/docs/cli" label="#13 CLI Usage">
				Next: use the <code>shsf-cli</code> to sync files, update metadata,
				and run functions from your terminal — with access token authentication
				built in.
			</NextStep>
		</DocsContentShell>
	);
};
