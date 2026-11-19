import { lazy, type ComponentType } from "react";

export const documentationCategories = ["Install", "Create and test", "Configure", "Deploy and operate", "Automate", "Troubleshoot"] as const;

export type DocumentationEntry = {
	key: string;
	title: string;
	description: string;
	category: (typeof documentationCategories)[number];
	path: `/docs/${string}`;
	related: string[];
	component: ComponentType;
};

type DocumentationDefinition = Omit<DocumentationEntry, "component">;

const documentationDefinitions: DocumentationDefinition[] = [
	{ key: "getting-started", title: "Getting Started", description: "Deploy SHSF with Docker Compose, configure environment variables, and create your first account.", category: "Install", path: "/docs/getting-started", related: ["my-first-function", "environment-variables"] },
	{ key: "my-first-function", title: "My First Function", description: "Build a Discord Monday-greeting bot — covers creation, dependencies, env vars, and cron triggers.", category: "Create and test", path: "/docs/my-first-function", related: ["data-passing", "environment-variables"] },
	{ key: "data-passing", title: "Data Passing", description: "Explore the full args object: body, queries, headers, route, method, and raw_body.", category: "Create and test", path: "/docs/data-passing", related: ["custom-responses", "raw-body"] },
	{ key: "custom-responses", title: "Custom Responses", description: "Control HTTP status codes, headers, and response body using the SHSF v2 response envelope.", category: "Create and test", path: "/docs/custom-responses", related: ["redirects", "custom-cors"] },
	{ key: "routing", title: "Routing", description: "Handle multiple endpoints in one function using args.route — including deep paths after the URL.", category: "Create and test", path: "/docs/routing", related: ["custom-cors", "data-passing"] },
	{ key: "raw-body", title: "Raw Body", description: "Handle binary uploads and non-JSON payloads via args.raw_body — a Latin-1 binary string.", category: "Create and test", path: "/docs/raw-body", related: ["data-passing", "user-interfaces"] },
	{ key: "redirects", title: "Redirects", description: "Issue 301 or 302 HTTP redirects by returning a _location field in the v2 response envelope.", category: "Create and test", path: "/docs/redirects", related: ["custom-responses", "routing"] },
	{ key: "user-interfaces", title: "User Interfaces", description: "Serve HTML pages from functions by setting Content-Type: text/html and returning HTML in _res.", category: "Create and test", path: "/docs/user-interfaces", related: ["serve-only", "custom-responses"] },
	{ key: "serve-only", title: "Serve Only HTML", description: "Set a .html file as the startup file to serve it directly, bypassing all runtime machinery.", category: "Create and test", path: "/docs/serve-only", related: ["user-interfaces", "access-tokens"] },
	{ key: "persistent-data", title: "Persistent Data", description: "Persist data across invocations using /app/ filesystem storage or the built-in db_com key-value helper.", category: "Create and test", path: "/docs/persistent-data", related: ["db-com", "redirects"] },
	{ key: "db-com", title: "Database Communication", description: "Built-in key-value storage for Python, Go, and Node.js — no token, no HTTP client, TTL expiry supported.", category: "Create and test", path: "/docs/db-com", related: ["persistent-data", "go-runtime"] },
	{ key: "call-functions", title: "Calling Functions", description: "Invoke another function you own with the built-in callF helper — Python, Node.js, and Go included.", category: "Create and test", path: "/docs/call-functions", related: ["nodejs-runtime", "go-runtime"] },
	{ key: "environment-variables", title: "Environment Variables", description: "Store secrets and config outside your code — at the account level or per-function, live-updated.", category: "Configure", path: "/docs/environment-variables", related: ["secure-headers", "access-tokens"] },
	{ key: "secure-headers", title: "Secure Headers", description: "Require an x-secure-header value on every HTTP request to lock down public endpoints.", category: "Configure", path: "/docs/secure-headers", related: ["environment-variables", "access-tokens"] },
	{ key: "custom-cors", title: "Custom CORS", description: "Set a per-function allowlist of trusted origins to control browser cross-origin access.", category: "Configure", path: "/docs/custom-cors", related: ["secure-headers", "routing"] },
	{ key: "access-tokens", title: "Access Tokens", description: "Generate long-lived API tokens for scripts and integrations — sent via x-access-key header.", category: "Configure", path: "/docs/access-tokens", related: ["secure-headers", "cli"] },
	{ key: "guest-users", title: "Guest Users", description: "Create credential pairs tied to a single function for controlled collaborator access.", category: "Configure", path: "/docs/guest-users", related: ["access-tokens", "execution-alias"] },
	{ key: "execution-alias", title: "Execution Alias", description: "Assign a human-readable alias to replace the UUID in your function's invocation URL.", category: "Configure", path: "/docs/execution-alias", related: ["guest-users", "ffmpeg-install"] },
	{ key: "version-control", title: "VERSION // CONTROL", description: "Deploy from a Git repo — clone, manual pull, periodic pull, monorepo source directories.", category: "Deploy and operate", path: "/docs/version-control", related: ["cli", "clone-function"] },
	{ key: "clone-function", title: "Cloning Functions", description: "Duplicate a function with all files, settings, and env vars — aliases, git config, and logs excluded.", category: "Deploy and operate", path: "/docs/clone-function", related: ["version-control", "opencv-install"] },
	{ key: "cli", title: "CLI Usage", description: "Use shsf-cli to sync files, inspect functions, manage env vars, and run debug executions.", category: "Deploy and operate", path: "/docs/cli", related: ["access-tokens", "version-control"] },
	{ key: "go-runtime", title: "Go Runtime", description: "Compile-once, cache-forever Go functions with module support, db_com, and custom responses.", category: "Deploy and operate", path: "/docs/go-runtime", related: ["nodejs-runtime", "db-com"] },
	{ key: "nodejs-runtime", title: "Node.js Runtime", description: "npm-backed Node.js functions with package caching, db_com, and full async/await support.", category: "Deploy and operate", path: "/docs/nodejs-runtime", related: ["go-runtime", "kickoff"] },
	{ key: "ffmpeg-install", title: "FFmpeg Installation", description: "Auto-install FFmpeg on first container init using a marker file — video and audio processing ready.", category: "Deploy and operate", path: "/docs/ffmpeg-install", related: ["opencv-install", "go-runtime"] },
	{ key: "opencv-install", title: "OpenCV Installation", description: "Auto-install python3-opencv on first init via a marker file — computer vision in Python functions.", category: "Deploy and operate", path: "/docs/opencv-install", related: ["ffmpeg-install", "go-runtime"] },
	{ key: "docker-mount", title: "Docker Mount", description: "Mount /var/run/docker.sock to give a function full control over Docker on the host — high risk.", category: "Deploy and operate", path: "/docs/docker-mount", related: ["serve-only", "go-runtime"] },
	{ key: "log-analysis", title: "Log Analysis", description: "Opt-in advisory failure and priority signals for new logs via your configured AI provider.", category: "Deploy and operate", path: "/docs/log-analysis", related: ["kickoff", "environment-variables"] },
	{ key: "triggers", title: "Scheduled Triggers", description: "Run a function on a cron schedule with an optional JSON payload, or fire a trigger manually.", category: "Automate", path: "/docs/triggers", related: ["my-first-function", "data-passing"] },
	{ key: "kickoff", title: "Kickoff", description: "AI-powered code generation via OpenRouter — describe your function and get production-ready files.", category: "Automate", path: "/docs/kickoff", related: ["version-control", "clone-function"] },
	{ key: "troubleshooting", title: "Troubleshooting", description: "Fix startup failures, HTTP errors from /exec/, CORS problems, and misbehaving functions.", category: "Troubleshoot", path: "/docs/troubleshooting", related: ["getting-started", "secure-headers"] },
];

