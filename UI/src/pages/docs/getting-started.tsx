import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const DocsGettingStarted = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Getting Started">
				SHSF (SelfHostable Serverless Functions) runs as a single{" "}
				<code>docker compose</code> stack. This guide gets you from a clean
				machine to a running instance with your first account.
			</DocHeader>

			<Callout variant="warning" title="Before you start">
				<p>
					SHSF needs a <strong>MySQL/MariaDB database</strong> and a{" "}
					<strong>Docker host</strong>. Functions run as sibling containers on
					the host's Docker daemon, so the backend needs access to{" "}
					<code>/var/run/docker.sock</code> (already wired up in the provided{" "}
					<code>docker-compose.yml</code>).
				</p>
			</Callout>

			<h2>1. Clone the repository</h2>
			<pre>
				<code>git clone https://github.com/Space-Banane/shsf && cd shsf</code>
			</pre>

			<h2>2. Configure your environment</h2>
			<p>
				Copy the example environment file and edit it to match your setup. Every
				variable below is read by the backend on startup — invalid or missing
				required values will stop the server with a clear error.
			</p>
			<pre>
				<code>cp example.env .env</code>
			</pre>

			<CodeCaption>.env — the values that ship in example.env</CodeCaption>
			<pre>
				<code>{`# API server port
PORT=5000

# Database connection string (MariaDB/MySQL)
DATABASE_URL=mysql://user:password@db:3306/shsf

# Domain name for your deployment
DOMAIN=shsf.example.com

# Public UI URL
UI_URL=http://localhost:5000

# API URL the UI connects to (usually the same origin as UI_URL)
REACT_APP_API_URL=http://localhost:5000

# Comma-separated list of allowed CORS origins
CORS_URLS=http://localhost:5000,https://shsf.example.com

# Global request rate limit window, in milliseconds (0 = disabled)
RATELIMIT=5000

# Used to encrypt secrets at rest (e.g. git tokens). Generate with:
#   openssl rand -hex 32
INSTANCE_SECRET=changeme_replace_with_a_random_32_byte_hex_string`}</code>
			</pre>

			<h3>What each variable does</h3>
			<ul>
				<li>
					<strong>PORT</strong> — port the backend (and, in the Docker build, the
					UI) listens on.
				</li>
				<li>
					<strong>DATABASE_URL</strong> — connection string for your MySQL/MariaDB
					instance. Replace user, password, host, port and database name.
				</li>
				<li>
					<strong>DOMAIN</strong> — primary hostname of your deployment; used for
					cookies and generated links.
				</li>
				<li>
					<strong>UI_URL</strong> / <strong>REACT_APP_API_URL</strong> — public
					URLs for the app and API. In the bundled Docker deployment both are
					served from the same origin.
				</li>
				<li>
					<strong>CORS_URLS</strong> — comma-separated origins allowed to call the
					API. Include your UI URL and any trusted front-ends.
				</li>
				<li>
					<strong>RATELIMIT</strong> — global request rate-limit window in
					milliseconds. Set to <code>0</code> to disable. (Per-function execution
					limits are configured separately in the function settings.)
				</li>
				<li>
					<strong>INSTANCE_SECRET</strong> — 32-byte hex secret used to encrypt
					sensitive data at rest (such as git credentials). Never share it.
				</li>
			</ul>

			<Callout variant="danger" title="Change INSTANCE_SECRET before production">
				<p>
					The default value (<code>default_insecure_secret_please_set</code>) is{" "}
					<strong>insecure</strong>. Generate a real one with{" "}
					<code>openssl rand -hex 32</code>. Changing it later will invalidate any
					git credentials that were already encrypted.
				</p>
			</Callout>

			<h2>3. Set up the database</h2>
			<p>
				Point <code>DATABASE_URL</code> at your own MariaDB/MySQL server, or
				uncomment the <code>database</code> service in{" "}
				<code>docker-compose.yml</code> to run one alongside SHSF. Migrations are
				applied automatically on startup.
			</p>

			<h2>4. Start the stack</h2>
			<pre>
				<code>docker compose up -d</code>
			</pre>
			<Callout variant="success" title="Give it a moment">
				<p>
					The first boot pulls images, runs database migrations, and starts the
					API. Once it's up, open <code>http://localhost:5000</code> (or your{" "}
					<code>UI_URL</code>) — if you see the SHSF interface, you're ready.
				</p>
			</Callout>

			<h2>5. Create your account &amp; lock down registration</h2>
			<p>
				Registration is <strong>open by default</strong> so you can create the
				first account. Once you have, open the <strong>Admin Panel</strong> and
				disable open registration under the access settings.
			</p>
			<Callout variant="note" title="Access controls live in the Admin Panel">
				<p>
					Registration, guest access, and external access are runtime settings
					managed from the Admin Panel — <em>not</em> environment variables. This
					lets you toggle them without restarting the stack.
				</p>
			</Callout>

			<h2>Updating SHSF</h2>
			<p>
				Pull the latest images and restart the stack. SHSF can also check for and
				apply updates from the Admin Panel.
			</p>
			<pre>
				<code>{`git pull
docker compose pull
docker compose up -d`}</code>
			</pre>
			<Callout variant="warning" title="Back up first">
				<p>
					Always back up your database and <code>.env</code> before updating.
					Migrations run automatically and are not designed to be rolled back.
				</p>
			</Callout>

			<NextStep href="/docs/my-first-function" label="#1 My First Function">
				SHSF is running — now let's build something. Next up: a function that
				posts "Happy Monday" to a Discord webhook every Monday at midnight.
			</NextStep>
		</DocsContentShell>
	);
};
