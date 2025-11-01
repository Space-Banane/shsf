import React from "react";

export const AccessTokensDocPage = () => {
  return (
    <div className="min-h-screen bg-background text-text p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <a href="/docs/serve-only" className="text-sm text-blue-500 hover:underline">
            ← Back to Serve Only HTML
          </a>
        </div>
        <h1 className="text-3xl font-bold text-primary mb-2">Access Tokens</h1>
        <p className="mt-3 text-lg text-text/90 mb-6">
          Access Tokens allow you to securely authenticate API requests and automate access to your SHSF account without using your password. This is ideal for CLI tools, scripts, or third-party integrations.
        </p>

        <h2 className="text-2xl font-bold text-primary mt-8 mb-4">What are Access Tokens?</h2>
        <p className="mb-4 text-text/90">
          Access Tokens are unique, secret keys you can generate and manage from your account. Each token can have a name, purpose, and optional expiration date. Tokens are only shown <b>once</b> when created—store them securely!
        </p>

        <h2 className="text-2xl font-bold text-primary mt-8 mb-4">How to Generate a Token</h2>
        <ol className="list-decimal list-inside mb-4 text-text/90 space-y-2">
          <li>Go to <b>Account &gt; Access Tokens</b> in the UI.</li>
          <li>Click <b>Generate New Token</b>.</li>
          <li>Enter a name, optional purpose, and set expiration (or choose never expire).</li>
          <li>Click <b>Generate Token</b> and copy the token shown. <span className="text-red-400 font-semibold">You won't be able to see it again!</span></li>
        </ol>

        <h2 className="text-2xl font-bold text-primary mt-8 mb-4">Using Access Tokens</h2>
        <p className="mb-4 text-text/90">
          To authenticate API requests, include your token in the <code>x-access-key</code> header:
        </p>
        <div className="mb-6">
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
            <code>{`curl -H "x-access-key: YOUR_TOKEN_HERE" https://your-shsf-instance/api/your-endpoint`}</code>
          </pre>
        </div>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li>Never share your tokens publicly.</li>
          <li>Tokens can be revoked at any time from the UI.</li>
          <li>Expired tokens cannot be used for authentication.</li>
        </ul>

        <h2 className="text-2xl font-bold text-primary mt-8 mb-4">Managing Tokens</h2>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li><b>View</b> all your tokens (masked) in the Access Tokens page.</li>
          <li><b>Edit</b> the name or purpose of a token.</li>
          <li><b>Revoke</b> (delete) tokens you no longer need.</li>
        </ul>

        <h2 className="text-2xl font-bold text-primary mt-8 mb-4">Example: Using a Token in Python</h2>
        <div className="mb-8">
          <pre className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white rounded-lg p-6 overflow-x-auto text-sm shadow-lg">
{`import requests

url = "https://your-shsf-instance/api/your-endpoint"
headers = {"x-access-key": "YOUR_TOKEN_HERE"}
response = requests.get(url, headers=headers)
print(response.json())
`}
          </pre>
        </div>

        <div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
          <h2 className="text-xl font-bold text-primary mb-3">
            Keep your instance up to date for the latest docs!
          </h2>
          <p className="text-text/90 mb-4">
            This is the latest documentation page. Check back here for new updates as they become available.
          </p>
        </div>
      </div>
    </div>
  );
};