const components: Record<string, ComponentType> = {
	"getting-started": lazy(() => import("./getting-started").then(({ DocsGettingStarted }) => ({ default: DocsGettingStarted }))),
	"my-first-function": lazy(() => import("./my-first-function").then(({ MyFirstFunctionDoc }) => ({ default: MyFirstFunctionDoc }))),
	"data-passing": lazy(() => import("./data-passing").then(({ DataPassingPage }) => ({ default: DataPassingPage }))),
	"custom-responses": lazy(() => import("./custom-responses").then(({ CustomResponsesPage }) => ({ default: CustomResponsesPage }))),
	"environment-variables": lazy(() => import("./environment-variables").then(({ EnvironmentVariablesPage }) => ({ default: EnvironmentVariablesPage }))),
	"secure-headers": lazy(() => import("./secure-headers").then(({ SecureHeadersPage }) => ({ default: SecureHeadersPage }))),
	"persistent-data": lazy(() => import("./persistent-data").then(({ PersistentDataPage }) => ({ default: PersistentDataPage }))),
	redirects: lazy(() => import("./redirects").then(({ RedirectsPage }) => ({ default: RedirectsPage }))),
	"raw-body": lazy(() => import("./raw-body").then(({ RawBodyPage }) => ({ default: RawBodyPage }))),
	"user-interfaces": lazy(() => import("./user-interfaces").then(({ UserInterfacesPage }) => ({ default: UserInterfacesPage }))),
	"docker-mount": lazy(() => import("./docker-mount").then(({ DockerMountPage }) => ({ default: DockerMountPage }))),
	"serve-only": lazy(() => import("./serve-only").then(({ ServeOnlyHtmlPage }) => ({ default: ServeOnlyHtmlPage }))),
	"access-tokens": lazy(() => import("./access-tokens").then(({ AccessTokensDocPage }) => ({ default: AccessTokensDocPage }))),
	cli: lazy(() => import("./cli").then(({ CLIDocPage }) => ({ default: CLIDocPage }))),
	"db-com": lazy(() => import("./db-com").then(({ DatabaseComDocPage }) => ({ default: DatabaseComDocPage }))),
	routing: lazy(() => import("./routing").then(({ RoutingDocPage }) => ({ default: RoutingDocPage }))),
	"custom-cors": lazy(() => import("./custom-cors").then(({ CustomCorsDocPage }) => ({ default: CustomCorsDocPage }))),
	"guest-users": lazy(() => import("./guest-users").then(({ GuestUsersDocPage }) => ({ default: GuestUsersDocPage }))),
	"execution-alias": lazy(() => import("./execution-alias")),
	"ffmpeg-install": lazy(() => import("./ffmpeg-install").then(({ FfmpegInstallPage }) => ({ default: FfmpegInstallPage }))),
	"go-runtime": lazy(() => import("./go-runtime").then(({ DocsGoRuntime }) => ({ default: DocsGoRuntime }))),
	"nodejs-runtime": lazy(() => import("./nodejs-runtime").then(({ DocsNodeJsRuntime }) => ({ default: DocsNodeJsRuntime }))),
	kickoff: lazy(() => import("./kickoff").then(({ DOCSKICKOFF }) => ({ default: DOCSKICKOFF }))),
	"log-analysis": lazy(() => import("./log-analysis").then(({ LogAnalysisDocPage }) => ({ default: LogAnalysisDocPage }))),
	"version-control": lazy(() => import("./version-control").then(({ DocsVersionControl }) => ({ default: DocsVersionControl }))),
	"clone-function": lazy(() => import("./clone-function").then(({ DocsCloneFunction }) => ({ default: DocsCloneFunction }))),
	"opencv-install": lazy(() => import("./opencv-install").then(({ OpencvInstallPage }) => ({ default: OpencvInstallPage }))),
	"call-functions": lazy(() => import("./call-functions").then(({ CallFunctionsDocPage }) => ({ default: CallFunctionsDocPage }))),
	troubleshooting: lazy(() => import("./troubleshooting").then(({ TroubleshootingDocPage }) => ({ default: TroubleshootingDocPage }))),
	triggers: lazy(() => import("./triggers").then(({ TriggersDocPage }) => ({ default: TriggersDocPage }))),
};

