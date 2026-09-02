import { useEffect, useState } from "react";
import {
	listAccessTokens,
	generateAccessToken,
	revokeAccessToken,
} from "../services/backend.accesstokens";
import { Token } from "../types/Prisma";
import { TokenCard } from "../components/cards/TokenCard";
import { Icon } from "../components/ui/Icon";
import { HelpTooltip } from "../components/ui/Tooltip";

export default function AccessTokensPage() {
	const [tokens, setTokens] = useState<Token[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [name, setName] = useState("");
	const [purpose, setPurpose] = useState("");
	const [expiresIn, setExpiresIn] = useState<number | "">("");
	const [neverExpire, setNeverExpire] = useState(false);
	const [genLoading, setGenLoading] = useState(false);
	const [genError, setGenError] = useState<string | null>(null);
	const [generatedToken, setGeneratedToken] = useState<string | null>(null);

	const [revokeLoading, setRevokeLoading] = useState<number | null>(null);
	const [revokeError, setRevokeError] = useState<string | null>(null);

	const shsfCliToken = tokens.find((t) => t.name === "SHSF CLI" || t.name === "SHSF Cli");
	const [cliGenLoading, setCliGenLoading] = useState(false);
	const [cliGenError, setCliGenError] = useState<string | null>(null);

	const fetchTokens = async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await listAccessTokens();
			setTokens(data || []);
		} catch {
			setError("Failed to load tokens");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { fetchTokens(); }, []);

	const handleGenerate = async (e: React.FormEvent) => {
		e.preventDefault();
		setGenLoading(true);
		setGenError(null);
		setGeneratedToken(null);
		try {
			const res = await generateAccessToken(
				name,
				purpose || undefined,
				neverExpire ? null : expiresIn ? Number(expiresIn) : undefined,
			);
			if (res.status === "OK" && res.token) {
				setGeneratedToken(res.token);
				setName("");
				setPurpose("");
				setExpiresIn("");
				setNeverExpire(false);
				fetchTokens();
			} else {
				setGenError(res.message || "Failed to generate token");
			}
		} catch {
			setGenError("Failed to generate token");
		} finally {
			setGenLoading(false);
		}
	};

	const handleRevoke = async (id: number) => {
		setRevokeLoading(id);
		setRevokeError(null);
		try {
			await revokeAccessToken(id);
			fetchTokens();
		} catch {
			setRevokeError("Failed to revoke token.");
		} finally {
			setRevokeLoading(null);
		}
	};

	const handleCreateCliToken = async () => {
		setCliGenLoading(true);
		setCliGenError(null);
		setGeneratedToken(null);
		try {
			const res = await generateAccessToken("SHSF Cli", "Preset token for SHSF CLI tool", null);
			if (res.status === "OK" && res.token) {
				setGeneratedToken(res.token);
				fetchTokens();
			} else {
				setCliGenError(res.message || "Failed to generate SHSF Cli token");
			}
		} catch {
			setCliGenError("Failed to generate SHSF Cli token");
		} finally {
			setCliGenLoading(false);
		}
	};

	const inputClass = "w-full px-3 py-2 bg-background border border-white/[0.07] rounded-lg text-text text-sm focus:border-primary/50 focus:outline-none placeholder:text-muted/60";
	const btnPrimary = "flex items-center gap-1.5 px-4 py-2 bg-primary text-background text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50";
	const btnSecondary = "flex items-center gap-1.5 px-4 py-2 border border-white/[0.07] text-text/70 text-sm font-medium rounded-lg hover:bg-surface-raised hover:text-text hover:border-primary/20 transition-colors disabled:opacity-50";

	return (
		<div className="max-w-3xl">
			{/* Page header */}
			<div className="mb-6">
				<h1 className="text-2xl font-semibold text-text">Access Tokens</h1>
				<p className="text-sm text-muted mt-0.5">Manage API tokens for programmatic access to your account</p>
				<p className="text-sm text-muted mt-2">
					Use the <a href="/docs/cli" className="text-primary hover:underline">SHSF CLI</a> for
					terminal-based function management and execution.
				</p>
			</div>

			{/* Generate Token */}
			<div className="bg-surface border border-white/[0.07] rounded-xl mb-6">
				<div className="px-5 py-4 border-b border-white/[0.07]">
					<h2 className="text-sm font-semibold text-text flex items-center gap-2">
						Generate New Token
						<HelpTooltip content="Tokens allow programmatic access to the API. Treat them like passwords — store securely and never commit to source control." />
					</h2>
				</div>
				<form onSubmit={handleGenerate} className="px-5 py-4 space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div>
							<label className="block text-xs font-medium text-muted mb-1.5">Token Name <span className="text-red-400">*</span></label>
							<input
								type="text"
								required
								minLength={2}
								maxLength={128}
								placeholder="e.g. My CLI Tool"
								className={inputClass}
								value={name}
								onChange={(e) => setName(e.target.value)}
								disabled={genLoading}
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-muted mb-1.5">Purpose <span className="text-muted/40">(optional)</span></label>
							<input
								type="text"
								maxLength={512}
								placeholder="Describe the usage"
								className={inputClass}
								value={purpose}
								onChange={(e) => setPurpose(e.target.value)}
								disabled={genLoading}
							/>
						</div>
					</div>
					<div className="flex items-end gap-4">
						{!neverExpire && (
							<div className="w-40">
								<label className="block text-xs font-medium text-muted mb-1.5">Expires in (days)</label>
								<input
									type="number"
									min={1}
									max={365}
									placeholder="30"
									className={inputClass}
									value={expiresIn}
									onChange={(e) => setExpiresIn(e.target.value ? Number(e.target.value) : "")}
									disabled={genLoading || neverExpire}
								/>
							</div>
						)}
						<label className="flex items-center gap-2 cursor-pointer mb-2">
							<input
								type="checkbox"
								checked={neverExpire}
								onChange={() => setNeverExpire((v) => !v)}
								disabled={genLoading}
								className="w-3.5 h-3.5 accent-primary"
							/>
							<span className="text-xs text-muted">Never expire</span>
						</label>
					</div>

					{genError && (
						<div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{genError}</div>
					)}

					{generatedToken && (
						<div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-2">
							<p className="text-xs font-medium text-green-400 uppercase tracking-wider">New Token — copy now, it won't be shown again</p>
							<code className="block text-sm text-green-300 font-mono break-all select-all">{generatedToken}</code>
						</div>
					)}

					<div className="flex gap-2 flex-wrap">
						<button type="submit" className={btnPrimary} disabled={genLoading}>
							<Icon name="key" className="w-4 h-4" />
							{genLoading ? "Generating…" : "Generate Token"}
						</button>
						{!shsfCliToken && (
							<button type="button" className={btnSecondary} onClick={handleCreateCliToken} disabled={cliGenLoading}>
								<Icon name="bolt" className="w-4 h-4" />
								{cliGenLoading ? "Creating…" : "Create SHSF CLI Token"}
							</button>
						)}
					</div>
					{cliGenError && <p className="text-sm text-red-400">{cliGenError}</p>}
				</form>
			</div>

			{/* Tokens list */}
			<div>
				<h2 className="text-sm font-semibold text-text mb-3">Your Tokens</h2>
				{loading ? (
					<div className="flex justify-center py-10">
						<div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
					</div>
				) : error ? (
					<div className="px-4 py-3 bg-surface border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>
				) : (
					<>
						{revokeError && <p className="text-sm text-red-400 mb-2">{revokeError}</p>}
						{tokens.length === 0 ? (
							<div className="bg-surface border border-white/[0.07] rounded-xl flex flex-col items-center py-12 text-center">
								<div className="w-10 h-10 rounded-xl bg-background border border-white/[0.07] flex items-center justify-center mb-3">
									<Icon name="key" className="w-5 h-5 text-primary/40" />
								</div>
								<p className="text-sm text-muted">No tokens yet. Generate one above.</p>
							</div>
						) : (
							<div className="space-y-2">
								{tokens.map((t) => (
									<TokenCard
										key={t.id}
										token={t}
										onRevoke={handleRevoke}
										revokeLoading={revokeLoading === t.id}
										refreshTokens={fetchTokens}
										disableEdit={t.name === "SHSF Cli"}
									/>
								))}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
