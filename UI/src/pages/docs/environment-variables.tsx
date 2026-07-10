import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const EnvironmentVariablesPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Environment Variables">
				Environment variables keep secrets and configuration out of your source
				code. SHSF injects them into each function invocation so your code can
				read them with the standard OS APIs — no restarts needed when a value
				changes.
			</DocHeader>

			<h2>Two scopes</h2>
			<p>SHSF supports environment variables at two levels:</p>
			<ul>
				<li>
					<strong>Account-wide</strong> — set once in <em>Account Settings</em>{" "}
					and injected into every function you own. Useful for shared API keys
					or base URLs.
				</li>
				<li>
					<strong>Function-level</strong> — set in the function's{" "}
					<em>Environment Variables</em> tab. These override account-wide values
					with the same name.
				</li>
			</ul>
			<Callout variant="note" title="Function-level takes priority">
				<p>
					If both scopes define the same key, the function-level value wins.
					Account-wide variables are injected only when the function has no
					override for that key.
				</p>
			</Callout>

			<h2>Setting variables</h2>
			<ol>
				<li>
					(Optional) Go to <strong>Account &gt; Environment Variables</strong>{" "}
					to add shared values available across all functions.
				</li>
				<li>
					Open your function and navigate to the{" "}
					<strong>Environment Variables</strong> tab.
				</li>
				<li>
					Click <strong>Add Variable</strong>, enter the key and value, and save.
				</li>
			</ol>

			<h2>Reading variables in your function</h2>
			<CodeCaption>Python — os.getenv</CodeCaption>
			<pre>
				<code>{`import os

def main(args):
    api_key = os.getenv("MY_API_KEY")
    if not api_key:
        return {"_shsf": "v2", "_code": 500, "_res": {"error": "MY_API_KEY not configured"}}
    # use api_key ...
    return {"_shsf": "v2", "_code": 200, "_res": {"ok": True}}`}</code>
			</pre>

			<CodeCaption>Go — os.Getenv</CodeCaption>
			<pre>
				<code>{`import "os"

func main_user(args interface{}) (interface{}, error) {
    apiKey := os.Getenv("MY_API_KEY")
    if apiKey == "" {
        return map[string]interface{}{
            "_shsf": "v2", "_code": 500,
            "_res": map[string]string{"error": "MY_API_KEY not configured"},
        }, nil
    }
    // use apiKey ...
    return map[string]interface{}{"ok": true}, nil
}`}</code>
			</pre>

			<h2>Live updates</h2>
			<Callout variant="info" title="No restart required">
				<p>
					Environment variables are fetched at invocation time. If you update a
					value in the dashboard, the next function call gets the new value
					immediately — no container restart needed.
				</p>
			</Callout>

			<h2>Best practices</h2>
			<ul>
				<li>Never hardcode secrets (API keys, tokens, passwords) in source files.</li>
				<li>
					Use descriptive, upper-case names like <code>STRIPE_SECRET_KEY</code>{" "}
					or <code>DATABASE_URL</code>.
				</li>
				<li>Rotate secrets regularly and update them in the dashboard.</li>
				<li>
					Limit dashboard access to trusted team members — anyone who can see the
					function settings can view environment variable values.
				</li>
			</ul>

			<NextStep href="/docs/secure-headers" label="#5 Secure Headers">
				Secrets are in variables. Next: protect your HTTP endpoint so only
				authorised callers can invoke the function at all.
			</NextStep>
		</DocsContentShell>
	);
};
