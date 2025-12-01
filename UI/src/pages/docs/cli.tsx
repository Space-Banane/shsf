import React from "react";
import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export function CLIDocPage() {
	return (
		<div className="min-h-screen bg-background text-text p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6">
					<a href="/docs" className="text-sm text-blue-500 hover:underline">
						← Back to docs
					</a>
				</div>

				<ScrollProgressbar />
				<h1 className="text-3xl font-bold text-primary mb-2">
					SHSF CLI: Command Line Interface Guide
				</h1>
				<p className="mt-3 text-lg text-text/90 mb-6">
					The <code>shsf-cli</code> is a powerful command line tool for developers
					and administrators to manage SHSF serverless functions, files, and
					environments directly from your terminal.
				</p>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Installation</h2>
				<div className="mb-6">
					<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
						<code>{`npm install -g shsf-cli`}</code>
					</pre>
				</div>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Basic Usage</h2>
				<p className="mb-4 text-text/90">
					Run <code>shsf-cli --help</code> to see all available options.
				</p>
				<div className="mb-6">
					<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
						<code>{`shsf-cli --help`}</code>
					</pre>
				</div>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">
					Authentication & Settings
				</h2>
				<p className="mb-4 text-text/90">
					You can create an access token in the SHSF UI under Account &gt; Access
					Tokens. Use this token to authenticate your CLI requests.
				</p>
				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>
						<b>Set your access token:</b>
						<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-2">
							<code>{`shsf-cli --mode set-key --key <YOUR_TOKEN>`}</code>
						</pre>
					</li>
					<li>
						<b>Set your SHSF instance URL:</b>
						<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-2">
							<code>{`shsf-cli --mode set-url --url https://your-shsf-instance.com`}</code>
						</pre>
					</li>
					<li>
						<b>Open interactive settings:</b>
						<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-2">
							<code>{`shsf-cli --mode settings`}</code>
						</pre>
					</li>
				</ul>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">
					Syncing Functions
				</h2>
				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>
						<b>Pull function code, metadata, and environment:</b>
						<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-2">
							<code>{`shsf-cli --mode pull --project ./my-func --link 1234`}</code>
						</pre>
					</li>
					<li>
						<b>Push local changes to SHSF:</b>
						<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-2">
							<code>{`shsf-cli --mode push --project ./my-func --link 1234`}</code>
						</pre>
					</li>
					<li>
						<b>Watch for changes and auto-sync:</b>
						<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-2">
							<code>{`shsf-cli --mode watchdog --project ./my-func --link 1234`}</code>
						</pre>
					</li>
				</ul>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Ignore Files</h2>
				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>
						<b>Add a pattern to ignore:</b>
						<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-2">
							<code>{`shsf-cli --mode ignore --project ./my-func --file node_modules`}</code>
						</pre>
					</li>
					<li>
						<b>Remove a pattern:</b>
						<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-2">
							<code>{`shsf-cli --mode ignore --project ./my-func --file node_modules --remove`}</code>
						</pre>
					</li>
					<li>
						<b>List ignored patterns:</b>
						<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-2">
							<code>{`shsf-cli --mode ignore --project ./my-func --list`}</code>
						</pre>
					</li>
				</ul>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">
					Notes & Best Practices
				</h2>
				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>
						Always keep your CLI and SHSF instance updated for the latest features and
						security fixes.
					</li>
					<li>
						Use <code>--help</code> with any command for more details.
					</li>
					<li>
						Environment and metadata are synced via <code>.env</code> and{" "}
						<code>.meta.json</code> files in your project folder.
					</li>
					<li>Python files are syntax-checked before upload.</li>
				</ul>

				<div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
					<h2 className="text-xl font-bold text-primary mb-3">
						🚀 Next Step - Database Communication
					</h2>
					<p className="text-text/90 mb-4">
						Learn how to use the Python database communication interface for fast
						persistent storage and retrieval.
					</p>
					<a
						href="/docs/db-com"
						className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
					>
						#14 Database Communication
						<span className="text-lg">→</span>
					</a>
				</div>
			</div>
		</div>
	);
}
