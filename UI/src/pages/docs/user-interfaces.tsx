import React from "react";
import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const UserInterfacesPage = () => {
	return (
		<div className="min-h-screen bg-background text-text p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6">
					<a href="/docs" className="text-sm text-blue-500 hover:underline">
						← Back to docs
					</a>
				</div>

				<ScrollProgressbar />

				<h1 className="text-3xl font-bold text-primary mb-2">User Interfaces</h1>
				<p className="mt-3 text-lg text-text/90 mb-8">
					Learn how to serve HTML files as user interfaces from your functions. This
					is useful for building web UIs, dashboards, or custom pages directly from
					your serverless functions.
				</p>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Serving HTML Files
				</h2>
				<p className="mb-4 text-text/90">
					To serve an HTML file, your function should read the file content and
					return it with the correct <code>Content-Type</code> header set to{" "}
					<code>text/html</code>. This ensures browsers render the response as a web
					page.
				</p>

				<div className="mb-6">
					<label className="block text-sm font-medium text-text/70 mb-2">
						Example (Python):
					</label>
					<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
						<code>{`def main(args):
    with open("index.html", "r") as f:
        html_content = f.read()
    return {
        "_shsf": "v2",
        "_code": 200,
        "_headers": {"Content-Type": "text/html"},
        "_res": html_content
    }`}</code>
					</pre>
				</div>

				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>
						Always set <code>Content-Type: text/html</code> in the{" "}
						<code>_headers</code> field.
					</li>
					<li>
						Return the HTML content as a string in <code>_res</code>.
					</li>
					<li>
						Use <code>_code: 200</code> for successful responses.
					</li>
				</ul>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">Use Cases</h2>
				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>Serving custom dashboards or admin panels</li>
					<li>Providing documentation or help pages</li>
					<li>Building interactive web tools with serverless backends</li>
				</ul>

				<div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
					<h2 className="text-xl font-bold text-primary mb-3">
						🚀 Next Step - Docker Mount
					</h2>
					<p className="text-text/90 mb-4">
						Let's also take a look at how we can use the Docker mount option to create
						and modify containers on the host.
					</p>
					<a
						href="/docs/docker-mount"
						className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
					>
						#10 Docker Mount
						<span className="text-lg">→</span>
					</a>
				</div>
			</div>
		</div>
	);
};
