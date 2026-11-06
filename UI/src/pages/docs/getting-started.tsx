import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader } from "./_components";

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
				<code>git clone https://gitea.reversed.dev/shsf/shsf.git && cd shsf</code>
			</pre>

			<h2>2. Configure your environment</h2>
			<p>
				Copy the example environment file and edit it to match your setup. Every
				variable below is read by the backend on startup — invalid or missing
				required values will stop the server with a clear error.
			</p>
			<pre>
				<code>{`cp example.env .env
sed -i.bak "s/^INSTANCE_SECRET=.*/INSTANCE_SECRET=$(openssl rand -hex 32)/" .env && rm .env.bak`}</code>
			</pre>
			<p>
				The second command writes a random <code>INSTANCE_SECRET</code>, which
				production requires. The other defaults work for{" "}
				<code>http://localhost:5000</code>.
			</p>

			<CodeCaption>.env — the values that ship in example.env</CodeCaption>
			<pre>
				<code>{`# API server port
PORT=5000

# Database connection string (MariaDB/MySQL)
DATABASE_URL=mysql://user:password@db:3306/shsf

# Cookie domain. Use "localhost" locally; set your real hostname when deploying.
DOMAIN=localhost

# Public UI URL
UI_URL=http://localhost:5000

# API URL the UI connects to (usually the same origin as UI_URL)
REACT_APP_API_URL=http://localhost:5000

# Comma-separated list of allowed CORS origins
CORS_URLS=http://localhost:5000

# Global request rate limit window, in milliseconds (0 = disabled)
RATELIMIT=5000

# Used to encrypt secrets at rest (e.g. git tokens). Generate with:
#   openssl rand -hex 32
INSTANCE_SECRET=

# Enable only for a public, disposable demo instance. Seeds demo@shsf.local
# with password demo-password plus a runnable sample function.
IS_DEMO=false`}</code>
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
					<strong>INSTANCE_SECRET</strong> — a secret of at least 32 characters used to
					encrypt sensitive data at rest (such as git credentials). Use a 32-byte hex
					value from <code>openssl rand -hex 32</code> and never share it.
				</li>
				<li>
					<strong>IS_DEMO</strong> — leave <code>false</code> for real instances.
					<code>true</code> seeds a public demo account and is only for disposable demos.
				</li>
			</ul>
			<p>
				Optional: <code>OPENROUTER_API_KEY</code> (instance-wide key for log
				analysis) and <code>LOG_LEVEL</code> (default <code>info</code>).
			</p>

			<Callout variant="danger" title="Change INSTANCE_SECRET before production">
				<p>
					Production startup rejects a missing secret, the default value ({" "}
					<code>default_insecure_secret_please_set</code>), and values shorter than 32
					characters. Generate one with <code>openssl rand -hex 32</code>. Changing it
					later will invalidate any git credentials that were already encrypted.
				</p>
			</Callout>

			<h2>3. Set up the database</h2>
			<p>
				Point <code>DATABASE_URL</code> at your own MariaDB/MySQL server, or
				start the bundled <code>db</code> service with{" "}
				<code>--profile db</code> (next step); its credentials match the default{" "}
				<code>DATABASE_URL</code> (host <code>db</code>) and the backend waits for it to
				be healthy. Migrations are applied automatically on startup.
			</p>

			<h2>4. Start the stack</h2>
			<pre>
				<code>{`docker compose --profile db up -d   # bundled MariaDB
docker compose up -d                # external database`}</code>
			</pre>
			<Callout variant="success" title="Give it a moment">
				<p>
					The first boot pulls images, runs database migrations, and starts the
					API. Once it's up, open <code>http://localhost:5000</code> (or your{" "}
					<code>UI_URL</code>) — if you see the SHSF interface, you're ready.
				</p>
			</Callout>

			<h2>API reference</h2>
			<p>
				Your instance publishes its OpenAPI document at{" "}
				<code>/api/openapi.json</code>. Open{" "}
				<code>http://localhost:5000/api/openapi.json</code> locally, or append
				that path to your public <code>UI_URL</code>.
			</p>

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

			<h2>Next steps</h2>
			<p>
				Build and schedule a function in{" "}
				<a href="/docs/my-first-function" className="text-blue-400 hover:text-blue-300">My First Function</a>.
				If something fails, see{" "}
				<a href="/docs/troubleshooting" className="text-blue-400 hover:text-blue-300">Troubleshooting</a>.
			</p>

			<h2>Updating SHSF</h2>
			<p>
				Pull the latest images and restart the stack. SHSF can also check for and
				apply updates from the Admin Panel.
			</p>
			<pre>
				<code>{`git pull
docker compose pull
docker compose up -d   # add --profile db if you use the bundled database`}</code>
			</pre>
			<Callout variant="warning" title="Back up first">
				<p>
					Always back up your database and <code>.env</code> before updating.
					Migrations run automatically and are not designed to be rolled back.
				</p>
			</Callout>

		</DocsContentShell>
	);
};
