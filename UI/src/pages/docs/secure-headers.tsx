import React from "react";

export const SecureHeadersPage = () => {
  return (
    <div className="min-h-screen bg-background text-text p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <a href="/docs" className="text-sm text-blue-500 hover:underline">
            ← Back to docs
          </a>
        </div>

        <h1 className="text-3xl font-bold text-primary mb-2">
          Secure Headers (x-secure-header)
        </h1>

        <p className="mt-3 text-lg text-text/90 mb-6">
          When the "secure headers" setting is enabled, clients must include the
          x-secure-header HTTP header on requests to your function. The platform
          validates this header before invoking your function and will reject
          requests that are missing or invalid. SHSF will not reject a request when made from the functions owner, via the UI.
        </p>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          When to include it
        </h2>
        <p className="mb-4 text-text/90">
          If your function has the secure-headers setting turned on (check the
          dashboard or function settings), every request to the function endpoint
          must include:
        </p>
        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
          <code>{`x-secure-header: <your-secure-value>`}</code>
        </pre>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">Client examples</h2>
        <p className="mb-3 text-text/90">
          Replace &lt;your-secure-value&gt; with the token shown in your function
          settings or the value provided by your deployment.
        </p>

        <h3 className="text-xl font-semibold text-primary mb-2">curl</h3>
        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
          <code>{`curl -H "x-secure-header: <your-secure-value>" https://your-function-endpoint`}</code>
        </pre>

        <h3 className="text-xl font-semibold text-primary mb-2">fetch (browser / node)</h3>
        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
          <code>{`fetch("https://your-function-endpoint", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-secure-header": "<your-secure-value>"
  },
  body: JSON.stringify({ foo: "bar" })
})`}</code>
        </pre>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">Server / function - reading the header</h2>
        <p className="mb-3 text-text/90">
          You do not need to read or validate the header in your function code; the
          platform performs this check before invocation. However, if you want to
          access the header value for logging or other purposes, here's how you can do it.
        </p>

        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
          <code>{`def main(args):
    # Many runtimes provide headers as a dict on the event/context.
    headers = args.get("headers", {})  # adjust to your runtime if different
    token = headers.get("x-secure-header")

    if not token or token != "<your-secure-value>":
        return {"_shsf": "v2", "_code": 403, "_res": {"state": False, "error": "missing or invalid x-secure-header"}}

    # continue normal processing
    return {"_shsf": "v2", "_code": 200, "_res": {"state": True}}`}</code>
        </pre>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">Notes</h2>
        <ul className="list-disc pl-6 mb-6 text-text/90">
          <li>Do not hard-code secrets in client-side code for public apps. Use <a href="/docs/environment-variables">environment variables</a> instead.</li>
          <li>
            The exact header forwarding object name can vary by runtime; if
            headers aren't available on args, consult the runtime docs for how
            to access raw request headers.
          </li>
          <li>
            The platform performs validation before invocation — functions can
            also re-check the header for defense-in-depth.
          </li>
        </ul>

        <div className="mt-8 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
          <h2 className="text-xl font-bold text-primary mb-3">
            Check back when we have more docs!
          </h2>
            <p className="text-text/90">
              Stay tuned!
            </p>
        </div>
      </div>
    </div>
  );
};
