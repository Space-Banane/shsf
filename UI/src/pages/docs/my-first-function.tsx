import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const MyFirstFunctionDoc = () => {
	return (
		<DocsContentShell>
			<DocHeader title="My First Function">
				Build a function that posts a "Happy Monday" message to a Discord
				webhook every Monday at midnight — covering creation, file management,
				dependencies, and scheduled triggers.
			</DocHeader>

			<h2>1. Create a namespace and function</h2>
			<p>
				Navigate to <strong>Functions</strong> in the SHSF interface. If you
				haven't created a namespace yet, click <strong>Create Namespace</strong>{" "}
				to group your functions. Then click <strong>Create Function</strong> and
				fill in the name, description, and namespace. Select{" "}
				<strong>Python 3.11</strong> as the image and set the startup file to{" "}
				<code>main.py</code>.
			</p>
			<Callout variant="tip" title="Most settings can be changed later">
				<p>
					Runtime image, startup file, RAM, and timeout can all be updated via
					the <strong>Update Function</strong> modal. Functions are lightweight —
					if you need to start over, just recreate one.
				</p>
			</Callout>

			<h2>2. Write the function code</h2>
			<p>
				In the file manager, click <strong>Create File</strong> and name it{" "}
				<code>main.py</code>. Open it and paste:
			</p>
			<CodeCaption>main.py</CodeCaption>
			<pre>
				<code>{`import requests
import os

def main(args):
    webhook_url = os.getenv("DISCORD_WEBHOOK_URL")
    if not webhook_url:
        return {"_shsf": "v2", "_code": 500, "_res": {"error": "DISCORD_WEBHOOK_URL not set"}}

    payload = {"content": "Happy Monday, @everyone! Let's make this week great! 🌟"}

    # Fetch webhook metadata to get the bot name
    info = requests.get(webhook_url)
    if info.status_code == 200:
        username = info.json().get("name", "SHSF Bot") + " (via SHSF)"
        payload["username"] = username

    resp = requests.post(webhook_url, json=payload)
    return {"_shsf": "v2", "_code": resp.status_code, "_res": {"sent": resp.ok}}`}</code>
			</pre>
			<p>
				Save the file with the save button at the top of the editor. The webhook
				URL is loaded from an environment variable — never hardcode secrets
				directly in source files.
			</p>

			<h2>3. Add the webhook URL as an environment variable</h2>
			<p>
				Go to the <strong>Environment Variables</strong> tab in your function
				dashboard. Click <strong>Add Variable</strong>, set the name to{" "}
				<code>DISCORD_WEBHOOK_URL</code>, and paste your Discord webhook URL as
				the value.
			</p>

			<h2>4. Install dependencies</h2>
			<p>
				Create a file named <code>requirements.txt</code> with the following
				content:
			</p>
			<pre>
				<code>requests</code>
			</pre>
			<p>
				SHSF detects <code>requirements.txt</code> and automatically installs
				the listed packages into a cached virtualenv before the first run.
			</p>

			<h2>5. Test the function</h2>
			<p>
				Click the <strong>Run</strong> button in the function toolbar. The first
				run triggers dependency installation — this may take a moment. Once the
				container reports <em>"Container ready"</em>, subsequent runs are fast.
				If the webhook URL is valid you'll see the Discord message appear.
			</p>
			<Callout variant="note" title="First-run delay is normal">
				<p>
					On the very first execution SHSF builds the virtualenv from
					scratch. The next run picks up the cached venv and starts almost
					instantly.
				</p>
			</Callout>

			<h2>6. Schedule it — every Monday at midnight</h2>
			<p>
				Go to the <strong>Triggers</strong> tab and click{" "}
				<strong>Create Trigger</strong>. Give it a name like{" "}
				<em>monday-greeting</em> and set the cron expression to:
			</p>
			<pre>
				<code>0 0 * * 1</code>
			</pre>
			<p>
				Leave the JSON payload blank, make sure <strong>Enabled</strong> is
				checked, and click <strong>Create Trigger</strong>. SHSF will now
				invoke the function automatically every Monday at midnight UTC.
			</p>
			<Callout variant="tip" title="Preset schedules">
				<p>
					The trigger modal includes preset options (hourly, daily, weekly,
					etc.) — handy if you don't want to memorise cron syntax.
				</p>
			</Callout>

			<NextStep href="/docs/data-passing" label="#2 Data Passing">
				Now that your first function is running, learn how HTTP requests and
				trigger payloads pass data into your function code via the{" "}
				<code>args</code> object.
			</NextStep>
		</DocsContentShell>
	);
};
