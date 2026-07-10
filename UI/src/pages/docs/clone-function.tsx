import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const DocsCloneFunction = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Cloning Functions">
				Cloning creates a full, independent copy of a function — its runtime,
				settings, environment variables, and every file in the file manager.
				Edits to the clone never affect the original.
			</DocHeader>

			<h2>How to clone</h2>
			<ol>
				<li>Open the function you want to clone.</li>
				<li>
					Click the <strong>Clone</strong> button in the function toolbar. The{" "}
					<em>Clone Function</em> modal opens.
				</li>
				<li>
					<strong>New Name</strong> (optional) — enter a custom name or leave
					blank to default to <code>original-name-copy</code>.
				</li>
				<li>
					<strong>Target Namespace</strong> — select any namespace you own,
					including the source function's namespace.
				</li>
				<li>
					Click <strong>Clone</strong>. You are redirected to the new function
					immediately.
				</li>
			</ol>

			<h2>What gets copied</h2>
			<div className="overflow-x-auto my-4">
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
							["Name", "✅ Yes (modified)", "Appended with -copy, or use a custom name"],
							["Description", "✅ Yes", ""],
							["Runtime image", "✅ Yes", "e.g. python:3.12, golang:1.23"],
							["Startup file", "✅ Yes", ""],
							["All function files", "✅ Yes", "Full file contents duplicated"],
							["Environment variables", "✅ Yes", "Encrypted vars copied as-is"],
							["Settings (RAM, timeout, tags…)", "✅ Yes", ""],
							["CORS origins", "✅ Yes", ""],
							["Docker mount / FFmpeg / OpenCV", "✅ Yes", ""],
							["Secure header", "✅ Yes", ""],
							["Retry settings", "✅ Yes", ""],
							["Execution alias", "❌ No", "Aliases must be globally unique — assign a new one after cloning"],
							["Git configuration", "❌ No", "VERSION // CONTROL settings are not transferred"],
							["Execution logs", "❌ No", "Clone starts with a clean log history"],
							["Triggers", "❌ No", "Re-create triggers manually on the clone if needed"],
						].map(([prop, copied, notes]) => (
							<tr key={prop} className="hover:bg-primary/5">
								<td className="px-4 py-2 font-medium text-primary/80">{prop}</td>
								<td className="px-4 py-2">{copied}</td>
								<td className="px-4 py-2 text-text/50 text-xs">{notes}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<h2>Name collision handling</h2>
			<p>
				If the requested name is already taken in the target namespace, SHSF
				automatically finds the next available suffix:
			</p>
			<CodeCaption>Auto-suffix logic</CodeCaption>
			<pre>
				<code>{`my-function        → already exists
my-function-copy   → already exists
my-function-copy-1 → ✅ used`}</code>
			</pre>
			<p>The same suffix logic applies to custom names you provide.</p>

			<h2>Cross-namespace cloning</h2>
			<p>
				Selecting a different target namespace is a good way to promote a
				function between environments — for example from a <em>dev</em>{" "}
				namespace to a <em>prod</em> namespace. Name uniqueness is scoped to the
				target namespace, so a name that would collide in the source namespace
				may be available there.
			</p>

			<h2>After cloning — checklist</h2>
			<ul>
				<li>
					<strong>Execution alias</strong> — not copied. Assign a new alias if
					needed.
				</li>
				<li>
					<strong>Triggers</strong> — not copied. Re-create any HTTP or
					scheduled triggers in the Triggers panel.
				</li>
				<li>
					<strong>Git configuration</strong> — not copied. Set up VERSION //
					CONTROL on the clone separately if required.
				</li>
				<li>
					<strong>Environment variables</strong> — copied, but review them. If
					the original used environment-specific secrets, update the clone's
					values for its context.
				</li>
			</ul>

			<h2>API / CLI</h2>
			<CodeCaption>REST API — POST /api/function/&#123;id&#125;/clone</CodeCaption>
			<pre>
				<code>{`POST /api/function/{id}/clone

{
  "name":        "my-clone",   // optional; defaults to original-name-copy
  "namespaceId": 3             // optional; defaults to source namespace
}`}</code>
			</pre>
			<CodeCaption>Response</CodeCaption>
			<pre>
				<code>{`{ "status": "OK", "data": { "id": 42 } }`}</code>
			</pre>
			<p>
				The returned <code>id</code> is the new function's ID. Authentication
				is required (session cookie or <code>x-access-key</code> header).
			</p>

			<Callout variant="note" title="CLI clone command">
				<p>
					The shsf-cli does not yet have a dedicated <code>clone</code> command.
					Use the REST API or the UI for cloning.
				</p>
			</Callout>

			<NextStep href="/docs/opencv-install" label="#25 OpenCV Installation">
				Next: enable automatic OpenCV installation for computer vision
				workloads in your Python functions.
			</NextStep>
		</DocsContentShell>
	);
};
