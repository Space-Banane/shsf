import type { FC } from "react";
import { AccessTokensDocPage } from "./access-tokens";
import { CallFunctionsDocPage } from "./call-functions";
import { DocsCloneFunction } from "./clone-function";
import { CustomCorsDocPage } from "./custom-cors";
import { CustomResponsesPage } from "./custom-responses";
import { DataPassingPage } from "./data-passing";
import { DatabaseComDocPage } from "./db-com";
import { DockerMountPage } from "./docker-mount";
import { EnvironmentVariablesPage } from "./environment-variables";
import ExecutionAliasPage from "./execution-alias";
import { FfmpegInstallPage } from "./ffmpeg-install";
import { DocsGettingStarted } from "./getting-started";
import { DocsGoRuntime } from "./go-runtime";
import { GuestUsersDocPage } from "./guest-users";
import { DOCSKICKOFF } from "./kickoff";
import { MyFirstFunctionDoc } from "./my-first-function";
import { DocsNodeJsRuntime } from "./nodejs-runtime";
import { OpencvInstallPage } from "./opencv-install";
import { PersistentDataPage } from "./persistent-data";
import { RawBodyPage } from "./raw-body";
import { RedirectsPage } from "./redirects";
import { RoutingDocPage } from "./routing";
import { SecureHeadersPage } from "./secure-headers";
import { ServeOnlyHtmlPage } from "./serve-only";
import { UserInterfacesPage } from "./user-interfaces";
import { CLIDocPage } from "./cli";
import { DocsVersionControl } from "./version-control";

export type DocumentationEntry = {
	key: string;
	title: string;
	description: string;
	category: "Getting started" | "Building functions" | "Advanced";
	path: `/docs/${string}`;
	related: string[];
	component: FC;
};

type DocumentationDefinition = Omit<DocumentationEntry, "component">;

