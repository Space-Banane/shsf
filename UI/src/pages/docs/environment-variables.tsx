import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const EnvironmentVariablesPage = () => {
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
					Environment Variables
				</h1>
				<p className="mt-3 text-lg text-text/90 mb-8">
					Learn how to manage sensitive information like API keys using environment
					variables.
				</p>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					What are Environment Variables?
				</h2>
				<p className="mb-4 text-text/90">
					Environment variables are key-value pairs that can be used to store
					configuration settings and sensitive information, such as API keys,
					database credentials, and other secrets. They help keep your codebase
					secure by avoiding hardcoding sensitive data directly in your source code,
					which when screensharing or screenshotting can be a security risk.
				</p>
				<p className="mb-4 text-text/90">
					Even when pushing to public repositories, environment variables ensure that
					sensitive information remains protected.
				</p>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Using Environment Variables in SHSF
				</h2>
				<p className="mb-4 text-text/90">
					In SHSF, you can define environment variables for your functions through
					the dashboard. These variables will be accessible within your function
					code.
				</p>

				<h3 className="text-xl font-semibold text-primary mb-2">
					Setting Environment Variables
				</h3>
				<p className="mb-4 text-text/90">
					To set environment variables for a function, follow these steps:
				</p>
				<ol className="list-decimal list-inside mb-4 text-text/90">
					<li>Navigate to the Functions section in the SHSF dashboard.</li>
					<li>Select the function you want to configure.</li>
					<li>Go to the "Environment Variables" tab.</li>
					<li>Click on "Add Variable" to create a new environment variable.</li>
					<li>Enter the variable name and value, then save your changes.</li>
				</ol>

				<h3 className="text-xl font-semibold text-primary mb-2">
					Accessing Environment Variables in Your Code
				</h3>
				<p className="mb-4 text-text/90">
					Once you have set the environment variables, you can access them in your
					function code using the standard method for your programming language. For
					example, in Python, you can use the `os` module:
				</p>

				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
					<code>
						{`import os

def main(args):
    api_key = os.getenv("API_KEY")
    # Use the api_key in your function logic
    return {"_shsf": "v2", "_code": 200, "_res": {"api_key_used": bool(api_key)}}`}
					</code>
				</pre>
				<p className="mb-4 text-text/90">
					In this example, the function retrieves the value of the `API_KEY`
					environment variable using `os.getenv("API_KEY")`.
				</p>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Best Practices
				</h2>
				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>Avoid hardcoding sensitive information in your code.</li>
					<li>Use descriptive names for your environment variables.</li>
					<li>
						Regularly rotate your secrets and update the environment variables
						accordingly.
					</li>
					<li>Limit access to the SHSF dashboard to trusted team members only.</li>
				</ul>

				<div className="mt-2 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
					<p className="text-sm text-blue-300">
						<strong>Good to know:</strong> Environment variables set in the SHSF
						dashboard are pulled in real time. This means that if you update an
						environment variable, the new value will be used the next time your
						function is invoked.
					</p>
				</div>

				<div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
					<h2 className="text-xl font-bold text-primary mb-3">
						🚀 Next Steps - Secure Headers
					</h2>
					<p className="text-text/90 mb-4">
						Let's also take a look at how we can keep our function from being invoked
						by unauthorized users using secure headers.
					</p>
					<a
						href="/docs/secure-headers"
						className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
					>
						#5 Secure Headers
						<span className="text-lg">→</span>
					</a>
				</div>
			</div>
		</div>
	);
};
