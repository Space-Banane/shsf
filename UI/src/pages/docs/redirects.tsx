
export const RedirectsPage = () => {
	return (
		<div className="min-h-screen bg-background text-text p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6">
					<a href="/docs" className="text-sm text-blue-500 hover:underline">
						← Back to docs
					</a>
				</div>

				<h1 className="text-3xl font-bold text-primary mb-2">
					Redirects
				</h1>

				<p className="mt-3 text-lg text-text/90 mb-6">
					Functions can trigger HTTP redirects by setting special response fields. This is useful for workflows where you want to send the user to a different URL after an action, such as after login or form submission.
				</p>

				<h2 className="text-2xl font-bold text-primary mt-6 mb-4">
					How to Trigger a Redirect
				</h2>
				<p className="mb-4 text-text/90">
					To perform a redirect, your function should return an object with the <code>_code</code> property set to <code>301</code> (permanent) or <code>302</code> (temporary), and the <code>_location</code> property set to the target URL as a string.
                </p>
                <div className="mb-6">
                    <label className="block text-sm font-medium text-text/70 mb-2">
                        Example (Python):
                    </label>
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        <code>
                {`def main(args):
    return {
        "_code": 302,
        "_location": "https://example.com/target",
        "_shsf": "v2"
    }
                `}
                        </code>
                    </pre>
                    </div>

				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>
						<code>_code</code> must be <code>301</code> or <code>302</code> to trigger a redirect.
					</li>
					<li>
						<code>_location</code> must be a valid URL string.
					</li>
				</ul>

				<h2 className="text-2xl font-bold text-primary mt-6 mb-4">
					Example Use Cases
				</h2>
				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>Redirecting users after successful login or logout</li>
					<li>Sending users to a confirmation page after form submission</li>
					<li>Implementing short links or URL forwarding</li>
				</ul>

				<h2 className="text-2xl font-bold text-primary mt-6 mb-4">
					Notes
				</h2>
				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>Only <code>301</code> and <code>302</code> status codes are supported for redirects.</li>
					<li>If <code>_location</code> is missing or not a string, no redirect will occur.</li>
					<li>Other response data will be ignored if a redirect is triggered.</li>
				</ul>

				<div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
          <h2 className="text-xl font-bold text-primary mb-3">
            🚀 Next Step - Raw Body Handling
          </h2>
          <p className="text-text/90 mb-4">
            Let's also take a look at how we can handle raw body data in our
            functions, which is essential for working with file uploads and
            binary data.
          </p>
          <a
            href="/docs/raw-body"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            #8 Raw Body Handling
            <span className="text-lg">→</span>
          </a>
        </div>
			</div>
		</div>
	);
};