const documentationDefinitions: DocumentationDefinition[] = [
	{ key: "getting-started", title: "Getting Started", description: "Deploy SHSF with Docker Compose, configure environment variables, and create your first account.", category: "Getting started", path: "/docs/getting-started", related: ["my-first-function", "environment-variables"] },
	{ key: "my-first-function", title: "My First Function", description: "Build a Discord Monday-greeting bot — covers creation, dependencies, env vars, and cron triggers.", category: "Getting started", path: "/docs/my-first-function", related: ["data-passing", "environment-variables"] },
	{ key: "data-passing", title: "Data Passing", description: "Explore the full args object: body, queries, headers, route, method, and raw_body.", category: "Getting started", path: "/docs/data-passing", related: ["custom-responses", "raw-body"] },
	{ key: "custom-responses", title: "Custom Responses", description: "Control HTTP status codes, headers, and response body using the SHSF v2 response envelope.", category: "Getting started", path: "/docs/custom-responses", related: ["redirects", "custom-cors"] },
	{ key: "environment-variables", title: "Environment Variables", description: "Store secrets and config outside your code — at the account level or per-function, live-updated.", category: "Getting started", path: "/docs/environment-variables", related: ["secure-headers", "access-tokens"] },
	{ key: "secure-headers", title: "Secure Headers", description: "Require an x-secure-header value on every HTTP request to lock down public endpoints.", category: "Getting started", path: "/docs/secure-headers", related: ["environment-variables", "access-tokens"] },
	{ key: "persistent-data", title: "Persistent Data", description: "Persist data across invocations using /app/ filesystem storage or the built-in db_com key-value helper.", category: "Getting started", path: "/docs/persistent-data", related: ["db-com", "redirects"] },
	{ key: "redirects", title: "Redirects", description: "Issue 301 or 302 HTTP redirects by returning a _location field in the v2 response envelope.", category: "Getting started", path: "/docs/redirects", related: ["custom-responses", "routing"] },
	{ key: "raw-body", title: "Raw Body", description: "Handle binary uploads and non-JSON payloads via args.raw_body — a Latin-1 binary string.", category: "Getting started", path: "/docs/raw-body", related: ["data-passing", "user-interfaces"] },
	{ key: "user-interfaces", title: "User Interfaces", description: "Serve HTML pages from functions by setting Content-Type: text/html and returning HTML in _res.", category: "Building functions", path: "/docs/user-interfaces", related: ["serve-only", "custom-responses"] },
	{ key: "docker-mount", title: "Docker Mount", description: "Mount /var/run/docker.sock to give a function full control over Docker on the host — high risk.", category: "Building functions", path: "/docs/docker-mount", related: ["serve-only", "go-runtime"] },
	{ key: "serve-only", title: "Serve Only HTML", description: "Set a .html file as the startup file to serve it directly, bypassing all runtime machinery.", category: "Building functions", path: "/docs/serve-only", related: ["user-interfaces", "access-tokens"] },
	{ key: "access-tokens", title: "Access Tokens", description: "Generate long-lived API tokens for scripts and integrations — sent via x-access-key header.", category: "Building functions", path: "/docs/access-tokens", related: ["secure-headers", "cli"] },
	{ key: "cli", title: "CLI Usage", description: "Use shsf-cli to sync files, inspect functions, manage env vars, and run debug executions.", category: "Building functions", path: "/docs/cli", related: ["access-tokens", "version-control"] },
	{ key: "db-com", title: "Database Communication", description: "Built-in key-value storage for Python and Go — no token, no HTTP client, TTL expiry supported.", category: "Building functions", path: "/docs/db-com", related: ["persistent-data", "go-runtime"] },
	{ key: "routing", title: "Routing", description: "Handle multiple endpoints in one function using args.route — the single path segment after the URL.", category: "Building functions", path: "/docs/routing", related: ["custom-cors", "data-passing"] },
	{ key: "custom-cors", title: "Custom CORS", description: "Set a per-function allowlist of trusted origins to control browser cross-origin access.", category: "Building functions", path: "/docs/custom-cors", related: ["secure-headers", "routing"] },
	{ key: "guest-users", title: "Guest Users", description: "Create credential pairs tied to a single function for controlled collaborator access.", category: "Building functions", path: "/docs/guest-users", related: ["access-tokens", "execution-alias"] },
	{ key: "execution-alias", title: "Execution Alias", description: "Assign a human-readable alias to replace the UUID in your function's invocation URL.", category: "Building functions", path: "/docs/execution-alias", related: ["guest-users", "ffmpeg-install"] },
	{ key: "ffmpeg-install", title: "FFmpeg Installation", description: "Auto-install FFmpeg on first container init using a marker file — video and audio processing ready.", category: "Advanced", path: "/docs/ffmpeg-install", related: ["opencv-install", "go-runtime"] },
	{ key: "go-runtime", title: "Go Runtime", description: "Compile-once, cache-forever Go functions with module support, db_com, and custom responses.", category: "Advanced", path: "/docs/go-runtime", related: ["nodejs-runtime", "db-com"] },
	{ key: "nodejs-runtime", title: "Node.js Runtime", description: "npm-backed Node.js functions with package caching, db_com, and full async/await support.", category: "Advanced", path: "/docs/nodejs-runtime", related: ["go-runtime", "kickoff"] },
	{ key: "kickoff", title: "Kickoff", description: "AI-powered code generation via OpenRouter — describe your function and get production-ready files.", category: "Advanced", path: "/docs/kickoff", related: ["version-control", "clone-function"] },
	{ key: "version-control", title: "VERSION // CONTROL", description: "Deploy from a Git repo — clone, manual pull, periodic pull, monorepo source directories.", category: "Advanced", path: "/docs/version-control", related: ["cli", "clone-function"] },
	{ key: "clone-function", title: "Cloning Functions", description: "Duplicate a function with all files, settings, and env vars — aliases, git config, and logs excluded.", category: "Advanced", path: "/docs/clone-function", related: ["version-control", "opencv-install"] },
	{ key: "opencv-install", title: "OpenCV Installation", description: "Auto-install python3-opencv on first init via a marker file — computer vision in Python functions.", category: "Advanced", path: "/docs/opencv-install", related: ["ffmpeg-install", "go-runtime"] },
	{ key: "call-functions", title: "Calling Functions", description: "Invoke another function you own with the built-in callF helper — Python, Node.js, and Go included.", category: "Advanced", path: "/docs/call-functions", related: ["nodejs-runtime", "go-runtime"] },
];

const components: Record<string, FC> = {
	"getting-started": DocsGettingStarted, "my-first-function": MyFirstFunctionDoc, "data-passing": DataPassingPage, "custom-responses": CustomResponsesPage, "environment-variables": EnvironmentVariablesPage, "secure-headers": SecureHeadersPage, "persistent-data": PersistentDataPage, redirects: RedirectsPage, "raw-body": RawBodyPage, "user-interfaces": UserInterfacesPage, "docker-mount": DockerMountPage, "serve-only": ServeOnlyHtmlPage, "access-tokens": AccessTokensDocPage, cli: CLIDocPage, "db-com": DatabaseComDocPage, routing: RoutingDocPage, "custom-cors": CustomCorsDocPage, "guest-users": GuestUsersDocPage, "execution-alias": ExecutionAliasPage, "ffmpeg-install": FfmpegInstallPage, "go-runtime": DocsGoRuntime, "nodejs-runtime": DocsNodeJsRuntime, kickoff: DOCSKICKOFF, "version-control": DocsVersionControl, "clone-function": DocsCloneFunction, "opencv-install": OpencvInstallPage, "call-functions": CallFunctionsDocPage,
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
		related: documentation[index].related.map((key) => documentation.find((entry) => entry.key === key)).filter((entry): entry is DocumentationEntry => Boolean(entry)),
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
