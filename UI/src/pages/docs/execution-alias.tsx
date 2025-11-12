import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const ExecutionAliasPage = () => {
  return (
    <div className="min-h-screen bg-background text-text p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <a href="/docs" className="text-sm text-blue-500 hover:underline">
            ← Back to Docs
          </a>
        </div>

        <ScrollProgressbar />

        <h1 className="text-3xl font-bold text-primary mb-2">Execution Aliases</h1>
        <p className="mt-3 text-lg text-text/90 mb-6">
          SHSF supports <b>execution aliases</b> for functions. An execution alias is a human-readable string you can assign to a function, making it easier to reference and invoke via API, CLI, or UI.
        </p>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">What is an Execution Alias?</h2>
        <p className="mb-4 text-text/90">
          An execution alias is an optional identifier (8-128 characters, alphanumeric, hyphens, underscores) that you can set when creating or updating a function. It allows you to invoke your function using a friendly URL or CLI argument, instead of a UUID.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-text/70 mb-2">Example (Python):</label>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
            <code>{`def main(args):
    return "Hello from an alias!"
            `}</code>
          </pre>
        </div>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">How to Set an Alias</h2>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li>In the UI, enter your desired alias in the <b>Execution Alias</b> field when creating or updating a function.</li>
          <li>In the CLI, set <code>executionAlias</code> in your <code>.meta.json</code> and sync.</li>
          <li>Aliases must be unique per function.</li>
        </ul>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">Invoking by Alias</h2>
        <p className="mb-4 text-text/90">
          You can now invoke functions using their alias via HTTP:
        </p>
        <div className="mb-6">
          <label className="block text-sm font-medium text-text/70 mb-2">Example (HTTP GET):</label>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
            <code>{`GET {API_URL}/exec/{executionAlias}
            `}</code>
          </pre>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-text/70 mb-2">Example (HTTP POST):</label>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
            <code>{`POST {API_URL}/exec/{executionAlias}
Content-Type: application/json
{ "key": "value" }
            `}</code>
          </pre>
        </div>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li>All permission checks and HTTP options apply as usual.</li>
          <li>Aliases are case-sensitive.</li>
        </ul>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">CLI Support</h2>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li>CLI metadata sync supports <code>executionAlias</code> for metadata updates.</li>
          <li>
            <b>Update Execution Alias:</b><br />
            <code className="block bg-muted p-2 rounded mb-2">shsf-cli --mode update-alias --project &lt;path&gt; --link &lt;functionId&gt; --alias &lt;newAlias&gt;</code>
            Updates the execution alias for a function via the API.
          </li>
          <li>
            <b>Run Function via Route:</b><br />
            <code className="block bg-muted p-2 rounded mb-2">shsf-cli --mode exec --project &lt;path&gt; --link &lt;functionId&gt; --route &lt;route&gt; [--method &lt;GET|POST&gt;] [--body &lt;json&gt;]</code>
            Invokes a function using the <code>/api/exec/&#123;namespaceId&#125;/&#123;functionId&#125;/&#123;route&#125;</code> endpoint. Pulls <code>namespaceId</code> and <code>executionId</code> from <code>.meta.json</code>.
          </li>
        </ul>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">Notes & Warnings</h2>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li>Aliases must be unique and follow the allowed pattern.</li>
          <li>If no alias is set, you must use the function UUID.</li>
          <li>Changing an alias may break existing integrations.</li>
        </ul>

        <div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
          <h2 className="text-xl font-bold text-primary mb-3">
            🚀 Next Step - FFmpeg Installation
          </h2>
          <p className="text-text/90 mb-4">
            Need to process video or audio files in your functions? Learn how to
            enable automatic FFmpeg installation for media processing capabilities.
          </p>
          <a
            href="/docs/ffmpeg-install"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            #19 FFmpeg Installation
            <span className="text-lg">→</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default ExecutionAliasPage;
