import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const UserInterfacesPage = () => {
	return (
		<DocsContentShell>
			<DocHeader title="User Interfaces">
				Functions can serve full HTML pages by returning the HTML string in the{" "}
				<code>_res</code> field with a <code>Content-Type: text/html</code>{" "}
				header. This is useful for dashboards, admin panels, and interactive
				forms backed by a serverless API.
			</DocHeader>

			<h2>Serving an HTML file</h2>
			<p>
				Place your <code>index.html</code> file in the function's file manager.
				Return its contents with the right content-type header:
			</p>
			<CodeCaption>Python — serve index.html</CodeCaption>
			<pre>
				<code>{`def main(args):
    with open("index.html", "r") as f:
        html = f.read()
    return {
        "_shsf":    "v2",
        "_code":    200,
        "_headers": {"Content-Type": "text/html; charset=utf-8"},
        "_res":     html
    }`}</code>
			</pre>

			<h2>Routing between pages</h2>
			<p>
				Use <code>args["route"]</code> to serve different HTML files for
				different paths:
			</p>
			<CodeCaption>Python — multi-page routing</CodeCaption>
			<pre>
				<code>{`def main(args):
    route = args.get("route", "default")

    pages = {
        "default": "index.html",
        "about":   "about.html",
        "contact": "contact.html",
    }
    filename = pages.get(route)
    if not filename:
        return {"_shsf": "v2", "_code": 404, "_res": "Not found"}

    with open(filename) as f:
        return {
            "_shsf":    "v2",
            "_code":    200,
            "_headers": {"Content-Type": "text/html; charset=utf-8"},
            "_res":     f.read()
        }`}</code>
			</pre>

			<h2>Inlining dynamic data</h2>
			<p>
				Use Python's string formatting to inject data directly into the HTML
				before sending:
			</p>
			<CodeCaption>Python — template substitution</CodeCaption>
			<pre>
				<code>{`def main(args):
    user = args.get("queries", {}).get("user", "world")
    html = f"""<!DOCTYPE html>
<html>
<head><title>Hello</title></head>
<body><h1>Hello, {user}!</h1></body>
</html>"""
    return {
        "_shsf":    "v2",
        "_code":    200,
        "_headers": {"Content-Type": "text/html; charset=utf-8"},
        "_res":     html
    }`}</code>
			</pre>

			<Callout variant="tip" title="Serve Only HTML mode is simpler for static pages">
				<p>
					If your function only needs to serve a single HTML file with no
					dynamic logic, consider{" "}
					<a href="/docs/serve-only" className="text-blue-400 hover:text-blue-300">
						Serve Only HTML
					</a>{" "}
					mode — it skips the runtime entirely and serves the file directly,
					which is faster and simpler.
				</p>
			</Callout>

			<h2>Use cases</h2>
			<ul>
				<li>Custom dashboards and admin panels</li>
				<li>Documentation or help pages</li>
				<li>Forms that submit back to the same or another function</li>
				<li>Lightweight single-page apps with a serverless backend</li>
			</ul>

			<NextStep href="/docs/docker-mount" label="#10 Docker Mount">
				Next: mount the Docker socket to let your function manage other
				containers on the host — a powerful but high-risk feature.
			</NextStep>
		</DocsContentShell>
	);
};
