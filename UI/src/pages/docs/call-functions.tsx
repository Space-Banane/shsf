import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader } from "./_components";

export const CallFunctionsDocPage = () => (
	<DocsContentShell>
		<DocHeader title="Calling Functions">
			Use the built-in <code>callF</code> helper to invoke another function you own
			from inside a running function. SHSF carries the result back to the caller
			without exposing API keys or the SHSF API to your function code.
		</DocHeader>

		<Callout variant="note" title="Function ownership">
			<p>
				A function can only call another function belonging to the same account. The
				target receives <code>ran_by: "func_&lt;caller-id&gt;"</code> in its payload.
			</p>
		</Callout>

		<h2>Python</h2>
		<CodeCaption>main.py</CodeCaption>
		<pre><code>{`import json
from _call_func import callF

def main(args):
    # HTTP request bodies arrive as a string
    body = json.loads(args.get("body") or "{}")
    result = callF("create-invoice", {
        "customerId": body["customerId"],
        "amount": 499,
    })
    return {"invoice": result}`}</code></pre>

		<h2>Node.js</h2>
		<CodeCaption>index.js</CodeCaption>
		<pre><code>{`const { callF } = require("./_call_func");

async function main(args) {
    // HTTP request bodies arrive as a string
    const body = JSON.parse(args.body || "{}");
    const result = await callF("create-invoice", {
        customerId: body.customerId,
        amount: 499,
    });
    return { invoice: result };
}

module.exports = { main };`}</code></pre>

		<h2>Go</h2>
		<CodeCaption>main.go</CodeCaption>
		<pre><code>{`import "myfunction/callfunc"

func main_user(args interface{}) (interface{}, error) {
    result, err := callfunc.CallF("create-invoice", map[string]any{
        "amount": 499,
    }, 0)
    if err != nil { return nil, err }
    return map[string]any{"invoice": result}, nil
}`}</code></pre>
		<p>
			Use your Go module path in the import. For the generated default module,
			that path is <code>shsf_function_&lt;function-id&gt;/callfunc</code>.
		</p>

		<h2>Arguments and result</h2>
		<p>
			The second argument becomes the target function&apos;s <code>args.body</code>{" "}
			as-is, so the target receives an object rather than the JSON string an HTTP
			call delivers. <code>callF</code> waits for the target to finish, then returns its normal
			result. Errors from the target are raised or returned according to the runtime.
		</p>

		<Callout variant="warning" title="Avoid recursion">
			<p>
				Do not call a function from itself, directly or through a cycle. The target
				runs with its own timeout, while the caller waits up to the <code>callF</code>{" "}
				timeout (30 seconds by default, set by the third argument). Each caller keeps
				its container busy while it waits, so a cycle ties up resources until the
				callers time out.
			</p>
		</Callout>

	</DocsContentShell>
);
