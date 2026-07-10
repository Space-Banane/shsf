import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const DocsVersionControl = () => {
	return (
		<DocsContentShell>
			<DocHeader title="VERSION // CONTROL">
				Connect any function to a Git repository. SHSF clones the repo (or a
				chosen subdirectory) into the function's app directory and can pull
				updates manually or on a schedule.
			</DocHeader>

			<Callout variant="warning" title="File manager is disabled while git is active">
				<p>
					Once a Git source is configured, the built-in file manager is locked.
					All file changes must go through the repository — SHSF will not let
					you edit files directly to prevent them being overwritten on the next
					pull.
				</p>
			</Callout>

			<h2>How to open VERSION // CONTROL</h2>
			<p>
				Navigate to any function and click the{" "}
				<strong>VERSION // CONTROL</strong> button (git branch icon) in the
				function toolbar.
			</p>

			<h2>Setup</h2>

			<h3>1. Enter a repository URL</h3>
			<p>
				Paste the HTTPS or SSH URL of your repository into the{" "}
				<em>Repository URL</em> field. Both public and private repos are
				supported.
			</p>
			<CodeCaption>Example</CodeCaption>
			<pre>
				<code>https://github.com/your-org/your-repo.git</code>
			</pre>

			<h3>2. Source directory (optional)</h3>
			<p>
				If your function code lives inside a subdirectory, enter the relative
				path in <em>Source Directory</em>. Only that directory's contents are
				deployed; the rest of the repo is ignored.
			</p>
			<pre>
				<code>src/my-function</code>
			</pre>
			<p>Leave blank to deploy from the repository root.</p>

			<h3>3. Authentication (private repos)</h3>
			<p>
				Enter a <strong>Username</strong> and <strong>Access Token</strong>{" "}
				(e.g. a GitHub Personal Access Token). Credentials are encrypted with
				AES-256-GCM before storage — never stored in plaintext.
			</p>
			<Callout variant="note" title="Rotate tokens any time">
				<p>
					Click <strong>Save Credentials</strong> to update a token, or{" "}
					<strong>Remove Credentials</strong> to switch to public access. The
					repository URL is not affected.
				</p>
			</Callout>

			<h3>4. Clone</h3>
			<p>
				Click <strong>Clone</strong>. SHSF clears the function's app directory
				and populates it with the repository contents. A log at the bottom of
				the modal shows full git output for debugging.
			</p>
			<Callout variant="danger" title="Clone deletes all existing files">
				<p>
					Cloning permanently deletes every file in the function's app
					directory. If you change the URL and click Clone again (Re-Clone),
					the same destruction happens. Back up any manually created files
					you need to keep.
				</p>
			</Callout>

			<h2>Pulling updates</h2>

			<h3>Manual pull</h3>
			<p>
				Click <strong>Pull</strong> at any time to fetch the latest commits
				from the remote default branch. If a source directory is set, SHSF
				syncs only that subdirectory.
			</p>

			<h3>Periodic pull</h3>
			<p>
				Enable <strong>Periodic Pull</strong> to have SHSF pull on a schedule.
				Choose a preset or enter a custom interval (1–1440 minutes):
			</p>
			<div className="overflow-x-auto my-4">
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
							["15 min", "15"],
							["30 min", "30"],
							["1 hour", "60"],
							["6 hours", "360"],
							["Daily", "1440"],
						].map(([label, val]) => (
							<tr key={val} className="hover:bg-primary/5">
								<td className="px-4 py-2 font-medium">{label}</td>
								<td className="px-4 py-2 text-text/60">{val} minutes</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<p>
				Periodic pull runs in the background — invocations are not affected
				while a pull is in progress.
			</p>

			<h2>Removing git configuration</h2>
			<p>
				Click <strong>Remove Git Config</strong> to detach the function from
				its repository. Existing files in <code>/app/</code> are left
				untouched. The file manager becomes available immediately.
			</p>

			<h2>Monorepo pattern</h2>
			<p>
				Connect multiple functions to the same repository by using different
				Source Directory values:
			</p>
			<CodeCaption>Monorepo layout</CodeCaption>
			<pre>
				<code>{`my-monorepo/
├── functions/
│   ├── auth/          ← Function A  (source dir: functions/auth)
│   ├── payments/      ← Function B  (source dir: functions/payments)
│   └── notifications/ ← Function C  (source dir: functions/notifications)`}</code>
			</pre>

			<h2>Quick reference</h2>
			<div className="overflow-x-auto my-4">
				<table className="w-full text-sm text-left text-text/80 border border-primary/20 rounded-lg overflow-hidden">
					<thead className="bg-primary/10 text-primary uppercase text-xs">
						<tr>
							<th className="px-4 py-3">Action</th>
							<th className="px-4 py-3">What it does</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-primary/10">
						{[
							["Clone", "Clears app dir, clones repository (or source dir) into it"],
							["Re-Clone", "Same as Clone — used when the repository URL has changed"],
							["Pull", "Fetches latest commits; syncs source dir to app dir if set"],
							["Periodic Pull", "Runs Pull automatically at the chosen interval"],
							["Save Credentials", "Stores / rotates username and access token (encrypted)"],
							["Remove Credentials", "Deletes saved credentials; switches to public access"],
							["Remove Git Config", "Detaches repository; leaves files intact; re-enables file manager"],
						].map(([action, desc]) => (
							<tr key={action} className="hover:bg-primary/5">
								<td className="px-4 py-2 font-semibold text-primary/80 whitespace-nowrap">{action}</td>
								<td className="px-4 py-2 text-text/60">{desc}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<NextStep href="/docs/clone-function" label="#24 Clone Function">
				Next: duplicate an existing function — all files, settings, and
				environment variables — with a single click.
			</NextStep>
		</DocsContentShell>
	);
};
