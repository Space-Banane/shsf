import { DocsContentShell } from "./DocsContentShell";
import { Callout, DocHeader, NextStep } from "./_components";

export const GuestUsersDocPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Guest Users">
				Guest users are lightweight credentials you create and attach to a
				specific function. Once at least one guest user exists on a function,
				all callers are required to authenticate — either with those guest
				credentials, a secure header, or an access token.
			</DocHeader>

			<Callout variant="warning" title="Authentication becomes required once a guest user is added">
				<p>
					Adding a guest user to a function enables authentication enforcement.
					Public/unauthenticated callers will be prompted for credentials. Make
					sure this is intentional before adding the first guest user.
				</p>
			</Callout>

			<h2>Why use guest users?</h2>
			<ul>
				<li>
					<strong>Granular access control</strong> — give a collaborator or
					client access to one specific function without an SHSF account.
				</li>
				<li>
					<strong>No full account exposure</strong> — guest credentials only
					unlock their assigned function, nothing else.
				</li>
				<li>
					<strong>Easy to revoke</strong> — delete a guest user and their access
					is immediately gone.
				</li>
			</ul>

			<h2>Creating a guest user</h2>
			<ol>
				<li>Open your function and go to the <strong>Guest Users</strong> tab.</li>
				<li>Click <strong>Create Guest User</strong>.</li>
				<li>
					Enter an email address, display name, and a strong password. These
					are the credentials the guest will use to authenticate.
				</li>
				<li>Click <strong>Create</strong>.</li>
			</ol>

			<h2>How authentication works</h2>
			<p>
				When a caller accesses a function that has guest users, SHSF checks for
				one of the following (in order):
			</p>
			<ol>
				<li>
					<strong>Function owner request</strong> (via SHSF session) — always
					permitted.
				</li>
				<li>
					<strong><code>x-access-key</code> header</strong> — a valid access
					token from the function owner bypasses the guest check.
				</li>
				<li>
					<strong><code>x-secure-header</code></strong> — if configured, a
					matching secure header value is accepted.
				</li>
				<li>
					<strong>Guest credentials</strong> — the caller is prompted for the
					guest email and password.
				</li>
			</ol>

			<h2>Managing guest users</h2>
			<ul>
				<li>
					View all guest users for a function in the{" "}
					<strong>Guest Users</strong> tab.
				</li>
				<li>
					Delete a guest user to immediately revoke their access.
				</li>
				<li>
					You can have multiple guest users per function — useful for different
					collaborators or environments.
				</li>
			</ul>

			<h2>Best practices</h2>
			<ul>
				<li>Use strong, unique passwords for each guest user.</li>
				<li>
					Don't share a single guest account between multiple people — create
					individual accounts so you can revoke access per-person.
				</li>
				<li>
					Review guest user assignments periodically and remove accounts that
					are no longer needed.
				</li>
			</ul>

			<NextStep href="/docs/execution-alias" label="#18 Execution Alias">
				Next: replace the UUID in your function's invocation URL with a
				human-readable alias.
			</NextStep>
		</DocsContentShell>
	);
};
