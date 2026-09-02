import { useEffect, useState, useCallback } from "react";
import {
	listAccessTokens,
	generateAccessToken,
	revokeAccessToken,
} from "../services/backend.accesstokens";
import { Token } from "../types/Prisma";
import { Icon } from "../components/ui/Icon";
import { useShiftEnterSubmit } from "../hooks/useShiftEnterSubmit";

const AGENT_KEY_NAME = "SHSF Agents";

function getMcpUrl() {
	return `${process.env.REACT_APP_API_URL || window.location.origin}/mcp`;
}

// ── command modal ─────────────────────────────────────────────────────────────

interface CommandModalProps {
	label: string;
	sublabel: string;
	content: string;
	onClose: () => void;
}

function CommandModal({ label, sublabel, content, onClose }: CommandModalProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(content);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	useShiftEnterSubmit(handleCopy, true);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={onClose}
		>
			<div
				className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-gray-900/95 to-gray-800/95 shadow-2xl mx-4"
				onClick={(e) => e.stopPropagation()}
			>
				{/* header */}
				<div className="flex items-start justify-between border-b border-primary/10 px-6 py-5">
					<div>
						<h2 className="text-xl font-bold text-primary">{label}</h2>
						<p className="mt-0.5 text-sm text-text/50">{sublabel}</p>
					</div>
					<button
						onClick={onClose}
						className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-background/40 text-text/70 hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-colors"
					>
						<Icon name="x-mark" className="w-4 h-4" />
					</button>
				</div>

				{/* body */}
				<div className="p-6 space-y-4">
					<div className="rounded-lg border border-primary/10 bg-background/40 p-4">
						<div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-text/40">
							{sublabel}
						</div>
						<pre className="font-mono text-sm leading-relaxed text-primary/90 whitespace-pre-wrap break-all overflow-x-auto">
							{content}
						</pre>
					</div>

					<div className="flex items-center justify-between gap-4">
						<p className="text-xs text-text/40">Ready to copy into your terminal or config file.</p>
						<button
							onClick={handleCopy}
							className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white border border-blue-700 hover:bg-blue-700 hover:border-blue-800 hover:scale-105 transition-all"
						>
							<Icon name={copied ? "check" : "document-duplicate"} className="w-4 h-4" />
							{copied ? "Copied!" : "Copy"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

// ── agent tool button ─────────────────────────────────────────────────────────

interface AgentTool {
	id: string;
	name: string;
	tagline: string;
	sublabel: string;
	buildConfig: (url: string, key: string) => string;
}

const AGENT_TOOLS: AgentTool[] = [
	{
		id: "claude",
		name: "Claude Code",
		tagline: "Run once in any terminal where claude is installed.",
		sublabel: "Terminal — run once",
		buildConfig: (url, key) =>
			`claude mcp add --transport http shsf ${url} --header "x-access-key: ${key}"`,
	},
	{
		id: "openclaw",
		name: "OpenClaw",
		tagline: "Run once in any terminal where openclaw is installed.",
		sublabel: "Terminal — run once",
		buildConfig: (url, key) =>
			`openclaw mcp add shsf --url ${url} --transport streamable-http --header "x-access-key: ${key}"`,
	},
	{
		id: "opencode",
		name: "OpenCode",
		tagline: "Paste into your opencode.json config file.",
		sublabel: "opencode.json",
		buildConfig: (url, key) =>
			JSON.stringify(
				{
					$schema: "https://opencode.ai/config.json",
					mcp: {
						shsf: {
							type: "remote",
							url,
							enabled: true,
							headers: { "x-access-key": key },
						},
					},
				},
				null,
				2,
			),
	},
	{
		id: "codex",
		name: "Codex CLI",
		tagline: "Paste into your ~/.codex/config.toml file.",
		sublabel: "~/.codex/config.toml",
		buildConfig: (url, key) =>
			`[mcp_servers.shsf]\nurl = "${url}"\nenabled = true\nhttp_headers = { "x-access-key" = "${key}" }`,
	},
];

interface AgentToolButtonProps {
	tool: AgentTool;
	url: string;
	apiKey: string;
}

function AgentToolButton({ tool, url, apiKey }: AgentToolButtonProps) {
	const [open, setOpen] = useState(false);
	const content = tool.buildConfig(url, apiKey);

	return (
		<>
			<button
				onClick={() => setOpen(true)}
				className="group w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
			>
				<div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
					<Icon name="code-bracket" className="w-5 h-5 text-primary" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="text-sm font-semibold text-text/90 group-hover:text-text transition-colors">
						{tool.name}
					</div>
					<div className="text-xs text-text/40 mt-0.5">{tool.tagline}</div>
				</div>
				<div className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium text-primary/60 group-hover:text-primary transition-colors">
					<span>View command</span>
					<Icon name="chevron-right" className="w-3.5 h-3.5" />
				</div>
			</button>

			{open && (
				<CommandModal
					label={tool.name}
					sublabel={tool.sublabel}
					content={content}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	);
}

// ── mcp tool badge ────────────────────────────────────────────────────────────

function ToolBadge({ name, description }: { name: string; description: string }) {
	return (
		<div className="flex gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
			<div className="mt-0.5 flex-shrink-0 h-5 w-5 rounded bg-primary/15 flex items-center justify-center">
				<Icon name="bolt" className="w-3 h-3 text-primary" />
			</div>
			<div>
				<code className="text-sm font-mono font-semibold text-primary">{name}</code>
				<p className="mt-0.5 text-sm text-text/60">{description}</p>
			</div>
		</div>
	);
}

type McpTool = { name: string; description: string };

async function fetchMcpTools(): Promise<McpTool[]> {
	const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/mcp`);
	if (!res.ok) return [];
	const data = await res.json();
	return Array.isArray(data.tools) ? data.tools : [];
}

// ── page ──────────────────────────────────────────────────────────────────────

export function AgentsPage({ user }: { user: any }) {
	const [tokens, setTokens] = useState<Token[]>([]);
	const [loading, setLoading] = useState(true);
	const [agentToken, setAgentToken] = useState<string | null>(null);
	const [genLoading, setGenLoading] = useState(false);
	const [genError, setGenError] = useState<string | null>(null);
	const [urlCopied, setUrlCopied] = useState(false);
	const [mcpTools, setMcpTools] = useState<McpTool[]>([]);

	const agentKeyRecord = tokens.find((t) => t.name === AGENT_KEY_NAME);

	const fetchTokens = useCallback(async () => {
		setLoading(true);
		try {
			const data = await listAccessTokens();
			setTokens(data || []);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchTokens();
		fetchMcpTools().then(setMcpTools);
	}, [fetchTokens]);

	const handleGenerate = async () => {
		setGenLoading(true);
		setGenError(null);
		try {
			if (agentKeyRecord) {
				await revokeAccessToken(agentKeyRecord.id);
			}
			const res = await generateAccessToken(AGENT_KEY_NAME, "MCP agent access key");
			if (res.status === "OK" && res.token) {
				setAgentToken(res.token);
				await fetchTokens();
			} else {
				setGenError(res.message || "Failed to generate key");
			}
		} catch (e: any) {
			setGenError(e.message || "Failed to generate key");
		} finally {
			setGenLoading(false);
		}
	};

	const hasFullKey = agentToken !== null;
	const displayKey = agentToken ?? (agentKeyRecord ? agentKeyRecord.tokenMasked : null);
	const commandKey = hasFullKey ? agentToken! : agentKeyRecord?.tokenMasked ?? "YOUR_API_KEY";

	return (
		<div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
			{/* Header */}
			<div>
				<div className="flex items-center gap-3 mb-2">
					<div className="h-9 w-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
						<Icon name="sparkles" className="w-5 h-5 text-primary" />
					</div>
					<h1 className="text-2xl font-bold text-text">Agents</h1>
				</div>
				<p className="text-text/60 text-sm leading-relaxed">
					Connect AI coding agents to your SHSF serverless functions via the built-in
					MCP server. Once connected, agents can list and execute any of your functions directly.
				</p>
			</div>

			{/* MCP URL */}
			<section className="space-y-3">
				<h2 className="text-sm font-semibold text-text/80 uppercase tracking-widest">
					MCP Server URL
				</h2>
				<div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-primary/20 bg-primary/5">
					<code className="flex-1 text-sm font-mono text-primary break-all">{getMcpUrl()}</code>
					<button
						onClick={() => {
							navigator.clipboard.writeText(getMcpUrl());
							setUrlCopied(true);
							setTimeout(() => setUrlCopied(false), 1500);
						}}
						className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors"
					>
						<Icon name={urlCopied ? "check" : "document-duplicate"} className="w-3.5 h-3.5" />
						{urlCopied ? "Copied" : "Copy"}
					</button>
				</div>
			</section>

			{/* API Key */}
			<section className="space-y-3">
				<h2 className="text-sm font-semibold text-text/80 uppercase tracking-widest">
					Agent API Key
				</h2>

				{loading ? (
					<div className="h-20 rounded-lg border border-white/[0.07] bg-white/[0.02] animate-pulse" />
				) : (
					<div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4 space-y-4">
						{agentKeyRecord ? (
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<Icon name="check" className="w-4 h-4 text-green-400" />
									<span className="text-sm font-medium text-text/80">Key exists</span>
									<span className="ml-auto font-mono text-xs text-text/40">{displayKey}</span>
								</div>
								{!hasFullKey && (
									<p className="text-xs text-text/40 pl-6">
										Full key not shown after creation — regenerate below if you've lost it.
									</p>
								)}
							</div>
						) : (
							<p className="text-sm text-text/60">
								No agent key yet. Generate one to unlock the ready-to-copy commands below.
							</p>
						)}

						{genError && <p className="text-sm text-red-400">{genError}</p>}

						<button
							onClick={handleGenerate}
							disabled={genLoading}
							className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/15 border border-primary/25 hover:bg-primary/25 text-primary text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<Icon name="key" className="w-4 h-4" />
							{genLoading ? "Generating…" : agentKeyRecord ? "Regenerate Key" : "Generate Agent Key"}
						</button>
					</div>
				)}

				{agentToken && (
					<div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-300/80">
						Copy your key now — it won't be shown again after you navigate away.
					</div>
				)}
			</section>

			{/* Tool buttons */}
			{(hasFullKey || agentKeyRecord) && (
				<section className="space-y-3">
					<h2 className="text-sm font-semibold text-text/80 uppercase tracking-widest">
						Connect Your Agent
					</h2>
					<div className="space-y-2">
						{AGENT_TOOLS.map((tool) => (
							<AgentToolButton
								key={tool.id}
								tool={tool}
								url={getMcpUrl()}
								apiKey={commandKey}
							/>
						))}
					</div>
				</section>
			)}

			{/* Available MCP tools */}
			<section className="space-y-3">
				<h2 className="text-sm font-semibold text-text/80 uppercase tracking-widest">
					Available MCP Tools
					{mcpTools.length > 0 && (
						<span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono bg-primary/10 text-primary/70 normal-case tracking-normal">
							{mcpTools.length}
						</span>
					)}
				</h2>
				{mcpTools.length === 0 ? (
					<div className="space-y-2">
						{[1, 2, 3].map((i) => (
							<div
								key={i}
								className="h-12 rounded-lg border border-white/[0.06] bg-white/[0.02] animate-pulse"
							/>
						))}
					</div>
				) : (
					<div className="space-y-2">
						{mcpTools.map((tool) => (
							<ToolBadge key={tool.name} name={tool.name} description={tool.description} />
						))}
					</div>
				)}
			</section>
		</div>
	);
}

export default AgentsPage;
