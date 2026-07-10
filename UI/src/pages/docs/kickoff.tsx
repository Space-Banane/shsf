import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const DOCSKICKOFF = () => {
	return (
		<DocsContentShell>
			<DocHeader title="KICKOFF: AI-Powered Functions">
				KICKOFF is SHSF's built-in AI code generation feature. Describe what
				you want and the AI writes production-ready serverless function files
				directly into your function — no copy-pasting, no boilerplate.
			</DocHeader>

			<Callout variant="warning" title="KICKOFF overwrites existing files">
				<p>
					If the AI generates a file with the same name as one that already
					exists, it will be overwritten. Save a backup before using KICKOFF or
					REVISION on a function with existing code you care about.
				</p>
			</Callout>

			<h2>Setup: OpenRouter API key</h2>
			<p>
				KICKOFF is powered by{" "}
				<a
					href="https://openrouter.ai"
					className="text-blue-400 hover:underline"
					target="_blank"
					rel="noreferrer"
				>
					OpenRouter
				</a>{" "}
				using the <code>qwen/qwen3-coder-next</code> model. You need a personal
				OpenRouter API key:
			</p>
			<ol>
				<li>
					Get a free key at{" "}
					<a
						href="https://openrouter.ai/keys"
						className="text-blue-400 hover:underline"
						target="_blank"
						rel="noreferrer"
					>
						openrouter.ai/keys
					</a>
					.
				</li>
				<li>
					Go to <strong>Account Settings</strong> in SHSF and paste the key into
					the <strong>OpenRouter API Key</strong> field.
				</li>
			</ol>
			<Callout variant="note" title="Button is disabled without a key">
				<p>
					If no OpenRouter key is configured, the AI Generate (⚡) button in the
					file manager toolbar is disabled.
				</p>
			</Callout>

			<h2>Two modes</h2>

			<h3>⚡ KICKOFF — generate from scratch</h3>
			<p>
				Starts with a blank slate. The AI creates <strong>up to 5 files</strong>{" "}
				— source code plus the dependency files that match your runtime:{" "}
				<code>requirements.txt</code>, <code>go.mod</code>/<code>go.sum</code>,
				or a <code>.csproj</code>. Best for new functions.
			</p>

			<h3>✏️ REVISION — improve existing files</h3>
			<p>
				Select <strong>up to 3 existing files</strong> and describe the changes
				you want. The AI receives the current file contents and rewrites them.
				Use this for refactoring, adding error handling, or fixing bugs.
			</p>

			<h2>How to use</h2>
			<ol>
				<li>Open any function in the dashboard.</li>
				<li>
					Click the <strong>AI Generate (⚡)</strong> button in the file manager
					toolbar.
				</li>
				<li>Select a mode — KICKOFF or REVISION.</li>
				<li>
					In REVISION mode, check the files you want rewritten (up to 3).
				</li>
				<li>
					Type your prompt (up to 4096 characters) describing what you need.
				</li>
				<li>
					Click <strong>Generate</strong>. The AI calls <code>write_file</code>{" "}
					for each file it produces. Files are saved directly.
				</li>
				<li>Review the written files, then test your function.</li>
			</ol>

			<h2>Writing effective prompts</h2>
			<p>
				The AI already knows the full SHSF platform — entry points, the{" "}
				<code>args</code> object, the v2 response envelope, routing, db_com,
				environment variables, and file constraints. Focus your prompt on{" "}
				<em>what</em> the function should do, not on SHSF internals.
			</p>
			<CodeCaption>Good prompt example — Python</CodeCaption>
			<pre>
				<code>{`A Python function that accepts a JSON body with a "url" field,
fetches the page using requests, and returns the page title and
HTTP status code. Handle network errors gracefully.`}</code>
			</pre>
			<CodeCaption>Good prompt example — Go with routes</CodeCaption>
			<pre>
				<code>{`A Go function with two routes:
- "shorten" (POST): accepts {"url": "..."}, stores a short code
  in SHSF storage, returns the code.
- "r" (GET): reads "code" from the query string, looks it up,
  and redirects (302) to the original URL.`}</code>
			</pre>
			<h3>Tips</h3>
			<ul>
				<li>Specify the language (Python, Go, or .NET) if you have a preference.</li>
				<li>
					Mention third-party libraries you want — the AI will add them to the
					right dependency file.
				</li>
				<li>
					Describe expected request and response shapes (fields, status codes,
					headers) for more accurate output.
				</li>
				<li>
					For REVISION mode, be specific about what to change — don't rewrite
					the whole prompt.
				</li>
			</ul>

			<h2>What the AI knows</h2>
			<ul>
				<li>
					Entry points: <code>def main(args)</code> (Python),{" "}
					<code>func main_user</code> (Go), .NET project-based structure
				</li>
				<li>
					All <code>args</code> fields: <code>body</code>, <code>queries</code>,{" "}
					<code>route</code>, <code>headers</code>, <code>raw_body</code>,{" "}
					<code>method</code>
				</li>
				<li>SHSF v2 response envelope and redirects</li>
				<li>
					Environment variables via <code>os.getenv</code> /{" "}
					<code>os.Getenv</code>
				</li>
				<li>
					Persistent storage at <code>/app/</code>; ephemeral at{" "}
					<code>/tmp/</code>
				</li>
				<li>
					SHSF db_com (<code>_db_com.py</code> / <code>myfunction/dbcom</code>)
				</li>
				<li>Single-segment routing via <code>args["route"]</code></li>
				<li>
					Reserved filenames it must never produce: <code>_runner.py</code>,{" "}
					<code>_runner.js</code>, <code>init.sh</code>
				</li>
			</ul>

			<h2>Limits</h2>
			<ul>
				<li>Max 5 files per KICKOFF generation; max 3 files per REVISION.</li>
				<li>Prompts are capped at 4096 characters.</li>
				<li>
					Sub-directories in filenames are not supported — all files live at the
					function root.
				</li>
				<li>
					Generated files must match the runtime's allowed types (e.g. Python
					functions cannot get <code>.go</code> files).
				</li>
				<li>
					KICKOFF is not aware of your function's execution logs — describe
					issues in the REVISION prompt.
				</li>
			</ul>

			<NextStep href="/docs/version-control" label="#23 VERSION // CONTROL">
				Next: connect functions to a Git repository and deploy directly from
				source — with manual or automatic pulls on a schedule.
			</NextStep>
		</DocsContentShell>
	);
};
