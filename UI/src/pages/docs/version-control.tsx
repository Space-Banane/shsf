import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const DocsVersionControl = () => {
	return (
		<div className="min-h-screen bg-background text-text p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6">
					<a href="/docs" className="text-sm text-blue-500 hover:underline">
						← Back to docs
					</a>
				</div>

				<ScrollProgressbar />

				<h1 className="text-3xl font-bold text-primary mb-2">VERSION // CONTROL</h1>
				<p className="mt-3 text-lg text-text/90 mb-8">
					Deploy your serverless functions directly from a Git repository. Clone,
					pull, and keep your code in sync — automatically or on demand.
				</p>

				{/* Overview */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Overview</h2>
				<p className="mb-4 text-text/90">
					VERSION // CONTROL lets you connect any function to a Git repository URL.
					Once configured, SHSF clones the repository (or a chosen subdirectory of
					it) into the function's app directory. You can then pull updates manually
					or have SHSF pull on a recurring schedule.
				</p>
				<p className="mb-6 text-text/90">
					While a Git source is active the built-in file manager is{" "}
					<strong>disabled</strong> — the repository is the sole source of truth for
					the function's files.
				</p>

				<div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
					<p className="text-sm text-blue-300">
						<strong>How to open it:</strong> Navigate to any function, then click the{" "}
						<strong>VERSION // CONTROL</strong> button (git branch icon) in the
						function toolbar.
					</p>
				</div>

				{/* Setup */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Setup</h2>

				<h3 className="text-xl font-semibold text-primary mb-3">1. Enter a Repository URL</h3>
				<p className="mb-4 text-text/90">
					Paste the HTTPS (or SSH) URL of your repository into the{" "}
					<em>Repository URL</em> field. Both public and private repositories are
					supported.
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>https://github.com/your-org/your-repo.git</code>
				</pre>

				<h3 className="text-xl font-semibold text-primary mb-3">
					2. Source Directory (optional)
				</h3>
				<p className="mb-4 text-text/90">
					If your function lives inside a subdirectory of the repository, enter the
					relative path in the <em>Source Directory</em> field. Only that
					subdirectory's contents will be deployed to the function — the rest of the
					repository is ignored.
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
					<code>src/my-function</code>
				</pre>
				<p className="mb-6 text-text/90">
					Leave blank to deploy the entire repository root.
				</p>

				<h3 className="text-xl font-semibold text-primary mb-3">
					3. Authentication (private repos)
				</h3>
				<p className="mb-4 text-text/90">
					For private repositories, provide a <strong>Username</strong> and an{" "}
					<strong>Access Token</strong> (e.g. a GitHub Personal Access Token or
					GitLab deploy token). Credentials are stored encrypted with AES-256-GCM
					using a key derived from the server's instance secret — they are never
					stored in plaintext.
				</p>
				<div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
					<p className="text-sm text-yellow-300">
						<strong>Security note:</strong> Never commit tokens to source code. Use
						SHSF's credential storage here and environment variables for any other
						secrets your function needs at runtime.
					</p>
				</div>

				<p className="mb-6 text-text/90">
					You can update or remove saved credentials at any time without
					reconfiguring the repository URL. Use{" "}
					<strong>Save Credentials</strong> to rotate a token and{" "}
					<strong>Remove Credentials</strong> to switch to unauthenticated access.
				</p>

				<h3 className="text-xl font-semibold text-primary mb-3">4. Clone</h3>
				<p className="mb-6 text-text/90">
					Click <strong>Clone</strong> to perform the initial clone. SHSF will clear
					the function's app directory and populate it with the repository contents
					(or source subdirectory). The output log at the bottom of the modal shows
					the full git output so you can diagnose any issues.
				</p>

				<div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
					<p className="text-sm text-red-300">
						<strong>Warning:</strong> Cloning permanently deletes all existing files
						in the function's app directory. If you change the URL and click Clone
						again (<em>Re-Clone</em>), the same destruction happens. Make sure you
						have a backup of any manually created files you need to keep.
					</p>
				</div>

				{/* Pulling */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Pulling Updates</h2>

				<h3 className="text-xl font-semibold text-primary mb-3">Manual Pull</h3>
				<p className="mb-6 text-text/90">
					Once a repository is cloned, the <strong>Pull</strong> button becomes
					available. Click it at any time to fetch the latest commits from the remote
					default branch. If a source directory is configured, SHSF will sync only
					that subdirectory into the app directory after pulling.
				</p>

				<h3 className="text-xl font-semibold text-primary mb-3">Periodic Pull</h3>
				<p className="mb-4 text-text/90">
					Enable the <strong>Periodic Pull</strong> toggle to have SHSF
					automatically pull on a schedule. Choose from preset intervals or enter a
					custom value between 1 and 1440 minutes:
				</p>
				<div className="overflow-x-auto mb-6">
					<table className="w-full text-sm text-left text-text/80 border border-primary/20 rounded-lg overflow-hidden">
						<thead className="bg-primary/10 text-primary uppercase text-xs">
							<tr>
								<th className="px-4 py-3">Preset</th>
								<th className="px-4 py-3">Interval</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-primary/10">
							{[
								["5 min", "5"],
								["10 min", "10"],
								["15 min", "15"],
								["30 min", "30"],
								["1 hour", "60"],
								["2 hours", "120"],
								["6 hours", "360"],
								["Daily", "1440"],
							].map(([label, val]) => (
								<tr key={val} className="hover:bg-primary/5 transition-colors">
									<td className="px-4 py-2 font-medium">{label}</td>
									<td className="px-4 py-2 text-gray-400">{val} minutes</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<p className="mb-6 text-text/90">
					Periodic pull runs in the background — invocations are not affected while
					a pull is in progress.
				</p>

				{/* Removing */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Removing Git Configuration</h2>
				<p className="mb-6 text-text/90">
					Click <strong>Remove Git Config</strong> to detach the function from its
					repository. The files already in the app directory are left untouched — only the
					git configuration (URL, credentials, periodic pull schedule) is erased.
					The file manager becomes available again immediately.
				</p>

				{/* File manager note */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">File Manager Behaviour</h2>
				<p className="mb-6 text-text/90">
					When VERSION // CONTROL is active the SHSF file manager is locked. You
					cannot create, edit, rename, or delete files through the UI — all changes
					must go through the repository. This prevents accidental overwrites the
					next time a pull runs.
				</p>

				{/* Monorepo pattern */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Monorepo Pattern</h2>
				<p className="mb-4 text-text/90">
					You can connect multiple SHSF functions to the <em>same</em> repository
					by using different <em>Source Directory</em> values. For example:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`my-monorepo/
├── functions/
│   ├── auth/          ← SHSF function A  (source dir: functions/auth)
│   ├── payments/      ← SHSF function B  (source dir: functions/payments)
│   └── notifications/ ← SHSF function C  (source dir: functions/notifications)
└── shared/`}</code>
				</pre>
				<p className="mb-6 text-text/90">
					Each function only ever sees the contents of its own source directory.
				</p>

				{/* Quick reference */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Quick Reference</h2>
				<div className="overflow-x-auto mb-8">
					<table className="w-full text-sm text-left text-text/80 border border-primary/20 rounded-lg overflow-hidden">
						<thead className="bg-primary/10 text-primary uppercase text-xs">
							<tr>
								<th className="px-4 py-3">Action</th>
								<th className="px-4 py-3">What it does</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-primary/10 text-sm">
							{[
								["Clone", "Clears app dir, clones repository (or source dir) into it"],
								["Re-Clone", "Same as Clone — used when the repository URL is changed"],
								["Pull", "Fetches latest commits; syncs source dir to app dir if set"],
								["Periodic Pull", "Runs Pull automatically at the chosen interval"],
								["Save Credentials", "Stores / rotates username and access token (encrypted)"],
								["Remove Credentials", "Deletes saved credentials, switches to public access"],
								["Remove Git Config", "Detaches repository; leaves files intact; re-enables file manager"],
								["Open Git Repo", "Opens the repository URL in a new browser tab (credentials stripped)"],
							].map(([action, desc]) => (
								<tr key={action} className="hover:bg-primary/5 transition-colors">
									<td className="px-4 py-2 font-semibold text-primary/80 whitespace-nowrap">{action}</td>
									<td className="px-4 py-2 text-gray-400">{desc}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

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
							href="/docs/kickoff"
							className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors text-sm"
						>
							KICKOFF →
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
