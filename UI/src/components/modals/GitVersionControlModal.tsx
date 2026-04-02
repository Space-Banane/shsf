import React, { useEffect, useRef, useState } from "react";
import Modal from "./Modal";

import { ActionButton } from "../buttons/ActionButton";
import {
	getGitConfig,
	gitClone,
	gitPull,
	removeGitConfig,
	removeGitCredentials,
	updateGitSettings,
	getGitBranches,
	getGitTree,
} from "../../services/backend.functions";

// Feature flag — set to true to show username/token fields for private repo auth
const ENABLE_GIT_AUTH = true;

interface GitVersionControlModalProps {
	isOpen: boolean;
	onClose: () => void;
	functionId: number | null;
	onChanged?: () => void; // called when git config changes (e.g. added/removed)
}

function GitVersionControlModal({
	isOpen,
	onClose,
	functionId,
	onChanged,
}: GitVersionControlModalProps) {
	const [loading, setLoading] = useState(false);
	const [isBusy, setIsBusy] = useState(false);

	// Current saved state from backend
	const [savedUrl, setSavedUrl] = useState<string | null>(null);
	const [savedBranch, setSavedBranch] = useState<string | null>(null);
	const [savedSourceDir, setSavedSourceDir] = useState<string | null>(null);
	const [periodicPull, setPeriodicPull] = useState(false);
	const [pullInterval, setPullInterval] = useState(10);
	const [savedHasCredentials, setSavedHasCredentials] = useState(false);

	// Input state
	const [urlInput, setUrlInput] = useState("");
	const [usernameInput, setUsernameInput] = useState("");
	const [sourceDirInput, setSourceDirInput] = useState("");
	const [branchInput, setBranchInput] = useState("");
	const [availableBranches, setAvailableBranches] = useState<string[]>([]);
	const [availableDirs, setAvailableDirs] = useState<string[]>([]);
	const [isFetchingBranches, setIsFetchingBranches] = useState(false);
	const [isFetchingTree, setIsFetchingTree] = useState(false);

	// Password is uncontrolled to avoid re-render on every keystroke stealing focus
	const passwordRef = useRef<HTMLInputElement>(null);
	const [passwordHasContent, setPasswordHasContent] = useState(false);
	const getPassword = () => passwordRef.current?.value ?? "";
	const clearPassword = () => { if (passwordRef.current) passwordRef.current.value = ""; setPasswordHasContent(false); };

	// Logs
	const [logs, setLogs] = useState<string>("");
	const [logStatus, setLogStatus] = useState<"idle" | "ok" | "error">("idle");

	const logsRef = useRef<HTMLPreElement>(null);

	// Auto-scroll logs
	useEffect(() => {
		if (logsRef.current) {
			logsRef.current.scrollTop = logsRef.current.scrollHeight;
		}
	}, [logs]);

	// Load git config when modal opens
	useEffect(() => {
		if (!isOpen || !functionId) return;
		setLoading(true);
		setLogs("");
		setLogStatus("idle");

		getGitConfig(functionId)
			.then((res) => {
				if (res.status === "OK") {
					setSavedUrl(res.data.git_url ?? null);
					setSavedBranch(res.data.git_branch ?? null);
					setSavedSourceDir(res.data.git_source_dir ?? null);
					setPeriodicPull(res.data.git_periodic_pull);
					setPullInterval(res.data.git_pull_interval ?? 10);
					setUrlInput(res.data.git_url ?? "");
					setUsernameInput(res.data.git_username ?? "");
					setSourceDirInput(res.data.git_source_dir ?? "");
					setBranchInput(res.data.git_branch ?? "");
					clearPassword(); // never pre-fill password
					setSavedHasCredentials(res.data.git_has_credentials);
				} else {
					appendLog("[ERROR] Failed to load git config: " + (res as any).message);
					setLogStatus("error");
				}
			})
			.finally(() => setLoading(false));
	}, [isOpen, functionId]);

	function appendLog(text: string) {
		setLogs((prev) => (prev ? prev + "\n" + text : text));
	}

	const trimmedUrl = urlInput.trim();
	const trimmedUsername = usernameInput.trim();
	const trimmedBranch = branchInput.trim();
	const trimmedSourceDir = sourceDirInput.trim();

	const getAuthInputs = () => {
		const typedPassword = getPassword().trim();
		return {
			username: ENABLE_GIT_AUTH ? trimmedUsername || undefined : undefined,
			password: ENABLE_GIT_AUTH ? typedPassword || undefined : undefined,
			hasTypedPassword: ENABLE_GIT_AUTH ? typedPassword.length > 0 : false,
		};
	};

	const resetGitState = () => {
		setSavedUrl(null);
		setSavedBranch(null);
		setSavedSourceDir(null);
		setUrlInput("");
		setUsernameInput("");
		clearPassword();
		setSourceDirInput("");
		setBranchInput("");
		setAvailableBranches([]);
		setAvailableDirs([]);
		setSavedHasCredentials(false);
		setPeriodicPull(false);
	};

	const urlChanged = trimmedUrl !== (savedUrl ?? "");
	const branchChanged = trimmedBranch !== (savedBranch ?? "");
	const sourceDirChanged = trimmedSourceDir !== (savedSourceDir ?? "");
	const hasUrl = Boolean(savedUrl);
	const inputHasContent = trimmedUrl.length > 0;

	const isDirty = urlChanged || branchChanged || sourceDirChanged;

	const handleClone = async () => {
		if (!functionId || !inputHasContent) return;
		setIsBusy(true);
		setLogs("");
		setLogStatus("idle");
		appendLog(`[GIT] Starting ${hasUrl ? "re-initialization" : "setup"} for: ${trimmedUrl}`);

		try {
			const { username, password, hasTypedPassword } = getAuthInputs();
			const res = await gitClone(
				functionId,
				trimmedUrl,
				username,
				password,
				trimmedSourceDir || undefined,
				trimmedBranch || undefined,
			);
			if ("logs" in res) appendLog(res.logs);
			if (res.status === "OK") {
				appendLog(`\n✅ ${hasUrl ? "Re-initialization" : "Setup"} completed!`);
				setLogStatus("ok");
				setSavedUrl(trimmedUrl);
				setSavedBranch(trimmedBranch);
				setSavedSourceDir(trimmedSourceDir);
				setSavedHasCredentials(hasTypedPassword || savedHasCredentials);
				clearPassword();
				onChanged?.();
			} else {
				appendLog("\n❌ Failed: " + res.message);
				setLogStatus("error");
			}
		} catch (err: any) {
			appendLog("[ERROR] " + (err?.message ?? "Unexpected error"));
			setLogStatus("error");
		} finally {
			setIsBusy(false);
		}
	};

	const handlePull = async () => {
		if (!functionId) return;
		setIsBusy(true);
		setLogs("");
		setLogStatus("idle");
		appendLog("[GIT] Pulling latest changes...");

		try {
			const res = await gitPull(functionId);
			if ("logs" in res) appendLog(res.logs);
			if (res.status === "OK") {
				appendLog("\n✅ Pull successful!");
				setLogStatus("ok");
			} else {
				appendLog("\n❌ Pull failed: " + res.message);
				setLogStatus("error");
			}
		} catch (err: any) {
			appendLog("[ERROR] " + (err?.message ?? "Unexpected error"));
			setLogStatus("error");
		} finally {
			setIsBusy(false);
		}
	};

	const handleTogglePeriodicPull = async (enabled: boolean) => {
		if (!functionId) return;
		setPeriodicPull(enabled);
		try {
			const res = await updateGitSettings(functionId, enabled, undefined, undefined, pullInterval);
			if (res.status !== "OK") {
				setPeriodicPull(!enabled); // revert
				appendLog("[ERROR] Failed to update periodic pull setting.");
			} else {
				appendLog(`[GIT] Periodic pull ${enabled ? "enabled" : "disabled"}.`);
			}
		} catch {
			setPeriodicPull(!enabled);
		}
	};

	const handleUpdateInterval = async (minutes: number) => {
		if (!functionId) return;
		setPullInterval(minutes);
		try {
			const res = await updateGitSettings(functionId, undefined, undefined, undefined, minutes);
			if (res.status !== "OK") {
				appendLog("[ERROR] Failed to update pull interval.");
			} else {
				appendLog(`[GIT] Pull interval set to ${minutes} minute${minutes === 1 ? "" : "s"}.`);
			}
		} catch {
			appendLog("[ERROR] Unexpected error updating pull interval.");
		}
	};

	const handleSaveCredentials = async () => {
		if (!functionId) return;
		if (!inputHasContent) {
			appendLog("[ERROR] Repository URL is required before updating credentials.");
			setLogStatus("error");
			return;
		}
		if (!window.confirm("Updating credentials will require a full re-clone of the repository. All current files in the /app directory will be replaced. Continue?")) return;

		await handleClone();
	};

	const handleRemoveCredentials = async () => {
		if (!functionId) return;
		if (!window.confirm("Remove saved credentials? The repository remote URL will be updated to use no authentication.")) return;
		setIsBusy(true);
		try {
			const res = await removeGitCredentials(functionId);
			if (res.status === "OK") {
				setSavedHasCredentials(false);
				setUsernameInput("");
				clearPassword();
				appendLog("[GIT] Credentials removed.");
				setLogStatus("ok");
			} else {
				appendLog("[ERROR] Failed to remove credentials: " + res.message);
				setLogStatus("error");
			}
		} catch (err: any) {
			appendLog("[ERROR] " + (err?.message ?? "Unexpected error"));
			setLogStatus("error");
		} finally {
			setIsBusy(false);
		}
	};

	const handleRemoveGit = async () => {
		if (!functionId) return;
		if (
			!window.confirm(
				"Remove git configuration? The cloned files will remain in the app directory but git control will be disabled.",
			)
		)
			return;
		setIsBusy(true);
		try {
			const res = await removeGitConfig(functionId);
			if (res.status === "OK") {
				resetGitState();
				setLogs("[GIT] Git configuration removed.");
				setLogStatus("ok");
				onChanged?.();
			} else {
				appendLog("[ERROR] " + res.message);
				setLogStatus("error");
			}
		} finally {
			setIsBusy(false);
		}
	};

	const handleClose = () => {
		if (!isBusy && !loading) onClose();
	};

	const fetchBranches = async () => {
		if (!functionId || !trimmedUrl) return;
		setIsFetchingBranches(true);
		try {
			const { username, password } = getAuthInputs();
			const res = await getGitBranches(
				functionId,
				trimmedUrl,
				username,
				password,
			);
			if (res.status === "OK") {
				setAvailableBranches(res.data);
				appendLog(`[GIT] Fetched ${res.data.length} branches.`);
			} else {
				appendLog(`[ERROR] Failed to fetch branches: ${res.message}`);
			}
		} catch (err: any) {
			appendLog(`[ERROR] ${err?.message ?? "Failed to fetch branches"}`);
		} finally {
			setIsFetchingBranches(false);
		}
	};

	const fetchTree = async () => {
		if (!functionId || !trimmedUrl) return;
		setIsFetchingTree(true);
		try {
			const { username, password } = getAuthInputs();
			const res = await getGitTree(
				functionId,
				trimmedUrl,
				username,
				password,
				trimmedBranch || undefined,
			);
			if (res.status === "OK") {
				setAvailableDirs(res.data);
				appendLog(`[GIT] Fetched ${res.data.length} directories.`);
			} else {
				appendLog(`[ERROR] Failed to fetch tree: ${res.message}`);
			}
		} catch (err: any) {
			appendLog(`[ERROR] ${err?.message ?? "Failed to fetch tree"}`);
		} finally {
			setIsFetchingTree(false);
		}
	};

	const logBorderColor =
		logStatus === "ok"
			? "border-green-500/40"
			: logStatus === "error"
			? "border-red-500/40"
			: "border-primary/10";

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Git Integration"
			maxWidth="lg"
			isLoading={loading}
		>
			<div className="space-y-6">
				{/* Warning Marker */}
				<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
					<span className="text-red-500 text-lg">⚠️</span>
					<div>
						<h4 className="text-[10px] font-bold uppercase tracking-widest text-red-500/80">Data Warning</h4>
						<p className="text-[11px] text-red-400/70 leading-relaxed">
							Cloning or updating credentials WILL delete and replace all data in the <code className="bg-black/30 px-1 rounded">/app</code> function directory.
						</p>
					</div>
				</div>

				{/* Repository Configuration */}
				<div className="bg-background/30 border border-primary/10 rounded-xl p-4 space-y-4">
					<div className="flex items-center gap-2 pb-2 border-b border-primary/10">
						<span className="text-primary text-sm">📦</span>
						<h3 className="text-xs font-bold uppercase tracking-widest text-primary/70">Repository Settings</h3>
					</div>

					{/* Git URL Input */}
					<div className="space-y-2">
						<label className="text-[10px] font-bold uppercase tracking-widest text-primary/50 flex items-center gap-2">
							Repository URL
							{hasUrl && !urlChanged && <span className="text-green-400 normal-case font-normal">(Active)</span>}
						</label>
						<input
							type="text"
							value={urlInput}
							onChange={(e) => setUrlInput(e.target.value)}
							placeholder="https://github.com/user/repo.git"
							className="w-full bg-background/40 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder-gray-600"
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						{/* Branch Selection */}
						<div className="space-y-2">
							<label className="text-[10px] font-bold uppercase tracking-widest text-primary/50 flex items-center justify-between">
								<span>Branch</span>
								<button 
									disabled={isFetchingBranches || !trimmedUrl}
									onClick={fetchBranches}
									className="text-primary hover:text-white transition-colors disabled:opacity-30"
								>
									{isFetchingBranches ? "..." : "Fetch"}
								</button>
							</label>
							<div className="relative">
								{availableBranches.length > 0 ? (
									<div className="relative">
										<select
											value={branchInput}
											onChange={(e) => setBranchInput(e.target.value)}
											className="w-full bg-background/40 border border-primary/20 rounded-lg pl-3 pr-8 py-2 text-white text-sm outline-none focus:border-primary/50 transition-colors appearance-none"
										>
											{availableBranches.map((b) => (
												<option key={b} value={b}>{b}</option>
											))}
										</select>
										<button 
											onClick={() => { setAvailableBranches([]); setBranchInput(""); }}
											className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400/50 hover:text-red-400 p-1"
										>
											✕
										</button>
									</div>
								) : (
									<input
										type="text"
										value={branchInput}
										onChange={(e) => setBranchInput(e.target.value)}
										placeholder="HEAD"
										className="w-full bg-background/40 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder-gray-600"
									/>
								)}
							</div>
						</div>

						{/* Source Directory */}
						<div className="space-y-2">
							<label className="text-[10px] font-bold uppercase tracking-widest text-primary/50 flex items-center justify-between">
								<span>Subdirectory</span>
								<button 
									disabled={isFetchingTree || !trimmedUrl}
									onClick={fetchTree}
									className="text-primary hover:text-white transition-colors disabled:opacity-30"
								>
									{isFetchingTree ? "..." : "Fetch"}
								</button>
							</label>
							<div className="relative">
								{availableDirs.length > 0 ? (
									<div className="relative">
										<select
											value={sourceDirInput}
											onChange={(e) => setSourceDirInput(e.target.value)}
											className="w-full bg-background/40 border border-primary/20 rounded-lg pl-3 pr-8 py-2 text-white text-sm outline-none focus:border-primary/50 transition-colors appearance-none"
										>
											{availableDirs.map((d) => (
												<option key={d} value={d === "." ? "" : d}>{d}</option>
											))}
										</select>
										<button 
											onClick={() => { setAvailableDirs([]); setSourceDirInput(""); }}
											className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400/50 hover:text-red-400 p-1"
										>
											✕
										</button>
									</div>
								) : (
									<input
										type="text"
										value={sourceDirInput}
										onChange={(e) => setSourceDirInput(e.target.value)}
										placeholder="/"
										className="w-full bg-background/40 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder-gray-600"
									/>
								)}
							</div>
						</div>
					</div>

					{isDirty && hasUrl && (
						<div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-[11px] text-yellow-500/80 flex gap-2">
							<span>⚠️</span>
							<span>Configuration changed. Re-initialization will delete current files.</span>
						</div>
					)}
				</div>

				{/* Authentication (private repos) */}
				<div className="bg-background/30 border border-primary/10 rounded-xl p-4 space-y-4">
					<div className="flex items-center gap-2 pb-2 border-b border-primary/10">
						<span className="text-primary text-sm">🔑</span>
						<h3 className="text-xs font-bold uppercase tracking-widest text-primary/70">Authentication</h3>
					</div>

					{ENABLE_GIT_AUTH ? (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-2">
								<div className="space-y-1">
									<label className="text-[10px] font-bold uppercase tracking-widest text-primary/50">Username</label>
									<input
										type="text"
										value={usernameInput}
										onChange={(e) => setUsernameInput(e.target.value)}
										placeholder="e.g. octocat"
										autoComplete="off"
										className="w-full bg-background/40 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder-gray-600"
									/>
								</div>
								<div className="space-y-1">
									<label className="text-[10px] font-bold uppercase tracking-widest text-primary/50">Access Token</label>
									<input
										type="password"
										ref={passwordRef}
										defaultValue=""
										onChange={(e) => setPasswordHasContent(e.target.value.length > 0)}
										placeholder={savedHasCredentials ? "••••••••" : "Token"}
										autoComplete="off"
										className="w-full bg-background/40 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder-gray-600"
									/>
								</div>
							</div>
							<div className="flex gap-2">
								<button
									disabled={isBusy || (!trimmedUsername && !passwordHasContent)}
									onClick={handleSaveCredentials}
									className="flex-1 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest py-2 rounded border border-white/10 transition-colors disabled:opacity-30"
								>
									Save Credentials
								</button>
								<button
									disabled={isBusy || !savedHasCredentials}
									onClick={handleRemoveCredentials}
									className="flex-1 bg-red-500/5 hover:bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest py-2 rounded border border-red-500/10 transition-colors disabled:opacity-30"
								>
									Clear Auth
								</button>
							</div>
						</div>
					) : (
						<div className="opacity-40 select-none space-y-2 italic text-xs text-center py-2">
							Auth module disabled.
						</div>
					)}
				</div>

				{/* Action Buttons */}
				<div className="grid grid-cols-2 gap-3 pt-2">
					{inputHasContent && (
						<ActionButton
							icon={hasUrl ? (isDirty ? "🔄" : "📥") : "📥"}
							label={hasUrl ? (isDirty ? "Re-Initialize" : "Re-Clone") : "Clone"}
							variant={isDirty || !hasUrl ? "primary" : "secondary"}
							disabled={isBusy || !inputHasContent}
							onClick={handleClone}
						/>
					)}

					{hasUrl && !isDirty && (
						<ActionButton
							icon="⬇️"
							label="Pull"
							variant="primary"
							disabled={isBusy}
							onClick={handlePull}
						/>
					)}

					{hasUrl && (
						<ActionButton
							icon="📂"
							label="View Repo"
							variant="secondary"
							disabled={isBusy}
							onClick={() => {
								if (!savedUrl) return;
								try {
									const url = new URL(savedUrl);
									url.username = "";
									url.password = "";
									window.open(url.toString(), "_blank", "noopener,noreferrer");
								} catch {
									window.open(savedUrl, "_blank", "noopener,noreferrer");
								}
							}}
						/>
					)}

					{hasUrl && (
						<ActionButton
							icon="🗑️"
							label="Disconnect"
							variant="delete"
							disabled={isBusy}
							onClick={handleRemoveGit}
						/>
					)}
				</div>

				{/* Periodic Pull */}
				{hasUrl && !isDirty && (
					<div className={`bg-background/30 border border-primary/10 rounded-xl p-4 space-y-4 transition-all ${!periodicPull ? "opacity-60" : ""}`}>
						<div className="flex items-center justify-between pb-2 border-b border-primary/10">
							<div className="flex items-center gap-2">
								<span className="text-primary text-sm">🔄</span>
								<h3 className="text-xs font-bold uppercase tracking-widest text-primary/70">Auto-Sync</h3>
							</div>
							<button
								onClick={() => handleTogglePeriodicPull(!periodicPull)}
								disabled={isBusy}
								className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${
									periodicPull ? "bg-blue-600" : "bg-gray-700"
								}`}
							>
								<span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${periodicPull ? "translate-x-5" : "translate-x-0"}`} />
							</button>
						</div>

						{periodicPull && (
							<div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
								<div className="grid grid-cols-4 gap-1.5">
									{[
										{ label: "10m", value: 10 },
										{ label: "1h", value: 60 },
										{ label: "6h", value: 360 },
										{ label: "1d", value: 1440 },
									].map((preset) => (
										<button
											key={preset.value}
											onClick={() => { setPullInterval(preset.value); handleUpdateInterval(preset.value); }}
											className={`py-1.5 text-[10px] font-bold uppercase rounded border transition-all ${
												pullInterval === preset.value
													? "bg-primary/20 border-primary text-primary"
													: "bg-background/20 border-white/5 text-gray-500 hover:text-gray-300"
											}`}
										>
											{preset.label}
										</button>
									))}
								</div>
								<div className="flex gap-2 items-center">
									<input
										type="number"
										value={pullInterval}
										onChange={(e) => setPullInterval(Math.max(1, parseInt(e.target.value) || 1))}
										max={1440}
										className="w-16 bg-background/40 border border-primary/20 rounded px-2 py-1 text-white text-xs outline-none"
									/>
									<span className="text-[10px] text-primary/50 uppercase font-bold">Minutes</span>
									<button
										onClick={() => handleUpdateInterval(pullInterval)}
										className="ml-auto text-primary hover:text-white text-[10px] font-bold uppercase tracking-widest p-1 transition-colors"
									>
										Save
									</button>
								</div>
							</div>
						)}
					</div>
				)}

				{/* Output Console */}
				{logs && (
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<span className="text-primary text-sm">📺</span>
							<h3 className="text-xs font-bold uppercase tracking-widest text-primary/70">Console Output</h3>
						</div>
						<pre
							ref={logsRef}
							className={`bg-black/60 border ${logBorderColor} rounded-xl p-4 text-[11px] font-mono text-gray-300 max-h-48 overflow-y-auto whitespace-pre-wrap break-words shadow-inner`}
							style={{ scrollbarWidth: "thin" }}
						>
							{logs}
						</pre>
					</div>
				)}

				{/* Help / Info Footnote */}
				{!hasUrl && !inputHasContent && (
					<div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
						<div className="flex gap-3">
							<span className="text-primary text-lg">💡</span>
							<div className="space-y-1">
								<p className="text-xs font-bold text-primary/80 uppercase tracking-widest">Getting Started</p>
								<p className="text-[11px] text-gray-400 leading-relaxed">
									Connecting a repository allows you to deploy code directly from Git. 
									The file manager will be locked to prevent conflicts while Git is active.
								</p>
							</div>
						</div>
					</div>
				)}
			</div>
		</Modal>
	);
}

export default GitVersionControlModal;