export const documentation: DocumentationEntry[] = documentationDefinitions.map((entry) => ({ ...entry, component: components[entry.key] }));

export const documentationRoutes = documentation.map(({ path, title, component }) => ({ path, name: title, component, requireAuth: false }));

export function getDocumentation(path: string) {
	return documentation.find((entry) => entry.path === path);
}

export function getDocumentationNavigation(path: string) {
	const index = documentation.findIndex((entry) => entry.path === path);
	return index < 0 ? { previous: undefined, next: undefined, related: [] } : {
		previous: documentation[index - 1],
		next: documentation[index + 1],
		related: [...new Set([...documentation[index].related, "troubleshooting"])].filter((key) => key !== documentation[index].key).map((key) => documentation.find((entry) => entry.key === key)).filter((entry): entry is DocumentationEntry => Boolean(entry)),
	};
}

export function validateDocumentationRoutes(paths: readonly string[]) {
	const knownPaths = new Set(documentation.map((entry) => entry.path));
	const knownKeys = new Set(documentation.map((entry) => entry.key));
	const documentationPaths = paths.filter((path) => path.startsWith("/docs/"));
	return [
		...documentation.filter((entry) => !documentationPaths.includes(entry.path)).map((entry) => `Missing route: ${entry.path}`),
		...documentationPaths.filter((path) => !knownPaths.has(path)).map((path) => `Unindexed route: ${path}`),
		...documentation.flatMap((entry) => entry.related.filter((key) => !knownKeys.has(key)).map((key) => `Unknown related document ${key} on ${entry.key}`)),
	];
}
