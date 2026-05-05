import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

const setupConfig = `# ~/.shsf_config
SHSF_INSTANCE=https://api.your-shsf-instance.com
SHSF_TOKEN=shsf_pat_your_token_here`;

const mappingFile = `{
  "default": {
    "id": "func_42a7c1",
    "from": "./hello-func"
  }
}`;

type CommandExample = {
	title: string;
	command: string;
	note?: string;
};

type Section = {
	title: string;
	description?: string;
	examples: CommandExample[];
};

const sections: Section[] = [
	{
		title: "Install & First Run",
		description:
			"Install the package globally, then let the CLI create its config from the first health check.",
		examples: [
			{
				title: "Install CLI",
				command: "pnpm add -g shsf-cli",
				note: "The package name is shsf-cli, but the installed command is shsf.",
			},
			{
				title: "First Health Check",
				command: "shsf health",
				note: "If ~/.shsf_config does not exist yet, the CLI prompts for SHSF_INSTANCE and SHSF_TOKEN.",
			},
			{
				title: "Manual Config File",
				command: setupConfig,
			},
		],
	},
	{
		title: "Inspect The Instance",
		description:
			"Quick discovery commands for verifying the instance and finding the function you want to work on.",
		examples: [
			{ title: "Get UI URL", command: "shsf uiurl" },
			{ title: "List Functions", command: "shsf count functions --full" },
			{ title: "Read One Function", command: "shsf get function func_42a7c1" },
		],
	},
	{
		title: "Pull & Push Files",
		description:
			"Remote sync uses a local folder as the working copy for your function files.",
		examples: [
			{
				title: "Pull Into Local Folder",
				command: "shsf remote pull --id func_42a7c1 --into ./hello-func --force",
			},
			{
				title: "Push Local Changes",
				command: "shsf remote push --id func_42a7c1 --from ./hello-func --force",
			},
			{
				title: ".shsf.json Mapping",
				command: mappingFile,
				note: "With this file in your project root, shsf remote push --force can reuse the mapped id and folder.",
			},
		],
	},
	{
		title: "Common Function Tasks",
		description:
			"Typical metadata, execution, env, and file commands you will use while iterating on a function.",
		examples: [
			{
				title: "Update Alias And Startup File",
				command:
					"shsf update function func_42a7c1 --execution-alias hello-api --startup-file main.py",
			},
			{
				title: "Execute With Payload",
				command:
					`shsf function execute --id func_42a7c1 --payload '{"name":"Ada"}' --no-stream`,
			},
			{
				title: "Set Environment Variable",
				command: "shsf env add --id func_42a7c1 --name API_KEY --value supersecret",
			},
			{
				title: "List Files",
				command: "shsf file list --function-id func_42a7c1",
			},
		],
	},
	{
		title: "CORS & Storage",
		description:
			"The CLI also exposes dedicated command groups for CORS allowlists and SHSF storage operations.",
		examples: [
			{
				title: "Add Allowed Origin",
				command: "shsf cors add https://app.example.com --id func_42a7c1",
			},
			{
				title: "List Allowed Origins",
				command: "shsf cors list --id func_42a7c1",
			},
			{
				title: "Create Storage",
				command: `shsf storage create --name audit-log --purpose 'Function audit trail'`,
			},
			{
				title: "Write Storage Item",
				command:
					`shsf storage set-item --name audit-log --key last-run --value '{"ok":true}'`,
			},
		],
	},
];

function CommandCard({ title, command, note }: CommandExample) {
	return (
		<div className="rounded-xl border border-primary/15 bg-background/30 p-4">
			<div className="mb-3 flex items-center justify-between gap-3">
				<h3 className="text-sm font-semibold text-primary">{title}</h3>
				<span className="text-[10px] uppercase tracking-[0.2em] text-text/40">
					shsf
				</span>
			</div>
			<pre className="bg-muted rounded-lg border border-primary/10 p-4 overflow-x-auto text-sm">
				<code>{command}</code>
			</pre>
			{note && <p className="mt-3 text-sm text-text/70 leading-6">{note}</p>}
		</div>
	);
}

function SectionCard({ title, description, examples }: Section) {
	return (
		<div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-gray-900/45 to-gray-800/35 p-6">
			<h2 className="text-2xl font-bold text-primary mb-3">{title}</h2>
			{description && <p className="mb-5 text-text/85 leading-7">{description}</p>}
			<div className="grid gap-4 md:grid-cols-2">
				{examples.map((example) => (
					<CommandCard key={`${title}-${example.title}`} {...example} />
				))}
			</div>
		</div>
	);
}

export function CLIDocPage() {
	return (
		<div className="min-h-screen bg-background text-text p-8">
			<div className="max-w-5xl mx-auto">
				<div className="mb-6">
					<a href="/docs" className="text-sm text-blue-500 hover:underline">
						← Back to docs
					</a>
				</div>

				<ScrollProgressbar />

				<div className="mb-8 rounded-2xl border border-primary/20 bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-6">
					<h1 className="text-3xl font-bold text-primary mb-2">
						SHSF CLI: Command Line Interface Guide
					</h1>
					<p className="mt-3 text-lg text-text/90 mb-5">
						The package name is <code>shsf-cli</code>, but the installed command is{" "}
						<code>shsf</code>. Use it to sync files, inspect resources, update
						function metadata, and run debug executions from your terminal.
					</p>
					<div className="grid gap-3 md:grid-cols-3">
						<div className="rounded-xl border border-primary/15 bg-background/25 p-4">
							<div className="text-xs uppercase tracking-[0.2em] text-text/50">
								Command
							</div>
							<div className="mt-2 font-mono text-primary">shsf</div>
						</div>
						<div className="rounded-xl border border-primary/15 bg-background/25 p-4">
							<div className="text-xs uppercase tracking-[0.2em] text-text/50">
								Config
							</div>
							<div className="mt-2 font-mono text-primary">~/.shsf_config</div>
						</div>
						<div className="rounded-xl border border-primary/15 bg-background/25 p-4">
							<div className="text-xs uppercase tracking-[0.2em] text-text/50">
								Project Mapping
							</div>
							<div className="mt-2 font-mono text-primary">.shsf.json</div>
						</div>
					</div>
				</div>

				<div className="space-y-6">
					{sections.map((section) => (
						<SectionCard key={section.title} {...section} />
					))}
				</div>

				<div className="mt-8 rounded-2xl border border-primary/20 bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-6">
					<h2 className="text-xl font-bold text-primary mb-3">Notes & Best Practices</h2>
					<ul className="list-disc list-inside space-y-2 text-text/90">
						<li>
							Use <code>shsf &lt;group&gt; &lt;command&gt; --help</code> for
							command-specific flags.
						</li>
						<li>
							<code>shsf remote push</code> reads <code>.shsfignore</code> and can
							write a starter <code>.shsf.json</code> mapping for repeated pushes.
						</li>
						<li>
							Current remote sync reads direct files from the selected folder, so
							keep your function entry files at that level.
						</li>
						<li>
							CORS commands accept <code>--id</code> directly and can also fall back
							to the default function declared in <code>.shsf.json</code>.
						</li>
					</ul>
				</div>

				<div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
					<h2 className="text-xl font-bold text-primary mb-3">
						🚀 Next Step - Database Communication
					</h2>
					<p className="text-text/90 mb-4">
						Learn how to use the Python database communication interface for fast
						persistent storage and retrieval.
					</p>
					<a
						href="/docs/db-com"
						className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
					>
						#14 Database Communication
						<span className="text-lg">→</span>
					</a>
				</div>
			</div>
		</div>
	);
}
