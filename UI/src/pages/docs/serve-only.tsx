import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader } from "./_components";

export const ServeOnlyHtmlPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Serve Only HTML">
				SHSF can serve static <code>.html</code> files directly, bypassing all
				runtime machinery. The startup file is the default page; there is no Python/Go process, no{" "}
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
					Optionally upload more <code>.html</code> files. A request to a route
					uses the matching file: for example, <code>/exec/site/about</code>{" "}
					serves <code>about.html</code>.
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
				<li>
					No <code>args</code> object or dynamic request handling; routes only
					select static <code>.html</code> files and query parameters are ignored
				</li>
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

		</DocsContentShell>
	);
};
