import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const CustomResponsesPage = () => {
	return (
		<div className="min-h-screen bg-background text-text p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6">
					<a href="/docs" className="text-sm text-blue-500 hover:underline">
						← Back to docs
					</a>
				</div>

				<ScrollProgressbar />

				<h1 className="text-3xl font-bold text-primary mb-2">Custom Responses</h1>
				<p className="mt-3 text-lg text-text/90 mb-8">
					Learn how to create custom responses for your functions to handle different
					scenarios.
				</p>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Understanding Custom Responses
				</h2>
				<p className="mb-4 text-text/90">
					In SHSF, you can return custom responses for your functions to provide
					meaningful feedback based on the execution outcome. This allows you to
					handle success, error, and other scenarios effectively.
				</p>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Creating Custom Responses
				</h2>
				<p className="mb-4 text-text/90">
					To create a custom response, you can return a object with specific keys
					from your function. SHSF will need to see <code>"_shsf":"v2"</code> in the
					response, and then will process it accordingly.
				</p>

				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
					<code>
						{`def main(args):
    # Your function logic here
    if success_condition:
        return {"_shsf": "v2", "_code": 200, "_res": {"state": True}}
    else:
        return {"_shsf": "v2", "_code": 400, "_res": {"state": False, "error": "An error occurred"}}`}
					</code>
				</pre>
				<p className="mb-4 text-text/90">
					In this example, the function returns a custom response based on the
					success condition. The <code>_code</code> key specifies the HTTP status
					code, and the <code>_res</code> key contains the actual response data.
				</p>

				<h3 className="text-xl font-semibold text-primary mb-2">
					What about custom headers?
				</h3>
				<p className="mb-4 text-text/90">
					You can also specify custom headers in your response by including a{" "}
					<code>_headers</code> key in the returned object.
				</p>

				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
					<code>
						{`def main(args):
    # Your function logic here
    if success_condition:
        return {"_shsf": "v2", "_code": 200, "_res": {"state": True}, "_headers": {"X-Custom-Header": "value"}}
    else:
        return {"_shsf": "v2", "_code": 400, "_res": {"state": False, "error": "An error occurred"}, "_headers": {"X-Custom-Header": "value"}}`}
					</code>
				</pre>
				<p className="mb-4 text-text/90">
					In this example, the function includes a custom header in the response.
				</p>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">Conclusion</h2>
				<p className="mb-4 text-text/90">
					Custom responses in SHSF allow you to provide meaningful feedback from your
					functions. By including specific keys in your response, you can handle
					various scenarios effectively, including success and error cases.
				</p>

				<div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
					<h2 className="text-xl font-bold text-primary mb-3">
						🚀 Next Steps - Environment Variables
					</h2>
					<p className="text-text/90 mb-4">
						We know how to get data in and out of our functions, but what about
						managing sensitive information like API keys? Let's take a look!
					</p>
					<a
						href="/docs/environment-variables"
						className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
					>
						#4 Environment Variables
						<span className="text-lg">→</span>
					</a>
				</div>
			</div>
		</div>
	);
};
