import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const PersistentDataPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Persistent Data">
				SHSF functions run in isolated containers. Two built-in options let you
				store data that survives across invocations: the{" "}
				<strong>filesystem</strong> at <code>/app/</code> and SHSF's native{" "}
				<strong>key-value storage</strong> via the <code>db_com</code> helper.
			</DocHeader>

			<Callout variant="warning" title="Only /app/ persists">
				<p>
					<code>/app/</code> is the only directory guaranteed to persist between
					invocations. <code>/tmp/</code> is ephemeral — treat it as scratch
					space only; it is cleared when the container restarts.
				</p>
			</Callout>

			<h2>Filesystem storage at /app/</h2>
			<p>
				Write any file to <code>/app/</code> and it will be there on the next
				invocation. Good for caching computed data, storing state between runs,
				or saving output files.
			</p>
			<CodeCaption>Python — read and write a file</CodeCaption>
			<pre>
				<code>{`def main(args):
    counter_path = "/app/counter.txt"

    # Read current count (default 0)
    try:
        with open(counter_path) as f:
            count = int(f.read().strip())
    except FileNotFoundError:
        count = 0

    count += 1
    with open(counter_path, "w") as f:
        f.write(str(count))

    return {"invocations": count}`}</code>
			</pre>
			<Callout variant="note" title="File manager shows /app/ contents">
				<p>
					Files written at runtime appear in the SHSF file manager, making it
					easy to inspect or delete them from the UI.
				</p>
			</Callout>

			<h2>Built-in key-value storage (db_com)</h2>
			<p>
				For structured data — counters, session tokens, cached API responses —
				use SHSF's built-in storage helper. It communicates over the internal
				execution transport (no API token, no <code>requests</code> needed) and
				supports TTL-based expiry.
			</p>
			<CodeCaption>Python — quick start</CodeCaption>
			<pre>
				<code>{`from _db_com import database

db = database()

def main(args):
    # Create a storage bucket once (safe to call multiple times)
    db.create_storage("cache", purpose="Function cache")

    # Write a value (optional TTL via expires_at)
    db.set("cache", "last_run", "2024-07-10T00:00:00")

    # Read it back
    value = db.get("cache", "last_run")
    return {"last_run": value}`}</code>
			</pre>
			<p>
				See the{" "}
				<a href="/docs/db-com" className="text-blue-400 hover:text-blue-300">
					Database Communication
				</a>{" "}
				page for the full API including <code>list_items</code>,{" "}
				<code>delete_item</code>, <code>exists</code>, and TTL expiry.
			</p>

			<h2>Temporary files at /tmp/</h2>
			<p>
				Use <code>/tmp/</code> for intermediate files within a single
				invocation — e.g. downloading a file, processing it, and uploading the
				result. Never rely on <code>/tmp/</code> data being there on the next
				call.
			</p>

			<h2>External databases</h2>
			<p>
				You can connect to any external database (PostgreSQL, MySQL, MongoDB,
				etc.) using environment variables for the connection string. This is
				appropriate for application data that multiple services share or that
				needs relational queries. Use{" "}
				<code>db_com</code> or the filesystem for lightweight function-local
				state.
			</p>

			<NextStep href="/docs/redirects" label="#7 Redirects">
				Data is stored. Next: how to send the caller to a different URL using
				HTTP redirects.
			</NextStep>
		</DocsContentShell>
	);
};
