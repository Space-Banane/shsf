import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const DatabaseComDocPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Database Communication (db_com)">
				SHSF provides a built-in key-value storage helper for every runtime.
				It communicates over the internal execution transport — no API token,
				no HTTP client library, and no external service required. Data is stored
				in SHSF's database and persists across function invocations.
			</DocHeader>

			<Callout variant="note" title="No setup required">
				<p>
					The helper is injected automatically into every function container.
					For Python, import <code>_db_com</code>. For Go, import{" "}
					<code>myfunction/dbcom</code>. No <code>pip install</code> or{" "}
					<code>go get</code> needed.
				</p>
			</Callout>

			<h2>Python API</h2>

			<h3>Quick start</h3>
			<CodeCaption>Python</CodeCaption>
			<pre>
				<code>{`from _db_com import database

db = database()`}</code>
			</pre>

			<h3>create_storage</h3>
			<p>Create a named storage bucket. Safe to call on every invocation.</p>
			<pre>
				<code>{`db.create_storage("my-bucket", purpose="Cache for processed results")`}</code>
			</pre>

			<h3>set / get</h3>
			<CodeCaption>Set with optional expiry</CodeCaption>
			<pre>
				<code>{`from datetime import datetime, timedelta, timezone

# No expiry — persists until deleted
db.set("my-bucket", "username", "alice")

# With expiry — auto-deleted after 1 hour
expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
db.set("my-bucket", "session", "abc123", expires_at=expires)

# Read back the value
value = db.get("my-bucket", "username")   # returns "alice"
print(value)`}</code>
			</pre>

			<h3>get_item</h3>
			<p>
				Returns the full item record (value + metadata) rather than just the
				value:
			</p>
			<pre>
				<code>{`item = db.get_item("my-bucket", "username")
# item = {"key": "username", "value": "alice", "expires_at": None, ...}`}</code>
			</pre>

			<h3>list_items</h3>
			<pre>
				<code>{`items = db.list_items("my-bucket")
for item in items:
    print(item["key"], item["value"])`}</code>
			</pre>

			<h3>exists</h3>
			<pre>
				<code>{`if db.exists("my-bucket", "username"):
    print("Key is present")`}</code>
			</pre>

			<h3>delete_item</h3>
			<pre>
				<code>{`db.delete_item("my-bucket", "username")`}</code>
			</pre>

			<h3>clear</h3>
			<p>Removes all items from a storage bucket without deleting the bucket itself:</p>
			<pre>
				<code>{`db.clear("my-bucket")`}</code>
			</pre>

			<h3>delete_storage</h3>
			<p>Deletes a storage bucket and all its items:</p>
			<pre>
				<code>{`db.delete_storage("my-bucket")`}</code>
			</pre>

			<h3>list_storages</h3>
			<pre>
				<code>{`storages = db.list_storages()
for s in storages:
    print(s["name"])`}</code>
			</pre>

			<h2>Go API</h2>
			<CodeCaption>Go — import and initialise</CodeCaption>
			<pre>
				<code>{`import "myfunction/dbcom"

db := dbcom.New()`}</code>
			</pre>

			<h3>CreateStorage / Set / Get</h3>
			<CodeCaption>Go</CodeCaption>
			<pre>
				<code>{`package main

import (
    "fmt"
    "myfunction/dbcom"
)

func main_user(args interface{}) (interface{}, error) {
    db := dbcom.New()

    // Create storage (idempotent)
    _, err := db.CreateStorage("hits", "Page hit counter")
    if err != nil { return nil, err }

    // Increment a counter
    prev, _ := db.Get("hits", "home")
    count := 0
    if prev != nil {
        count = int(prev.(float64))
    }
    count++
    _, err = db.Set("hits", "home", count, nil)
    if err != nil { return nil, err }

    return map[string]interface{}{"hits": count}, nil
}`}</code>
			</pre>

			<h3>GetItem / ListItems / DeleteItem / Exists</h3>
			<CodeCaption>Go — full reference</CodeCaption>
			<pre>
				<code>{`db := dbcom.New()

item, err  := db.GetItem("hits", "home")          // full item record
items, err := db.ListItems("hits")                 // all items in storage
err         = db.DeleteItem("hits", "home")        // remove one key
exists     := db.Exists("hits", "home")            // bool, no error return`}</code>
			</pre>

			<h2>Best practices</h2>
			<ul>
				<li>
					Use short, descriptive storage names and keys — they are case-sensitive.
				</li>
				<li>
					Always handle <code>None</code> / <code>nil</code> returns from{" "}
					<code>get</code> — a key that doesn't exist returns nothing.
				</li>
				<li>
					Set <code>expires_at</code> for session tokens, rate-limit counters,
					and any data with a known lifetime.
				</li>
				<li>
					Call <code>create_storage</code> / <code>CreateStorage</code> at the
					top of your function — it's idempotent and won't overwrite existing
					data.
				</li>
			</ul>

			<NextStep href="/docs/routing" label="#15 Routing">
				Next: handle multiple endpoints with a single function using SHSF's
				deep-path routing system.
			</NextStep>
		</DocsContentShell>
	);
};
