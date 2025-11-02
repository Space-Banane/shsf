
import React from "react";
import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const CustomCorsDocPage = () => {
	return (
		<div className="min-h-screen bg-background text-text p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6">
					<a href="/docs" className="text-sm text-blue-500 hover:underline">
						← Back to docs
					</a>
				</div>

				<ScrollProgressbar />
				<h1 className="text-3xl font-bold text-primary mb-2">Custom CORS - Allowing X but not Y</h1>
				<p className="mt-3 text-lg text-text/90 mb-6">
					SHSF allows you to configure <b>Custom CORS (Cross-Origin Resource Sharing)</b> settings for each function individually. This means you can specify exactly which origin domains are allowed to access your function, improving security and flexibility.
				</p>

				<div className="mb-6 p-4 bg-yellow-900/20 border-l-4 border-yellow-400 rounded">
					<b>Note:</b> CORS settings are <b>per-function</b>. You can allow or deny specific origins for each function separately. SHSF and its UI are allowed by default.
				</div>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">How to Set Allowed Origins</h2>
				<ol className="list-decimal list-inside mb-4 text-text/90 space-y-2">
					<li>
						<b>When Creating a Function:</b> In the <b>Create Function</b> modal, find the <b>CORS Origins</b> section. Enter one or more allowed origins (e.g., <code>https://example.com</code>). You can add multiple origins, separated by commas, or use the UI controls to add/remove them.
					</li>
					<li>
						<b>When Editing a Function:</b> In the <b>Update Function</b> modal, scroll to the <b>CORS Origins</b> section. Here you can update, add, or remove allowed origins at any time.
					</li>
				</ol>

				<h2 className="text-xl font-bold text-primary mt-8 mb-3">Example: Allowing Only Specific Domains</h2>
				<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-6">
<code>{`CORS Origins: https://myapp.com, https://admin.myapp.com`}</code>
				</pre>
				<p className="mb-4 text-text/90">
					With this setting, only requests from <code>https://myapp.com</code> and <code>https://admin.myapp.com</code> will be allowed. All other origins will be blocked by the browser.
				</p>

				<h2 className="text-xl font-bold text-primary mt-8 mb-3">Best Practices</h2>
				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>Only allow origins you trust.</li>
					<li>You can update CORS origins at any time via the function settings in the UI.</li>
					<li>For development, you may temporarily allow <code>http://localhost:3000</code> or similar, but remove it for production.</li>
				</ul>

                <div className="mb-6 p-4 bg-red-900/20 border-l-4 border-red-400 rounded">
                    <b>⚠️ Security Warning:</b> The wildcard origin <code>*</code> is not supported for security reasons. You must specify exact domain origins to ensure proper access control.
                </div>

				<div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
					<h2 className="text-xl font-bold text-primary mb-3">
						🚀 Next Step - Keep your instance up to date!
					</h2>
					<p className="text-text/90 mb-4">
						This is the latest documentation page. Check back here for new updates as they become available.
					</p>
				</div>
			</div>
		</div>
	);
};
