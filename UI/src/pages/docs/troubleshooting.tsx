import { DocsContentShell } from "./DocsContentShell";
import { Callout, DocHeader } from "./_components";

export const TroubleshootingDocPage = () => (
	<DocsContentShell>
		<DocHeader title="Troubleshooting">
			Common problems when installing SHSF or invoking functions, with the
			checks that usually fix them.
		</DocHeader>

		<h2>The stack won't start</h2>
		<ul>
			<li>
				<strong>Invalid environment variables</strong> — the backend exits on
				startup and prints each bad variable. <code>PORT</code>, <code>UI_URL</code>,{" "}
				<code>REACT_APP_API_URL</code>, <code>DOMAIN</code> and <code>CORS_URLS</code>{" "}
				are required. See <a href="/docs/getting-started" className="text-blue-400 hover:text-blue-300">Getting Started</a>.
			</li>
			<li>
				<strong>INSTANCE_SECRET rejected</strong> — production requires at least
				32 characters and not the built-in default. Use <code>openssl rand -hex 32</code>.
			</li>
			<li>
				<strong>Cannot reach the database</strong> — check <code>DATABASE_URL</code>.
				If you run the bundled <code>db</code> service, the host must be{" "}
				<code>db</code> (the default).
			</li>
			<li>
				<strong>Functions never start</strong> — the backend needs{" "}
				<code>/var/run/docker.sock</code>; check <code>docker compose logs backend</code>.
			</li>
		</ul>

		<h2>HTTP errors from <code>/exec/</code></h2>
		<ul>
			<li>
				<strong>403 "HTTP execution is not allowed"</strong> — enable{" "}
				<strong>Allow HTTP</strong> in <strong>Update Function</strong>.
			</li>
			<li>
				<strong>403 "Missing/Invalid secure header"</strong> — send the correct{" "}
				<code>x-secure-header</code>. See{" "}
				<a href="/docs/secure-headers" className="text-blue-400 hover:text-blue-300">Secure Headers</a>.
			</li>
			<li>
				<strong>403 with an <code>x-access-key</code></strong> — the token is invalid or belongs to
				another user. See <a href="/docs/access-tokens" className="text-blue-400 hover:text-blue-300">Access Tokens</a>.
				Functions with guest users accept only a guest session — see{" "}
				<a href="/docs/guest-users" className="text-blue-400 hover:text-blue-300">Guest Users</a>.
			</li>
			<li>
				<strong>404 "Function not found"</strong> — check the alias or ID; an old
				alias stops working after a change. See{" "}
				<a href="/docs/execution-alias" className="text-blue-400 hover:text-blue-300">Execution Alias</a>.
			</li>
			<li>
				<strong>429 <code>RATE_LIMITED</code></strong> — the function's rate limit was hit;
				retry after the time in the message.
			</li>
			<li>
				<strong>504 <code>FUNCTION_TIMEOUT</code></strong> — raise the timeout in{" "}
				<strong>Update Function</strong> or make the function faster.
			</li>
			<li>
				<strong>422 <code>FUNCTION_EXECUTION_FAILED</code></strong> — the code raised an error
				or exited non-zero; read the function's logs.
			</li>
			<li>
				<strong>500 <code>SERVER_ERROR</code></strong> — SHSF itself failed; check the backend logs.
			</li>
			<li>
				<strong>Browser blocked by CORS</strong> — add the page's origin under{" "}
				<strong>CORS Origins</strong>. See <a href="/docs/custom-cors" className="text-blue-400 hover:text-blue-300">Custom CORS</a>.
			</li>
		</ul>

		<h2>Function runs but misbehaves</h2>
		<ul>
			<li>
				<strong>"Function is not ready yet."</strong> — a new function's container is
				still being pulled and initialised. Wait a moment and run it again.
			</li>
			<li>
				<strong>Dependency import errors</strong> — add{" "}
				<code>requirements.txt</code>, <code>go.mod</code> or <code>package.json</code>.
				See <a href="/docs/nodejs-runtime" className="text-blue-400 hover:text-blue-300">Node.js</a> and{" "}
				<a href="/docs/go-runtime" className="text-blue-400 hover:text-blue-300">Go</a>.
			</li>
			<li>
				<strong>Environment variable missing</strong> — function-level values override
				shared ones. See <a href="/docs/environment-variables" className="text-blue-400 hover:text-blue-300">Environment Variables</a>.
			</li>
			<li>
				<strong>Odd response or status</strong> — check the response envelope in{" "}
				<a href="/docs/custom-responses" className="text-blue-400 hover:text-blue-300">Custom Responses</a>.
			</li>
			<li>
				<strong>Trigger didn't fire</strong> — confirm it is <strong>Enabled</strong> and
				the cron expression is valid; invalid expressions are disabled automatically.
				Times use the server timezone. See <a href="/docs/triggers">Scheduled Triggers</a>.
			</li>
		</ul>

		<Callout variant="tip" title="Start with the logs">
			<p>
				Every execution's output and error type is in the function's <strong>Logs</strong> card.
			</p>
		</Callout>
	</DocsContentShell>
);
