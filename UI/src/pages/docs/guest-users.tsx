import { DocsContentShell } from "./DocsContentShell";
import { Callout, DocHeader, NextStep } from "./_components";

export const GuestUsersDocPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Guest Users">
				Guest users are lightweight credentials you create and attach to a
				specific function. Once guest users are configured on a function,
				only callers with valid guest credentials can invoke it over HTTP —
				API keys and secure headers do not bypass this requirement.
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
				When <code>guest_access</code> is enabled (i.e. at least one guest user
				exists), SHSF's execution middleware enforces the following rule on every
				request to <code>/exec/</code>:
			</p>
			<ol>
				<li>
					Any prior permission state — including a valid{" "}
					<code>x-access-key</code> API token or a correct{" "}
					<code>x-secure-header</code> — is <strong>overridden</strong>.
					Permission is reset to denied.
				</li>
				<li>
					<strong>Only a valid guest session cookie</strong> can restore access.
					The guest user must have logged in with their email and password to
					obtain this cookie.
				</li>
			</ol>
			<Callout variant="warning" title="API keys do not bypass guest access">
				<p>
					Unlike most other authentication checks, guest access cannot be
					bypassed with an <code>x-access-key</code> access token or a correct{" "}
					<code>x-secure-header</code> value. The only valid credential is a
					guest user session cookie. Function owners can still invoke the
					function from the SHSF dashboard, which uses a separate execution
					endpoint unaffected by this check.
				</p>
			</Callout>

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
