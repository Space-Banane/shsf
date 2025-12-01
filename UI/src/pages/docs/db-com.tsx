import React from "react";
import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const DatabaseComDocPage = () => {
	return (
		<div className="min-h-screen bg-background text-text p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6">
					<a href="/docs" className="text-sm text-blue-500 hover:underline">
						← Back to docs
					</a>
				</div>

				<ScrollProgressbar />
				<h1 className="text-3xl font-bold text-primary mb-2">
					Database Communication in Python
				</h1>
				<p className="mt-3 text-lg text-text/90 mb-6">
					SHSF provides a simple Python interface for fast, persistent storage and
					retrieval of data using the <code>_db_com.py</code> script. This lets you
					create, update, and fetch data from your serverless functions with minimal
					code.
				</p>

				<div className="mb-6 p-4 bg-yellow-900/20 border-l-4 border-yellow-400 rounded">
					<b>Note:</b> You must install the <code>requests</code> package in your
					Python environment. Add it to your <code>requirements.txt</code> file.
				</div>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Quick Start</h2>
				<p className="mb-4 text-text/90">
					Import and initialize the database interface:
				</p>
				<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`from _db_com import database\n\ndb = database()`}</code>
				</pre>

				<h2 className="text-xl font-bold text-primary mt-8 mb-3">
					Create a Storage
				</h2>
				<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`db.create_storage("my_storage", purpose="For fast key-value data")`}</code>
				</pre>

				<h2 className="text-xl font-bold text-primary mt-8 mb-3">
					Set Data (No Expiration)
				</h2>
				<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`db.set("my_storage", "username", "alice")`}</code>
				</pre>

				<h2 className="text-xl font-bold text-primary mt-8 mb-3">
					Set Data (With Expiration)
				</h2>
				<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`from datetime import datetime, timedelta\n\n# Expire in 1 hour\nexpires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()\ndb.set("my_storage", "session_token", "abc123", expires_at=expires_at)`}</code>
				</pre>

				<h2 className="text-xl font-bold text-primary mt-8 mb-3">Retrieve Data</h2>
				<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`value = db.get("my_storage", "username")\nprint(value)  # Output: alice`}</code>
				</pre>

				<h2 className="text-xl font-bold text-primary mt-8 mb-3">List All Items</h2>
				<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`items = db.list_items("my_storage")\nprint(items)`}</code>
				</pre>

				<h2 className="text-xl font-bold text-primary mt-8 mb-3">Delete an Item</h2>
				<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`db.delete_item("my_storage", "username")`}</code>
				</pre>

				<h2 className="text-xl font-bold text-primary mt-8 mb-3">
					Check if Item Exists
				</h2>
				<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`if db.exists("my_storage", "username"):\n    print("User exists!")`}</code>
				</pre>

				<h2 className="text-2xl font-bold text-primary mt-10 mb-4">
					Best Practices & Notes
				</h2>
				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>
						Use short, alphanumeric storage and key names for best performance.
					</li>
					<li>
						Always check for <code>None</code> or handle <code>DatabaseError</code>{" "}
						when retrieving data.
					</li>
					<li>Expiration is optional; if not set, data persists until deleted.</li>
				</ul>

				<div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
					<h2 className="text-xl font-bold text-primary mb-3">
						🚀 Next Step - Routing
					</h2>
					<p className="text-text/90 mb-4">
						Let's look at how we can handle multiple routes in a single function.
					</p>
					<a
						href="/docs/routing"
						className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
					>
						#15 Routing
						<span className="text-lg">→</span>
					</a>
				</div>
			</div>
		</div>
	);
};
