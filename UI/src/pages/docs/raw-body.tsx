import React from "react";

export const RawBodyPage = () => {
  return (
    <div className="min-h-screen bg-background text-text p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <a href="/docs" className="text-sm text-blue-500 hover:underline">
            ← Back to docs
          </a>
        </div>

        <h1 className="text-3xl font-bold text-primary mb-2">Raw Body Handling</h1>

        <p className="mt-3 text-lg text-text/90 mb-6">
          When your function receives a request with a binary payload (such as file uploads or audio), the raw body is available in <code>args.raw_body</code>. This is useful for handling data that isn't standard JSON, like files or binary streams.
        </p>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">Accessing the Raw Body</h2>
        <p className="mb-4 text-text/90">
          <code>args.raw_body</code> contains the raw request body as bytes (or a string, depending on the client). You can process it directly for custom parsing, file handling, or binary protocols.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-text/70 mb-2">
            Example (Verbose, Not Recommended):
          </label>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
            <code>{`raw_body = args.get("raw_body")
if raw_body is None:
    return {"_code": 400, "error": "no raw body provided", "_shsf": "v2"}

# Convert to bytes if it's a string
if isinstance(raw_body, str):
    body_bytes = raw_body.encode('latin-1')
else:
    body_bytes = raw_body

# ...multipart parsing logic...
`}</code>
          </pre>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-text/70 mb-2">
            Example (Recommended):
          </label>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
            <code>{`raw_body = args.get("raw_body")
if raw_body is None:
    return {"_code": 400, "error": "no raw body provided"}

# Save raw bytes to a file
with open("upload.bin", "wb") as f:
    f.write(raw_body if isinstance(raw_body, bytes) else raw_body.encode("latin-1"))

return {"_code": 200, "message": "File saved", "_shsf": "v2"}
`}</code>
          </pre>
        </div>

        <ul className="list-disc list-inside mb-4 text-text/90">
          <li><code>args.raw_body</code> is useful for file uploads, audio, or any binary data.</li>
          <li>Always check for <code>None</code> before using <code>raw_body</code>.</li>
          <li>Convert to <code>bytes</code> if needed using <code>encode('latin-1')</code>.</li>
        </ul>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">Use Cases</h2>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li>Handling file uploads (images, audio, etc.)</li>
          <li>Processing binary protocols or custom data formats</li>
          <li>Saving raw request data for later analysis</li>
        </ul>

        <div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
          <h2 className="text-xl font-bold text-primary mb-3">
            🚀 Next Step - User Interfaces
          </h2>
          <p className="text-text/90 mb-4">
            Let's also take a look at how we can serve HTML files as user interfaces from our functions.
          </p>
          <a
            href="/docs/user-interfaces"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            #9 User Interfaces
            <span className="text-lg">→</span>
          </a>
        </div>
      </div>
    </div>
  );
};
