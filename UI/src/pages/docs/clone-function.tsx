import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const DocsCloneFunction = () => {
	return (
		<div className="min-h-screen bg-background text-text p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6">
					<a href="/docs" className="text-sm text-blue-500 hover:underline">
						← Back to docs
					</a>
				</div>

				<ScrollProgressbar />

				<h1 className="text-3xl font-bold text-primary mb-2">Cloning Functions</h1>
				<p className="mt-3 text-lg text-text/90 mb-8">
					Duplicate any existing function — including all its files and settings —
					into the same namespace or a different one, in one click.
				</p>

				{/* Overview */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Overview</h2>
				<p className="mb-4 text-text/90">
					Cloning creates a full copy of a function: its runtime image, startup
					file, environment variables, settings (RAM, timeout, tags, CORS, …), and
					every file in the file manager. The clone is independent — edits to the
					clone never affect the original, and vice versa.
				</p>
				<p className="mb-6 text-text/90">
					This is useful for spinning up a staging copy, experimenting with a
					different runtime version, or reusing boilerplate across namespaces.
				</p>

				<div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
					<p className="text-sm text-blue-300">
						<strong>How to open it:</strong> Navigate to any function and click the{" "}
						<strong>Clone</strong> button in the function toolbar. The Clone Function
						modal will appear.
					</p>
				</div>

				{/* What is copied */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">What Gets Copied</h2>
				<div className="overflow-x-auto mb-6">
					<table className="w-full text-sm text-left text-text/80 border border-primary/20 rounded-lg overflow-hidden">
						<thead className="bg-primary/10 text-primary uppercase text-xs">
							<tr>
								<th className="px-4 py-3">Property</th>
								<th className="px-4 py-3">Copied?</th>
								<th className="px-4 py-3">Notes</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-primary/10">
							{[
								["Name", "✅ Yes (modified)", "Appended with -copy, or use your own name"],
								["Description", "✅ Yes", ""],
								["Runtime image", "✅ Yes", "e.g. python:3.12, golang:1.23"],
								["Startup file", "✅ Yes", ""],
								["All function files", "✅ Yes", "Full file contents are duplicated"],
								["Environment variables", "✅ Yes", "Encrypted env vars are copied as-is"],
								["Settings (RAM, timeout, tags…)", "✅ Yes", ""],
								["CORS origins", "✅ Yes", ""],
								["Docker mount / FFmpeg install", "✅ Yes", ""],
								["Secure header", "✅ Yes", ""],
								["Retry settings", "✅ Yes", ""],
								["Execution Alias", "❌ No", "Aliases must be globally unique — assign a new one after cloning"],
								["Git configuration", "❌ No", "VERSION // CONTROL settings are not transferred"],
								["Execution logs", "❌ No", "The clone starts with a clean log history"],
								["Triggers", "❌ No", "Re-create triggers manually on the clone if needed"],
							].map(([prop, copied, notes]) => (
								<tr key={prop} className="hover:bg-primary/5 transition-colors">
									<td className="px-4 py-2 font-medium text-primary/80">{prop}</td>
									<td className="px-4 py-2">{copied}</td>
									<td className="px-4 py-2 text-gray-400 text-xs">{notes}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* How to use */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">How to Clone a Function</h2>
				<ol className="list-decimal list-inside mb-6 text-text/90 space-y-3">
					<li>Open the function you want to clone.</li>
					<li>
						Click the <strong>Clone</strong> button in the toolbar. The{" "}
						<em>Clone Function</em> modal opens.
					</li>
					<li>
						<strong>New Name</strong> (optional) — enter a custom name for the
						clone. Leave blank to default to <code>original-name-copy</code>. If
						that name is already taken in the target namespace, SHSF automatically
						appends <code>-copy-1</code>, <code>-copy-2</code>, etc. until a
						unique name is found.
					</li>
					<li>
						<strong>Target Namespace</strong> — select the namespace to place the
						clone in. You can choose any namespace you own, including the source
						function's namespace.
					</li>
					<li>
						Click <strong>Clone</strong>. The clone is created immediately and you
						are redirected to the new function.
					</li>
				</ol>

				{/* Naming */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Name Collision Handling</h2>
				<p className="mb-4 text-text/90">
					SHSF guarantees that no two functions in the same namespace share the same
					name. If the requested name is already taken, the backend automatically
					finds the next available suffix:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`my-function        → already exists
my-function-copy   → already exists
my-function-copy-1 → ✅ used`}</code>
				</pre>
				<p className="mb-6 text-text/90">
					If you provide a custom name that is already taken, the same suffix logic
					applies to your custom name.
				</p>

				{/* Cross-namespace */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Cloning Across Namespaces</h2>
				<p className="mb-6 text-text/90">
					Selecting a different target namespace is a good way to promote a function
					between environments — for example from a <em>dev</em> namespace to a{" "}
					<em>prod</em> namespace. The clone is owned by the same user and the name
					uniqueness check is scoped to the target namespace, so a name that would
					collide in the source namespace may be available there.
				</p>

				{/* After cloning */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">After Cloning</h2>
				<p className="mb-4 text-text/90">
					A few things to check on the newly created clone:
				</p>
				<ul className="list-disc list-inside mb-6 text-text/90 space-y-2">
					<li>
						<strong>Execution Alias</strong> — not copied. Assign a new alias in the
						function settings if you need one.
					</li>
					<li>
						<strong>Triggers</strong> — not copied. Re-create any HTTP or scheduled
						triggers you need in the Triggers panel.
					</li>
					<li>
						<strong>Git configuration</strong> — not copied. Set up VERSION //
						CONTROL on the clone separately if it should track a repository.
					</li>
					<li>
						<strong>Environment variables</strong> — copied, but review them. If the
						original used environment-specific secrets, update them for the clone's
						context.
					</li>
				</ul>

				{/* API */}
				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">API / CLI Usage</h2>
				<p className="mb-4 text-text/90">
					You can also clone a function programmatically via the REST API or the
					CLI:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
					<code>{`POST /api/function/{id}/clone

{
  "name": "my-clone",       // optional
  "namespaceId": 3          // optional — defaults to source namespace
}`}</code>
				</pre>
				<p className="mb-4 text-text/90">Response:</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`{
  "status": "OK",
  "data": { "id": 42 }
}`}</code>
				</pre>
				<p className="mb-6 text-text/90">
					The returned <code>id</code> is the new function's ID. Authentication is
					required (cookie or API key header).
				</p>

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
							href="/docs/version-control"
							className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors text-sm"
						>
							VERSION // CONTROL →
						</a>
						<a
							href="/docs/kickoff"
							className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors text-sm"
						>
							KICKOFF →
						</a>
					</div>
				</div>
			</div>
		</div>
	);
};
