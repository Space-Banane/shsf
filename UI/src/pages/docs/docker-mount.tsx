import React from "react";

export const DockerMountPage = () => {
  return (
    <div className="min-h-screen bg-background text-text p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <a href="/docs" className="text-sm text-blue-500 hover:underline">
            ← Back to docs
          </a>
        </div>

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
            Keep your instance up to date for the latest docs!
          </h2>
          <p className="text-text/90 mb-4">
            Check back here for new documentation updates as they become
            available.
          </p>
        </div>
      </div>
    </div>
  );
};
