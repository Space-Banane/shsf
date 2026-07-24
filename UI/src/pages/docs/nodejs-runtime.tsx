import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const DocsNodeJsRuntime = () => {
	return (
		<DocsContentShell>
			<DocHeader title="Node.js Runtime">
				SHSF runs your Node.js functions inside an official{" "}
				<code>node</code> Docker container. npm packages are installed once
				and cached by a hash of your <code>package.json</code> — subsequent
				invocations reuse the cache and skip re-installation.
			</DocHeader>

			<h2>Supported Node.js versions</h2>
			<ul>
				<li>node:20 (LTS)</li>
				<li>node:22 (LTS)</li>
				<li>node:24 (Current)</li>
			</ul>

			<h2>Entry point</h2>
			<p>
				Your startup file must export a <code>main</code> function. SHSF
				calls it with the request payload and writes the return value as the
				function result.
			</p>
			<CodeCaption>index.js — minimal function</CodeCaption>
			<pre>
				<code>{`async function main(args) {
    return { hello: 'from Node.js' };
}

module.exports = { main };`}</code>
			</pre>

			<Callout variant="note" title="Startup file">
				<p>
					Set the startup file in function settings (e.g.{" "}
					<code>index.js</code>). SHSF loads it with{" "}
					<code>require('/app/index.js')</code> and calls the exported{" "}
					<code>main</code> function.
				</p>
			</Callout>

			<h2>Reading request data</h2>
			<p>
				<code>args</code> is a plain JavaScript object containing the full
				request context:
			</p>
			<CodeCaption>index.js — read body, queries, route</CodeCaption>
			<pre>
				<code>{`async function main(args) {
    const { body, queries, headers, route, method, raw_body } = args;

    // Parse JSON body if present
    let data = null;
    try {
        if (body) data = JSON.parse(body);
    } catch (_) {}

    return {
        route,
        method,
        data,
        userAgent: headers['user-agent'],
    };
}

module.exports = { main };`}</code>
			</pre>

			<h2>Custom responses</h2>
			<CodeCaption>index.js — v2 envelope</CodeCaption>
			<pre>
				<code>{`async function main(args) {
    return {
        _shsf: 'v2',
        _code: 201,
        _headers: {
            'Content-Type': 'application/json',
            'X-Powered-By': 'SHSF',
        },
        _res: JSON.stringify({ status: 'created' }),
    };
}

module.exports = { main };`}</code>
			</pre>

			<h2>Installing npm packages</h2>
			<p>
				Create a <code>package.json</code> in the file manager. SHSF runs{" "}
				<code>npm install</code> during the init phase and caches the result
				by a hash of <code>package.json</code> (and{" "}
				<code>package-lock.json</code> when present).
			</p>
			<CodeCaption>package.json</CodeCaption>
			<pre>
				<code>{`{
    "name": "my-function",
    "version": "1.0.0",
    "dependencies": {
        "axios": "^1.7.0"
    }
}`}</code>
			</pre>
			<CodeCaption>index.js — using an npm package</CodeCaption>
			<pre>
				<code>{`const axios = require('axios');

async function main(args) {
    const { data } = await axios.get('https://api.example.com/data');
    return { result: data };
}

module.exports = { main };`}</code>
			</pre>
			<Callout variant="info" title="Cached installs">
				<p>
					Packages are cached at{" "}
					<code>/node-cache/modules/function-&#123;id&#125;/node_modules</code>{" "}
					and symlinked into <code>/app/node_modules</code>. Re-installation
					only triggers when the <code>package.json</code> hash changes.
				</p>
			</Callout>

			<h2>Database communication</h2>
			<p>
				When your function file contains <code>_db_com</code>, SHSF
				automatically injects the Node.js storage helper:
			</p>
			<CodeCaption>index.js — db_com quick start</CodeCaption>
			<pre>
				<code>{`const { database } = require('./_db_com');

async function main(args) {
    const db = database();

    db.createStorage('cache', '');
    db.set('cache', 'key', 'hello');
    const value = db.get('cache', 'key');

    return { stored: value };
}

module.exports = { main };`}</code>
			</pre>

			<h2>Logging</h2>
			<p>
				Write to <code>console.log</code> or <code>console.error</code> —
				both are captured in the function execution log. stdout is redirected
				to stderr so it does not interfere with the result transport.
			</p>
			<CodeCaption>index.js — logging</CodeCaption>
			<pre>
				<code>{`async function main(args) {
    console.log('function invoked with route:', args.route);
    console.error('debug info:', JSON.stringify(args.queries));
    return { ok: true };
}

module.exports = { main };`}</code>
			</pre>

			<h2>File structure</h2>
			<CodeCaption>Typical layout</CodeCaption>
			<pre>
				<code>{`myfunction/
├── index.js        ← startup file (set in function settings)
└── package.json    ← npm dependencies (optional)`}</code>
			</pre>

			<h2>Caching behaviour</h2>
			<ul>
				<li>
					Installed packages are cached at{" "}
					<code>/node-cache/modules/function-&#123;id&#125;</code>.
				</li>
				<li>
					Re-installation is triggered when the hash of{" "}
					<code>package.json</code> (or <code>package-lock.json</code>)
					changes.
				</li>
				<li>
					A symlink at <code>/app/node_modules</code> keeps standard{" "}
					<code>require()</code> resolution working without extra config.
				</li>
			</ul>

			<NextStep href="/docs/kickoff" label="#22 Kickoff">
				Next: use AI-powered code generation to build production-ready function
				files from a single prompt.
			</NextStep>
		</DocsContentShell>
	);
};
