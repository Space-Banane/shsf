import React from "react";

export const ServeOnlyHtmlPage = () => {
  return (
    <div className="min-h-screen bg-background text-text p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <a href="/docs" className="text-sm text-blue-500 hover:underline">
            ← Back to docs
          </a>
        </div>
        <h1 className="text-3xl font-bold text-primary mb-2">
          Serve Only HTML
        </h1>
        <p className="mt-3 text-lg text-text/90 mb-6">
          SHSF allows you to create a function that serves{" "}
          <b>only a single HTML file</b> as its response. This disables most
          dynamic features and is ideal for static landing pages, maintenance
          notices, or simple documentation.
        </p>
        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          How to Enable Serve Only HTML
        </h2>
        <ol className="list-decimal list-inside mb-4 text-text/90 space-y-2">
          <li>
            <b>Create a new function</b> (or edit an existing one).
          </li>
          <li>
            In the file editor, <b>delete all files except your HTML file</b>{" "}
            (e.g., <code>index.html</code>).
          </li>
          <li>
            <b>Set your HTML file as the startup file</b> in the function
            settings (e.g., set <code>index.html</code> as the entry/startup
            file).
          </li>
        </ol>
        <span className="text-green-600 font-semibold">Boom!</span> SHSF
        automatically detects serve-only mode and serves your HTML file.
        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          Example: Minimal HTML Function
        </h2>
        <div className="mb-8">
          <pre className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white rounded-lg p-6 overflow-x-auto text-sm shadow-lg">
            {`<!-- index.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>My Static Page</title>
  </head>
  <body>
    <h1>Hello from SHSF!</h1>
    <p>This function serves only this HTML file.</p>
  </body>
</html>
`}
          </pre>
          <p className="text-text/80 mt-2">
            Create your HTML file, set it as the startup file, and boom you're
            done!
          </p>
        </div>
        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          What Features Are Disabled?
        </h2>
        <p className="mb-4 text-text/90">
          Almost all of them. Check in the UI on what is enabled and what is not.
        </p>
        <div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
          <h2 className="text-xl font-bold text-primary mb-3">
            🚀 Next Step - Access Tokens
          </h2>
          <p className="text-text/90 mb-4">
            Learn how to generate and use API access tokens for secure automation and integrations.
          </p>
          <a
            href="/docs/access-tokens"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            #12 Access Tokens
            <span className="text-lg">→</span>
          </a>
        </div>
      </div>
    </div>
  );
};
