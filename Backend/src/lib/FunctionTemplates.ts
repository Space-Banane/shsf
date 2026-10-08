import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type TemplateRuntime = "python" | "go" | "javascript" | "html";

export interface FunctionTemplate {
	id: string;
	name: string;
	runtime: TemplateRuntime;
	useCase: string;
	description: string;
	fileName: string;
	setup: string;
	samplePayload: Record<string, unknown>;
}

const templateDefinitions: Array<Omit<FunctionTemplate, "id" | "runtime" | "fileName"> & { slug: string }> = [
	{
		slug: "http_api",
		name: "HTTP API",
		useCase: "HTTP API",
		description: "A small JSON endpoint that validates a request and returns a response.",
		setup: "No dependencies required. Enable Allow HTTP to invoke this endpoint over HTTP.",
		samplePayload: { body: { name: "Ada" } },
	},
	{
		slug: "webhook",
		name: "Webhook receiver",
		useCase: "Webhook",
		description: "Accept an incoming event and acknowledge it with a stable JSON response.",
		setup: "No dependencies required. Enable Allow HTTP and configure the provider webhook URL.",
		samplePayload: { body: { event: "order.created", id: "evt_demo" } },
	},
	{
		slug: "scheduled_job",
		name: "Scheduled job",
		useCase: "Scheduled job",
		description: "A repeatable job entry point with a clear place for scheduled work.",
		setup: "Create a cron trigger after creation. No dependencies are required.",
		samplePayload: { body: { dry_run: true } },
	},
	{
		slug: "static_site",
		name: "Static site",
		useCase: "Static site",
		description: "A minimal HTML page for documentation, status pages, or a landing page.",
		setup: "Set the startup file to index.html. HTML functions are served without a runtime container.",
		samplePayload: {},
	},
];

const runtimeFiles: Record<TemplateRuntime, string> = {
	python: "main.py",
	go: "main_user.go",
	javascript: "index.js",
	html: "index.html",
};

export const FUNCTION_TEMPLATES: FunctionTemplate[] = (Object.keys(runtimeFiles) as TemplateRuntime[]).flatMap((runtime) =>
	templateDefinitions.filter((definition) => runtime === "html" ? definition.slug === "static_site" : definition.slug !== "static_site").map((definition) => ({
		...definition,
		runtime,
		id: `${runtime}_${definition.slug}`,
		fileName: runtimeFiles[runtime],
	})),
);

export function getFunctionTemplate(id: string): FunctionTemplate | undefined {
	return FUNCTION_TEMPLATES.find((template) => template.id === id);
}

export function getTemplatesForRuntime(runtime: string): FunctionTemplate[] {
	const normalized = runtime.toLowerCase().split(":")[0];
	const templateRuntime = normalized === "golang" ? "go" : normalized === "node" ? "javascript" : normalized;
	return FUNCTION_TEMPLATES.filter((template) => template.runtime === templateRuntime);
}

export async function readFunctionTemplate(template: FunctionTemplate): Promise<string> {
	return readFile(join(__dirname, "../../fill_examples", `${template.id}.txt`), "utf8");
}
