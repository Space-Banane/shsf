import React from "react";
import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const DockerMountPage = () => {
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
          Docker Socket Mount
        </h1>

        <p className="mt-3 text-lg text-text/90 mb-6">
          <span className="font-bold text-yellow-400">Warning:</span> Enabling
          the <b>Docker Socket Mount</b> option will mount{" "}
          <code>/var/run/docker.sock</code> from the host into your function's
          container.{" "}
          <span className="text-yellow-300 font-semibold">
            This grants the function full control over Docker on the host, which
            is a <span className="text-red-400">major security risk</span>!
          </span>
        </p>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          What is Docker Socket Mount?
        </h2>
        <p className="mb-4 text-text/90">
          When enabled, your function can communicate with the Docker daemon on
          the host. This allows advanced use cases such as running sibling
          containers, inspecting Docker resources, or building images from
          within your function.
        </p>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          How to Enable
        </h2>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li>
            When creating or updating a function, toggle the{" "}
            <b>Mount Docker Socket</b> option in the advanced settings section
            of the modal.
          </li>
          <li>
            This will mount <code>/var/run/docker.sock</code> into the container
            at the same path.
          </li>
        </ul>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          Example Use Cases
        </h2>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li>
            Running Docker CLI commands from your function (e.g.,{" "}
            <code>docker ps</code>, <code>docker run</code>).
          </li>
          <li>Orchestrating other containers as part of a workflow.</li>
          <li>Building and pushing Docker images dynamically.</li>
        </ul>

        <h3 className="text-xl font-semibold text-primary mt-8 mb-2">
          Example: Using Docker Socket in Python
        </h3>
        <div className="mb-8">
          <pre className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white rounded-lg p-6 overflow-x-auto text-sm shadow-lg">
            {`def main(args):
    import docker
    client = docker.from_env()

    # Exec container "mailserver"
    out = client.containers.get("mailserver").exec_run("setup email list")
    return out.output.decode()
`}
          </pre>
          <p className="text-text/80 mt-2">
            This example shows how your function can use the <code>docker</code>{" "}
            Python library to execute a command inside a running container when
            the Docker socket is mounted.
          </p>
        </div>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          Security Implications
        </h2>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li className="text-red-400 font-semibold">
            Any code running in the function can control Docker on the host,
            including starting, stopping, or deleting containers and images.
          </li>
          <li>
            Malicious or buggy code could compromise the entire host system.
          </li>
          <li>
            Only enable this option if you fully trust the function's code and
            understand the risks.
          </li>
        </ul>

        <div className="mt-12 p-6 bg-gradient-to-r from-yellow-900/20 to-red-900/20 border border-yellow-600/30 rounded-xl">
          <h2 className="text-xl font-bold text-yellow-400 mb-3">
            ⚠️ Use With Extreme Caution
          </h2>
          <p className="text-text/90 mb-4">
            The Docker socket is a powerful but dangerous tool. For most use
            cases, <b>do not enable</b> this option unless absolutely necessary.
          </p>
        </div>

        <div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
          <h2 className="text-xl font-bold text-primary mb-3">
            🚀 Next Step - Serve Only HTML
          </h2>
          <p className="text-text/90 mb-4">
            Ever wanted to only serve an html file from your function? Check out
            our guide on serving ONLY an HTML file.
          </p>
          <a
            href="/docs/serve-only"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            #11 Serve Only HTML
            <span className="text-lg">→</span>
          </a>
        </div>
      </div>
    </div>
  );
};
