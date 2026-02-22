import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const DOCSKICKOFF = () => {
	return (
		<div className="min-h-screen bg-background text-text p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6">
					<a href="/docs" className="text-sm text-blue-500 hover:underline">
						← Back to docs
					</a>
				</div>

				<ScrollProgressbar />

				<h1 className="text-3xl font-bold text-primary mb-2">KICKOFF: AI-Powered Functions</h1>
				<p className="mt-3 text-lg text-text/90 mb-8">
					KICKOFF is SHSF's built-in AI code-generation feature. Describe what you want
					and the AI will write production-ready serverless function files directly into
					your function — no copy-pasting required.
				</p>

				{/* Overview */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Overview</h2>
				<p className="mb-4 text-text/90">
					KICKOFF is powered by{" "}
					<a href="https://openrouter.ai" className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">
						OpenRouter
					</a>{" "}
					and uses the <code>qwen/qwen3-coder-next</code> model. It is aware of the
					full SHSF platform — entry-point conventions, the <code>args</code> object,
					custom responses, routing, persistent storage, and more — so the generated
					code is ready to run without manual fixups.
				</p>
				<p className="mb-6 text-text/90">
					KICKOFF supports generating functions in <strong>Python</strong> and{" "}
					<strong>Go</strong>, matching the runtimes available in SHSF.
				</p>

				{/* Setup */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Setup: OpenRouter API Key</h2>
				<p className="mb-4 text-text/90">
					KICKOFF requires a personal OpenRouter API key. Go to{" "}
					<em>Account Settings</em> and paste your key into the{" "}
					<em>OpenRouter API Key</em> field. Get a key for free at{" "}
					<a href="https://openrouter.ai/keys" className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">
						openrouter.ai/keys
					</a>.
				</p>
				<div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
					<p className="text-sm text-yellow-300">
						<strong>Note:</strong> If no key is configured, the AI generate button will
						return a <code>503 Service Unavailable</code> error. Add your key in
						Account Settings to enable KICKOFF.
					</p>
				</div>

				{/* Modes */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Modes</h2>
				<p className="mb-4 text-text/90">
					KICKOFF offers two modes, selectable inside the generation modal:
				</p>

				<div className="space-y-4 mb-8">
					{/* KICKOFF mode */}
					<div className="p-5 rounded-xl" style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.25)" }}>
						<h3 className="text-lg font-bold text-indigo-300 mb-2">⚡ KICKOFF — Generate from scratch</h3>
						<p className="text-text/80 text-sm mb-2">
							Starts with a blank slate. Describe the function you want and the AI will
							create <strong>up to 5 files</strong> — source code, dependencies
							(<code>requirements.txt</code> / <code>go.mod</code>), and any helper
							modules needed. Best used when starting a new function.
						</p>
						<p className="text-xs text-gray-500">Max files: 5 &nbsp;·&nbsp; Existing files: not sent to the model</p>
					</div>

					{/* REVISION mode */}
					<div className="p-5 rounded-xl" style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.25)" }}>
						<h3 className="text-lg font-bold text-purple-300 mb-2">✏️ REVISION — Improve existing files</h3>
						<p className="text-text/80 text-sm mb-2">
							Select <strong>up to 3 existing files</strong> and describe the changes
							you want. The AI receives the current file contents along with your
							instructions and rewrites them in full. Use this for refactoring,
							adding error handling, extending functionality, or fixing bugs.
						</p>
						<p className="text-xs text-gray-500">Max files to revise: 3 &nbsp;·&nbsp; Full file contents are sent to the model</p>
					</div>
				</div>

				{/* How to use */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">How to Use</h2>
				<ol className="list-decimal list-inside mb-6 text-text/90 space-y-3">
					<li>Open any function in the SHSF dashboard.</li>
					<li>
						Click the <strong>AI Generate</strong> (⚡) button in the file manager
						toolbar.
					</li>
					<li>Select a mode — <strong>KICKOFF</strong> or <strong>REVISION</strong>.</li>
					<li>
						In <em>REVISION</em> mode, check the files you want the AI to rewrite
						(up to 3).
					</li>
					<li>Type your prompt describing what you need (up to 4096 characters).</li>
					<li>
						Click <strong>Generate</strong> and wait. The AI works in an agentic loop,
						calling <code>write_file</code> for each file it produces. Files are saved
						directly to your function.
					</li>
					<li>
						Review the written files in the file manager, then test your function.
					</li>
				</ol>

				<div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
					<p className="text-sm text-red-300">
						<strong>Warning:</strong> KICKOFF will overwrite any existing files that
						share the same name as files the AI decides to generate. Maybe save a backup before using KICKOFF or REVISION.
					</p>
				</div>

				{/* Writing good prompts */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Writing Effective Prompts</h2>
				<p className="mb-4 text-text/90">
					The AI already knows the SHSF platform conventions, so you don't need to
					explain how <code>main(args)</code> works. Focus on <em>what</em> you want
					the function to do.
				</p>

				<h3 className="text-xl font-semibold text-primary mb-3">Good prompt examples</h3>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
					<code>{`A Python function that accepts a JSON body with a "url" field,
fetches the page using requests, and returns the page title and
status code. Handle network errors gracefully.`}</code>
				</pre>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`A Go function with two routes:
- "shorten" (POST): accepts {"url": "..."} and stores a short
  code in SHSF storage, returning the code.
- "r" (GET): reads the code from the query string, looks it up,
  and redirects (302) to the original URL.`}</code>
				</pre>

				<h3 className="text-xl font-semibold text-primary mb-3">Tips</h3>
				<ul className="list-disc list-inside mb-6 text-text/90 space-y-2">
					<li>Specify the language (Python or Go) if you have a preference.</li>
					<li>
						Mention any third-party libraries you want used — the AI will add them to
						<code> requirements.txt</code> or <code>go.mod</code>.
					</li>
					<li>
						Describe the expected request/response shape (fields, status codes, headers)
						to get more accurate output.
					</li>
					<li>
						For <em>REVISION</em> mode, be specific about what to change rather than
						rewriting the whole prompt from scratch.
					</li>
				</ul>

				{/* What the AI knows */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">What the AI Knows</h2>
				<p className="mb-4 text-text/90">
					Every generation request injects a full SHSF platform reference into the
					system prompt. The AI is aware of:
				</p>
				<ul className="list-disc list-inside mb-6 text-text/90 space-y-1.5">
					<li>Entry-point conventions for Python (<code>def main(args)</code>) and Go (<code>func main_user</code>)</li>
					<li>The <code>args</code> object — <code>body</code>, <code>queries</code>, <code>route</code>, <code>headers</code>, <code>raw_body</code>, <code>method</code></li>
					<li>The SHSF v2 response envelope (<code>_shsf</code>, <code>_code</code>, <code>_res</code>, <code>_headers</code>, <code>_location</code>)</li>
					<li>Redirects (301 / 302 via <code>_location</code>)</li>
					<li>Environment variables via <code>os.getenv</code> / <code>os.Getenv</code></li>
					<li>Persistent storage at <code>/app/</code> and ephemeral storage at <code>/tmp/</code></li>
					<li>SHSF database communication (<code>_db_com.py</code> / <code>myfunction/dbcom</code>)</li>
					<li>Single-segment routing via <code>args["route"]</code></li>
					<li>Serving HTML responses with <code>Content-Type: text/html</code></li>
					<li>Dependency management (<code>requirements.txt</code>, <code>go.mod</code>)</li>
					<li>Reserved filenames it must never produce: <code>_runner.py</code>, <code>_runner.js</code>, <code>init.sh</code></li>
				</ul>

				{/* Limitations */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Limitations</h2>
				<ul className="list-disc list-inside mb-6 text-text/90 space-y-2">
					<li>Maximum <strong>5 files</strong> per KICKOFF generation, <strong>3 files</strong> per REVISION.</li>
					<li>Prompts are capped at <strong>4096 characters</strong>.</li>
					<li>
						The AI may occasionally make mistakes — always review generated code before
						executing it in a production environment.
					</li>
					<li>
						Sub-directories in filenames are not supported; all files live at the root
						of the function.
					</li>
					<li>
						KICKOFF is not aware of your function's execution logs or previous run
						results — describe issues in your prompt when using REVISION mode.
					</li>
				</ul>

				{/* CTA */}
				<div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
					<h2 className="text-xl font-bold text-primary mb-3">
						📚 Keep Your Instance Updated
					</h2>
					<p className="text-text/90 mb-4">
						This is the latest documentation available. Make sure to keep your SHSF
						instance updated to get access to new features and improvements!
					</p>
					<div className="flex flex-wrap gap-4">
						<a
							href="/docs/docker-mount"
							className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors text-sm"
						>
							Docker Mount →
						</a>
						<a
							href="/docs/go-runtime"
							className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors text-sm"
						>
							Go Runtime →
						</a>
						<a
							href="/docs/custom-responses"
							className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors text-sm"
						>
							Custom Responses →
						</a>
					</div>
				</div>
			</div>
		</div>
	);
};
