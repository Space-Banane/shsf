import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

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
		<pre><code>{`from _call_func import callF

def main(args):
    result = callF("create-invoice", {
        "customerId": args["body"]["customerId"],
        "amount": 499,
    })
    return {"invoice": result}`}</code></pre>

		<h2>Node.js</h2>
		<CodeCaption>index.js</CodeCaption>
		<pre><code>{`const { callF } = require("./_call_func");

async function main(args) {
    const result = await callF("create-invoice", {
        customerId: args.body.customerId,
        amount: 499,
    });
    return { invoice: result };
}

module.exports = { main };`}</code></pre>

		<h2>Go</h2>
		<CodeCaption>main.go</CodeCaption>
		<pre><code>{`import "shsf_function_N/callfunc"

func main(args map[string]any) (any, error) {
    return callfunc.CallF("create-invoice", map[string]any{
        "amount": 499,
    }, 0)
}`}</code></pre>

		<h2>Arguments and result</h2>
		<p>
			The second argument becomes the target function&apos;s <code>args.body</code>.
			<code>callF</code> waits for the target to finish, then returns its normal
			result. Errors from the target are raised or returned according to the runtime.
		</p>

		<Callout variant="warning" title="Avoid recursion">
			<p>
				Do not call a function from itself, directly or through a cycle. Calls share
				the caller&apos;s timeout budget, so recursive chains will eventually time out.
			</p>
		</Callout>

		<NextStep href="/docs/nodejs-runtime" label="#21 Node.js Runtime">
			Learn more about writing and packaging Node.js functions.
		</NextStep>
	</DocsContentShell>
);
