import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const ExecutionAliasPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Execution Aliases">
				An execution alias is a human-readable string you assign to a function
				so it can be invoked by name instead of UUID. Aliases are optional —
				without one, you use the function ID in the URL.
			</DocHeader>

			<h2>Alias rules</h2>
			<ul>
				<li>8–128 characters long</li>
				<li>
					Alphanumeric characters, hyphens (<code>-</code>), and underscores
					(<code>_</code>) only
				</li>
				<li>Case-sensitive and globally unique across all SHSF functions</li>
				<li>Not copied when cloning — assign a new alias to each clone</li>
			</ul>

			<h2>Setting an alias</h2>
			<p>
				Enter the alias in the <strong>Execution Alias</strong> field when
				creating or updating a function. Or use the CLI:
			</p>
			<CodeCaption>CLI — set alias at creation</CodeCaption>
			<pre>
				<code>{`shsf create function --name hello-api --execution-alias hello-api \
  --image python:3.11 --startup-file main.py --namespace-id ns_12345678`}</code>
			</pre>
			<CodeCaption>CLI — update alias on an existing function</CodeCaption>
			<pre>
				<code>{`shsf update function func_42a7c1 --execution-alias hello-api`}</code>
			</pre>

			<h2>Invoking a function by alias</h2>
			<CodeCaption>HTTP GET — alias in URL</CodeCaption>
			<pre>
				<code>{`GET {API_URL}/exec/{alias}
GET {API_URL}/exec/{alias}/{route}`}</code>
			</pre>
			<CodeCaption>HTTP POST — with JSON body</CodeCaption>
			<pre>
				<code>{`POST {API_URL}/exec/{alias}
Content-Type: application/json

{ "key": "value" }`}</code>
			</pre>
			<CodeCaption>curl example</CodeCaption>
			<pre>
				<code>{`curl https://your-shsf-instance/exec/hello-api
curl -X POST https://your-shsf-instance/exec/hello-api/process \
  -H "Content-Type: application/json" \
  -d '{"input": "data"}'`}</code>
			</pre>

			<Callout variant="note" title="All other settings still apply">
				<p>
					Using an alias does not bypass secure headers, guest user
					authentication, CORS, or rate limits. The alias is just a friendlier
					URL — everything else works as normal.
				</p>
			</Callout>

			<h2>Changing an alias</h2>
			<Callout variant="warning" title="Changing an alias breaks existing integrations">
				<p>
					If any clients use the old alias URL, they will receive a 404 after
					the change. Update all clients before or immediately after renaming.
				</p>
			</Callout>

			<NextStep href="/docs/ffmpeg-install" label="#19 FFmpeg Installation">
				Next: enable automatic FFmpeg installation for video, audio, and
				media processing inside your functions.
			</NextStep>
		</DocsContentShell>
	);
};

export default ExecutionAliasPage;
