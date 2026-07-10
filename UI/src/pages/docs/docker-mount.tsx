import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const DockerMountPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Docker Socket Mount">
				Enable <strong>Mount Docker Socket</strong> to bind{" "}
				<code>/var/run/docker.sock</code> from the host into your function's
				container. This grants the function full programmatic control over
				Docker on the host.
			</DocHeader>

			<Callout variant="danger" title="Major security risk — use with extreme care">
				<p>
					Any code running in the function can start, stop, delete, or
					reconfigure containers and images on the host. Malicious or buggy code
					could compromise the entire host system. Only enable this for functions
					whose code you fully trust and control.
				</p>
			</Callout>

			<h2>What it enables</h2>
			<ul>
				<li>
					Running Docker CLI commands from inside the function (
					<code>docker ps</code>, <code>docker run</code>, etc.)
				</li>
				<li>Orchestrating sibling containers as part of a workflow</li>
				<li>Executing commands inside a running container via <code>exec_run</code></li>
				<li>Building and pushing Docker images dynamically</li>
				<li>Inspecting container logs, health, and resource usage</li>
			</ul>

			<h2>How to enable</h2>
			<p>
				When creating or updating a function, expand the{" "}
				<strong>Advanced Settings</strong> section and toggle{" "}
				<strong>Mount Docker Socket</strong> on.
			</p>
			<Callout variant="note" title="Requires admin permission">
				<p>
					An SHSF administrator may need to grant your account permission to use
					the Docker mount feature. If the toggle is missing or disabled, contact
					your instance admin.
				</p>
			</Callout>

			<h2>Example — executing a command in another container</h2>
			<CodeCaption>Python — using the docker SDK</CodeCaption>
			<pre>
				<code>{`def main(args):
    import docker
    client = docker.from_env()

    # Run a command inside an existing container
    container = client.containers.get("my-mailserver")
    result = container.exec_run("postfix status")
    output = result.output.decode("utf-8")

    return {"output": output, "exit_code": result.exit_code}`}</code>
			</pre>
			<p>
				Add <code>docker</code> to your <code>requirements.txt</code> to install
				the Python Docker SDK.
			</p>

			<h2>Example — listing running containers</h2>
			<CodeCaption>Python</CodeCaption>
			<pre>
				<code>{`def main(args):
    import docker
    client = docker.from_env()
    containers = client.containers.list()
    return {
        "running": [c.name for c in containers]
    }`}</code>
			</pre>

			<h2>Security checklist</h2>
			<ul>
				<li>
					Do not expose functions with Docker mount enabled via public HTTP
					without strong authentication (secure headers, access tokens, or guest
					users).
				</li>
				<li>
					Audit every code change to a Docker-mounted function before deploying.
				</li>
				<li>
					For most use cases, Docker mount is not necessary — prefer environment
					variables or the built-in storage helpers.
				</li>
			</ul>

			<NextStep href="/docs/serve-only" label="#11 Serve Only HTML">
				Next: an even simpler mode — serve a single static HTML file without
				any runtime at all.
			</NextStep>
		</DocsContentShell>
	);
};
