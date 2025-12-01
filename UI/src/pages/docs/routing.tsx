import React from "react";
import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const RoutingDocPage = () => {
	return (
		<div className="min-h-screen bg-background text-text p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6">
					<a href="/docs" className="text-sm text-blue-500 hover:underline">
						← Back to docs
					</a>
				</div>

				<ScrollProgressbar />
				<h1 className="text-3xl font-bold text-primary mb-2">Routing</h1>
				<p className="mt-3 text-lg text-text/90 mb-6">
					SHSF allows you to map multiple routes to a single function, making it easy
					to handle different endpoints with one function. This is more efficient and
					maintainable than using body arguments to distinguish between actions.
				</p>

				<div className="mb-6 p-4 bg-yellow-900/20 border-l-4 border-yellow-400 rounded">
					<b>Note:</b> Routing is handled by the <code>route</code> argument in{" "}
					<code>args</code>. The default route is <code>"default"</code>. The{" "}
					<code>route</code> argument never includes a slash, and only supports a
					single path segment after your function's main URL.
				</div>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-4">Quick Example</h2>
				<p className="mb-4 text-text/90">
					Route handling in your function might look like this:
				</p>
				<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`route = args.get("route", "")
if route == "register":
    return RouteHandler.register() # Or any other logic
elif route == "login":
    return RouteHandler.login() # Or any other logic
else:
    return RouteHandler.default() # Or any other logic; Maybe even a 404 if you don't have a interface for this route`}</code>
				</pre>

				<h2 className="text-xl font-bold text-primary mt-8 mb-3">
					Why Use Routes?
				</h2>
				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>
						Cleaner and more maintainable than using body arguments to switch logic.
					</li>
					<li>
						Lets you expose multiple endpoints (e.g., <code>/register</code>,{" "}
						<code>/login</code>) with a single function.
					</li>
					<li>Improves clarity for API consumers and documentation.</li>
				</ul>

				<h2 className="text-xl font-bold text-primary mt-8 mb-3">
					How Routing Works
				</h2>
				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>
						The <code>route</code> argument is set based on the path after your
						function's main URL.
					</li>
					<li>
						Only one path segment is supported (e.g.,{" "}
						<code>.../exec/&lt;id&gt;/&lt;token&gt;/register</code>).
					</li>
					<li>
						Subroutes (e.g.,{" "}
						<code>/thiswouldwork/from_that_slash_on_my_left_it_would_not</code>) are{" "}
						<b>not</b> supported yet.
					</li>
					<li>
						The default route is <code>"default"</code>, not <code>"/"</code>.
					</li>
					<li>
						The <code>route</code> argument never includes a slash.
					</li>
				</ul>

				<h2 className="text-xl font-bold text-primary mt-8 mb-3">
					Best Practices & Notes
				</h2>
				<ul className="list-disc list-inside mb-4 text-text/90">
					<li>
						Always check for the <code>route</code> argument in <code>args</code> and
						provide a sensible default.
					</li>
					<li>
						Use clear, short route names for best clarity. Try to keep them longer if
						you have a bunch of them, or similar ones.
					</li>
					<li>Document your available routes for users of your function.</li>
					<li>
						Remember: Only one route segment is supported after the function URL.
					</li>
				</ul>

				<div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
					<h2 className="text-xl font-bold text-primary mb-3">
						🚀 Next Step - Custom CORS
					</h2>
					<p className="text-text/90 mb-4">
						The Error Web Devs hate the most, CORS! Learn how to allow or block
						specific origins for each function.
					</p>
					<a
						href="/docs/custom-cors"
						className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
					>
						#16 Custom CORS
						<span className="text-lg">→</span>
					</a>
				</div>
			</div>
		</div>
	);
};
