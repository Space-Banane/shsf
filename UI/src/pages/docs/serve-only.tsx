import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const ServeOnlyHtmlPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Serve Only HTML">
				SHSF can serve a single <code>.html</code> file directly, bypassing
				all runtime machinery. There is no Python/Go process, no{" "}
				<code>main(args)</code> entrypoint — just the file, streamed to the
				browser on every request.
			</DocHeader>

			<Callout variant="info" title="How SHSF detects serve-only mode">
				<p>
					If the function's <strong>startup file</strong> ends in{" "}
					<code>.html</code>, SHSF automatically switches to serve-only mode.
					No toggle or special setting is required.
				</p>
			</Callout>

			<h2>How to set it up</h2>
			<ol>
				<li>
					Create (or update) a function and set the{" "}
					<strong>Startup File</strong> field to a name ending in{" "}
					<code>.html</code>, e.g. <code>index.html</code>.
				</li>
				<li>
					Upload your HTML file to the function via the file manager.
				</li>
				<li>
					That's it. SHSF detects the <code>.html</code> extension and serves
					the file directly.
				</li>
			</ol>

			<h2>Example HTML file</h2>
			<CodeCaption>index.html — a minimal static page</CodeCaption>
			<pre>
				<code>{`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Static Page</title>
  <style>body { font-family: sans-serif; padding: 2rem; }</style>
</head>
<body>
  <h1>Hello from SHSF!</h1>
  <p>This is a static page served directly — no server-side code.</p>
</body>
</html>`}</code>
			</pre>

			<h2>What is disabled in serve-only mode</h2>
			<p>
				Because no runtime container is started, several dynamic features are
				unavailable:
			</p>
			<ul>
				<li>No <code>main(args)</code> entrypoint — function code is not executed</li>
				<li>No environment variable injection at runtime</li>
				<li>No <code>args</code> object, routes, or query parameters handling</li>
				<li>No dependency installation (<code>requirements.txt</code>, <code>go.mod</code>)</li>
				<li>No custom response envelope (<code>_shsf v2</code>)</li>
				<li>No db_com storage access</li>
				<li>FFmpeg and OpenCV installation options are automatically disabled</li>
			</ul>
			<Callout variant="tip" title="Check the UI for the live status">
				<p>
					The function dashboard marks unavailable features clearly when
					serve-only mode is active.
				</p>
			</Callout>

			<h2>When to use it</h2>
			<ul>
				<li>Static landing pages or maintenance notices</li>
				<li>Simple documentation pages or status pages</li>
				<li>
					Front-end apps that call <em>other</em> SHSF functions for their API
					(the HTML is static; logic lives in a separate function)
				</li>
			</ul>
			<Callout variant="note" title="Need dynamic HTML?">
				<p>
					If you need server-side rendering or dynamic data injection, use a
					regular Python/Go function and return the HTML via the{" "}
					<a href="/docs/user-interfaces" className="text-blue-400 hover:text-blue-300">
						User Interfaces
					</a>{" "}
					pattern instead.
				</p>
			</Callout>

			<NextStep href="/docs/access-tokens" label="#12 Access Tokens">
				Next: generate API access tokens to authenticate scripts and
				third-party integrations without using your password.
			</NextStep>
		</DocsContentShell>
	);
};
