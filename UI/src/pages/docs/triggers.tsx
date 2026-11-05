import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader } from "./_components";

export const TriggersDocPage = () => (
	<DocsContentShell>
		<DocHeader title="Scheduled Triggers">
			A trigger runs a function on a cron schedule. Each run passes the
			trigger's JSON payload to <code>main(args)</code>. You can also start a
			trigger by hand to test it.
		</DocHeader>

		<h2>Create a trigger</h2>
		<ol>
			<li>Open the function and click <strong>New Trigger</strong> in the <strong>Triggers</strong> card. To pick the function first, use <strong>Cron Jobs</strong> in the navigation bar instead.</li>
			<li>Enter a <strong>Trigger name</strong> and, optionally, a <strong>Description</strong>.</li>
			<li>Enter a <strong>Cron expression</strong> or click a preset such as <em>Every hour</em> or <em>Every weekday at 5 PM</em>. A preset also fills in the name.</li>
			<li>Optionally add a JSON payload, leave <strong>Enable Trigger</strong> on, and click <strong>Create Trigger</strong>.</li>
		</ol>

		<h2>Schedule</h2>
		<p>
			Cron expressions use the standard five fields (minute, hour, day of
			month, month, day of week) and run in the server's timezone. The bundled{" "}
			<code>docker-compose.yml</code> sets <code>TZ=Europe/Berlin</code>; change
			it there if you want another zone. A run that was missed while the server
			was down fires on the next check instead of being skipped.
		</p>

		<h2>What the function receives</h2>
		<p>
			The payload's top-level keys are merged into <code>args</code>, together
			with <code>ran_by</code> and <code>triggerId</code>. Scheduled runs set{" "}
			<code>ran_by</code> to <code>"cron"</code>; manual runs set it to{" "}
			<code>"trigger"</code>. HTTP fields such as <code>body</code> and{" "}
			<code>headers</code> are not present.
		</p>
		<CodeCaption>Payload {`{"report": "daily"}`} arrives as</CodeCaption>
		<pre><code>{`{"ran_by": "cron", "triggerId": 7, "report": "daily"}`}</code></pre>
		<CodeCaption>main.py</CodeCaption>
		<pre><code>{`def main(args):
    if args.get("ran_by") in ("cron", "trigger"):
        return {"report": args.get("report", "none")}
    return {"_shsf": "v2", "_code": 400, "_res": "HTTP calls not supported"}`}</code></pre>

		<h2>Run, edit, and monitor</h2>
		<p>
			In the <strong>Triggers</strong> card, the ▶️ button runs a trigger now,
			✏️ edits it, and 🗑️ deletes it. The <strong>Cron Jobs</strong> page lists
			every trigger with its <strong>Next Run</strong> and <strong>Last Run</strong>,
			and whether the last run exited with code 0.
		</p>
		<Callout variant="warning" title="Invalid expressions disable the trigger">
			<p>
				If the scheduler cannot parse a stored cron expression, it disables the
				trigger and resets the expression to <code>0 0 * * *</code>. Re-enable
				it after you correct the expression.
			</p>
		</Callout>

		<p>
			A trigger did not fire? See{" "}
			<a href="/docs/troubleshooting">Troubleshooting</a>.
		</p>
	</DocsContentShell>
);
