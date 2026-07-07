import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import Modal from "../Modal";
import {
	cancelBtnClass,
	primaryBtnClass,
	deleteBtnClass,
	inputClass,
	selectClass,
	labelClass,
	ToggleRow,
} from "../Modal";
import { useConfirm } from "../ConfirmModal";
import {
	getGitConfig,
	gitClone,
	gitPull,
	removeGitConfig,
	removeGitCredentials,
	updateGitSettings,
	getGitBranches,
	getGitTree,
} from "../../../services/backend.functions";

const ENABLE_GIT_AUTH = true;

interface GitVersionControlModalProps {
	isOpen: boolean;
	onClose: () => void;
	functionId: number | null;
	onChanged?: () => void;
}

function GitVersionControlModal({
	isOpen,
	onClose,
	functionId,
	onChanged,
}: GitVersionControlModalProps) {
	const confirm = useConfirm();
	const [loading, setLoading] = useState(false);
	const [isBusy, setIsBusy] = useState(false);

	const [savedUrl, setSavedUrl] = useState<string | null>(null);
	const [savedBranch, setSavedBranch] = useState<string | null>(null);
	const [savedSourceDir, setSavedSourceDir] = useState<string | null>(null);
	const [periodicPull, setPeriodicPull] = useState(false);
	const [pullInterval, setPullInterval] = useState(10);
	const [savedHasCredentials, setSavedHasCredentials] = useState(false);
	const [showLogs, setShowLogs] = useState(false);

	const [urlInput, setUrlInput] = useState("");
	const [usernameInput, setUsernameInput] = useState("");
	const [sourceDirInput, setSourceDirInput] = useState("");
	const [branchInput, setBranchInput] = useState("");
	const [availableBranches, setAvailableBranches] = useState<string[]>([]);
	const [availableDirs, setAvailableDirs] = useState<string[]>([]);
	const [isFetchingBranches, setIsFetchingBranches] = useState(false);
	const [isFetchingTree, setIsFetchingTree] = useState(false);

	const passwordRef = useRef<HTMLInputElement>(null);
	const [passwordHasContent, setPasswordHasContent] = useState(false);
	const getPassword = () => passwordRef.current?.value ?? "";
	const clearPassword = () => { if (passwordRef.current) passwordRef.current.value = ""; setPasswordHasContent(false); };

	const [logs, setLogs] = useState<string>("");
	const [logStatus, setLogStatus] = useState<"idle" | "ok" | "error">("idle");
	const logsRef = useRef<HTMLPreElement>(null);

	useEffect(() => {
		if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
	}, [logs]);

	useEffect(() => {
		if (!isOpen || !functionId) return;
		setLoading(true); setLogs(""); setLogStatus("idle");
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
					clearPassword();
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
		setSavedUrl(null); setSavedBranch(null); setSavedSourceDir(null);
		setUrlInput(""); setUsernameInput(""); clearPassword();
		setSourceDirInput(""); setBranchInput("");
		setAvailableBranches([]); setAvailableDirs([]);
		setSavedHasCredentials(false); setPeriodicPull(false);
	};

	const urlChanged = trimmedUrl !== (savedUrl ?? "");
	const branchChanged = trimmedBranch !== (savedBranch ?? "");
	const sourceDirChanged = trimmedSourceDir !== (savedSourceDir ?? "");
	const hasUrl = Boolean(savedUrl);
	const inputHasContent = trimmedUrl.length > 0;
	const isDirty = urlChanged || branchChanged || sourceDirChanged;

	const handleClone = async () => {
		if (!functionId || !inputHasContent) return;
		setIsBusy(true); setLogs(""); setLogStatus("idle");
		appendLog(`[GIT] Starting ${hasUrl ? "re-initialization" : "setup"} for: ${trimmedUrl}`);
		try {
			const { username, password, hasTypedPassword } = getAuthInputs();
			const res = await gitClone(functionId, trimmedUrl, username, password, trimmedSourceDir || undefined, trimmedBranch || undefined);
			if ("logs" in res) appendLog(res.logs);
			if (res.status === "OK") {
				appendLog(`\n[OK] ${hasUrl ? "Re-initialization" : "Setup"} completed!`);
				toast.success(`${hasUrl ? "Re-initialization" : "Setup"} completed!`);
				setLogStatus("ok");
				setSavedUrl(trimmedUrl); setSavedBranch(trimmedBranch); setSavedSourceDir(trimmedSourceDir);
				setSavedHasCredentials(hasTypedPassword || savedHasCredentials);
				clearPassword(); onChanged?.();
			} else {
				appendLog("\n[FAIL] Failed: " + res.message);
				toast.error("Git failed: " + res.message);
				setLogStatus("error");
			}
		} catch (err: any) {
			appendLog("[ERROR] " + (err?.message ?? "Unexpected error"));
			toast.error("Unexpected error: " + (err?.message ?? "Check console"));
			setLogStatus("error");
		} finally {
			setIsBusy(false);
		}
	};

	const handlePull = async () => {
		if (!functionId) return;
		setIsBusy(true); setLogs(""); setLogStatus("idle");
		appendLog("[GIT] Pulling latest changes...");
		try {
			const res = await gitPull(functionId);
			if ("logs" in res) appendLog(res.logs);
			if (res.status === "OK") {
				appendLog("\n[OK] Pull successful!"); toast.success("Pull successful!"); setLogStatus("ok");
			} else {
				appendLog("\n[FAIL] Pull failed: " + res.message); toast.error("Pull failed: " + res.message); setLogStatus("error");
			}
		} catch (err: any) {
			appendLog("[ERROR] " + (err?.message ?? "Unexpected error"));
			toast.error("Pull error: " + (err?.message ?? "Check console"));
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
				setPeriodicPull(!enabled);
				appendLog("[ERROR] Failed to update periodic pull setting.");
				toast.error("Failed to update auto-sync.");
			} else {
				appendLog(`[GIT] Periodic pull ${enabled ? "enabled" : "disabled"}.`);
				toast.info(`Auto-sync ${enabled ? "enabled" : "disabled"}.`);
			}
		} catch {
			setPeriodicPull(!enabled); toast.error("Error updating auto-sync.");
		}
	};

	const handleUpdateInterval = async (minutes: number) => {
		if (!functionId) return;
		setPullInterval(minutes);
		try {
			const res = await updateGitSettings(functionId, undefined, undefined, undefined, minutes);
			if (res.status !== "OK") {
				appendLog("[ERROR] Failed to update pull interval."); toast.error("Failed to update pull interval.");
			} else {
				appendLog(`[GIT] Pull interval set to ${minutes} minute${minutes === 1 ? "" : "s"}.`);
				toast.info(`Pull interval set to ${minutes}m.`);
			}
		} catch {
			appendLog("[ERROR] Unexpected error updating pull interval."); toast.error("Error updating pull interval.");
		}
	};

	const handleSaveCredentials = async () => {
		if (!functionId || !inputHasContent) {
			appendLog("[ERROR] Repository URL is required before updating credentials.");
			toast.error("Repo URL is required."); setLogStatus("error"); return;
		}
		const confirmed = await confirm({
			title: "Update Credentials",
			message: "Updating credentials will require a full re-clone of the repository. All current files in the /app directory will be replaced. Continue?",
			confirmText: "Update & Re-clone",
			variant: "delete",
		});
		if (!confirmed) return;
		await handleClone();
	};

	const handleRemoveCredentials = async () => {
		if (!functionId) return;
		const confirmed = await confirm({
			title: "Remove Credentials",
			message: "Remove saved credentials? The repository remote URL will be updated to use no authentication.",
			confirmText: "Remove",
			variant: "delete",
		});
		if (!confirmed) return;
		setIsBusy(true);
		try {
			const res = await removeGitCredentials(functionId);
			if (res.status === "OK") {
				setSavedHasCredentials(false); setUsernameInput(""); clearPassword();
				appendLog("[GIT] Credentials removed."); toast.success("Credentials removed."); setLogStatus("ok");
			} else {
				appendLog("[ERROR] Failed to remove credentials: " + res.message); toast.error("Failed to remove credentials."); setLogStatus("error");
			}
		} catch (err: any) {
			appendLog("[ERROR] " + (err?.message ?? "Unexpected error")); toast.error("Error removing credentials."); setLogStatus("error");
		} finally {
			setIsBusy(false);
		}
	};

	const handleRemoveGit = async () => {
		if (!functionId) return;
		const confirmed = await confirm({
			title: "Remove Git",
			message: "Remove git configuration? The cloned files will remain in the app directory but git control will be disabled.",
			confirmText: "Remove Git",
			variant: "delete",
		});
		if (!confirmed) return;
		setIsBusy(true);
		try {
			const res = await removeGitConfig(functionId);
			if (res.status === "OK") {
				resetGitState(); setLogs("[GIT] Git configuration removed.");
				toast.success("Git disconnected."); setLogStatus("ok"); onChanged?.();
			} else {
				appendLog("[ERROR] " + res.message); toast.error("Failed to disconnect Git."); setLogStatus("error");
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
			const res = await getGitBranches(functionId, trimmedUrl, username, password);
			if (res.status === "OK") { setAvailableBranches(res.data); appendLog(`[GIT] Fetched ${res.data.length} branches.`); }
			else appendLog(`[ERROR] Failed to fetch branches: ${res.message}`);
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
			const res = await getGitTree(functionId, trimmedUrl, username, password, trimmedBranch || undefined);
			if (res.status === "OK") { setAvailableDirs(res.data); appendLog(`[GIT] Fetched ${res.data.length} directories.`); }
			else appendLog(`[ERROR] Failed to fetch tree: ${res.message}`);
		} catch (err: any) {
			appendLog(`[ERROR] ${err?.message ?? "Failed to fetch tree"}`);
		} finally {
			setIsFetchingTree(false);
		}
	};

	const logBorderColor =
		logStatus === "ok" ? "border-green-500/40" :
		logStatus === "error" ? "border-red-500/40" :
		"border-white/[0.07]";

	const sectionInputClass = `${inputClass} text-sm`;
	const sectionSelectClass = `${selectClass} text-sm`;

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Git Integration" maxWidth="lg" isLoading={loading}>
			<div className="space-y-5">
				<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
					<div>
						<h4 className="text-[10px] font-bold uppercase tracking-widest text-red-500/80">Data Warning</h4>
						<p className="text-[11px] text-red-400/70 leading-relaxed">
							Cloning or updating credentials WILL delete and replace all data in the <code className="bg-black/30 px-1 rounded">/app</code> function directory.
						</p>
					</div>
				</div>

				<div className="bg-surface border border-white/[0.07] rounded-lg p-4 space-y-4">
					<h3 className="text-xs font-medium text-muted uppercase tracking-wider pb-2 border-b border-white/[0.07]">Repository Settings</h3>

					<div>
						<label className={`${labelClass} flex items-center gap-2`}>
							Repository URL
							{hasUrl && !urlChanged && <span className="text-green-400 normal-case font-normal text-[10px]">(Active)</span>}
						</label>
						<input
							type="text"
							value={urlInput}
							onChange={(e) => setUrlInput(e.target.value)}
							placeholder="https://github.com/user/repo.git"
							className={sectionInputClass}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className={`${labelClass} flex items-center justify-between`}>
								<span>Branch</span>
								<button
									disabled={isFetchingBranches || !trimmedUrl}
									onClick={fetchBranches}
									className="text-primary hover:text-text transition-colors disabled:opacity-30 text-[10px] normal-case font-normal"
								>
									{isFetchingBranches ? "..." : "Fetch"}
								</button>
							</label>
							{availableBranches.length > 0 ? (
								<div className="relative">
									<select value={branchInput} onChange={(e) => setBranchInput(e.target.value)} className={sectionSelectClass}>
										{availableBranches.map((b) => <option key={b} value={b}>{b}</option>)}
									</select>
									<button onClick={() => { setAvailableBranches([]); setBranchInput(""); }} className="absolute right-8 top-1/2 -translate-y-1/2 text-muted hover:text-red-400 text-xs">✕</button>
								</div>
							) : (
								<input type="text" value={branchInput} onChange={(e) => setBranchInput(e.target.value)} placeholder="HEAD" className={sectionInputClass} />
							)}
						</div>

						<div>
							<label className={`${labelClass} flex items-center justify-between`}>
								<span>Subdirectory</span>
								<button
									disabled={isFetchingTree || !trimmedUrl}
									onClick={fetchTree}
									className="text-primary hover:text-text transition-colors disabled:opacity-30 text-[10px] normal-case font-normal"
								>
									{isFetchingTree ? "..." : "Fetch"}
								</button>
							</label>
							{availableDirs.length > 0 ? (
								<div className="relative">
									<select value={sourceDirInput} onChange={(e) => setSourceDirInput(e.target.value)} className={sectionSelectClass}>
										{availableDirs.map((d) => <option key={d} value={d === "." ? "" : d}>{d}</option>)}
									</select>
									<button onClick={() => { setAvailableDirs([]); setSourceDirInput(""); }} className="absolute right-8 top-1/2 -translate-y-1/2 text-muted hover:text-red-400 text-xs">✕</button>
								</div>
							) : (
								<input type="text" value={sourceDirInput} onChange={(e) => setSourceDirInput(e.target.value)} placeholder="/" className={sectionInputClass} />
							)}
						</div>
					</div>

					{isDirty && hasUrl && (
						<div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-[11px] text-yellow-500/80">
							Configuration changed. Re-initialization will delete current files.
						</div>
					)}
				</div>

				{ENABLE_GIT_AUTH && (
					<div className="bg-surface border border-white/[0.07] rounded-lg p-4 space-y-4">
						<h3 className="text-xs font-medium text-muted uppercase tracking-wider pb-2 border-b border-white/[0.07]">Authentication</h3>
						<div className="grid grid-cols-2 gap-2">
							<div>
								<label className={labelClass}>Username</label>
								<input
									type="text"
									value={usernameInput}
									onChange={(e) => setUsernameInput(e.target.value)}
									placeholder="e.g. octocat"
									autoComplete="off"
									className={sectionInputClass}
								/>
							</div>
							<div>
								<label className={labelClass}>Access Token</label>
								<input
									type="password"
									ref={passwordRef}
									defaultValue=""
									onChange={(e) => setPasswordHasContent(e.target.value.length > 0)}
									placeholder={savedHasCredentials ? "••••••••" : "Token"}
									autoComplete="off"
									className={sectionInputClass}
								/>
							</div>
						</div>
						<div className="flex gap-2">
							<button
								disabled={isBusy || (!trimmedUsername && !passwordHasContent)}
								onClick={handleSaveCredentials}
								className={`flex-1 ${cancelBtnClass}`}
							>
								Save Credentials
							</button>
							<button
								disabled={isBusy || !savedHasCredentials}
								onClick={handleRemoveCredentials}
								className={`flex-1 ${deleteBtnClass}`}
							>
								Clear Auth
							</button>
						</div>
					</div>
				)}

				<div className="grid grid-cols-2 gap-3">
					{inputHasContent && (
						<button
							disabled={isBusy || !inputHasContent}
							onClick={handleClone}
							className={isDirty || !hasUrl ? primaryBtnClass : cancelBtnClass}
						>
							{hasUrl ? (isDirty ? "Re-Initialize" : "Re-Clone") : "Clone"}
						</button>
					)}
					{hasUrl && !isDirty && (
						<button disabled={isBusy} onClick={handlePull} className={primaryBtnClass}>
							Pull
						</button>
					)}
					{hasUrl && (
						<button
							disabled={isBusy}
							onClick={() => {
								if (!savedUrl) return;
								try {
									const url = new URL(savedUrl);
									url.username = ""; url.password = "";
									window.open(url.toString(), "_blank", "noopener,noreferrer");
								} catch {
									window.open(savedUrl, "_blank", "noopener,noreferrer");
								}
							}}
							className={cancelBtnClass}
						>
							View Repo
						</button>
					)}
					{hasUrl && (
						<button disabled={isBusy} onClick={handleRemoveGit} className={deleteBtnClass}>
							Disconnect
						</button>
					)}
				</div>

				{hasUrl && !isDirty && (
					<div className="bg-surface border border-white/[0.07] rounded-lg p-4 space-y-3">
						<div className="flex items-center justify-between pb-2 border-b border-white/[0.07]">
							<h3 className="text-xs font-medium text-muted uppercase tracking-wider">Auto-Sync</h3>
							<ToggleRow
								id="periodic-pull-toggle"
								checked={periodicPull}
								onChange={(checked) => { void handleTogglePeriodicPull(checked); }}
								disabled={isBusy}
								label=""
								description=""
							/>
						</div>

						{periodicPull && (
							<div className="space-y-3">
								<div className="grid grid-cols-4 gap-1.5">
									{[{ label: "10m", value: 10 }, { label: "1h", value: 60 }, { label: "6h", value: 360 }, { label: "1d", value: 1440 }].map((preset) => (
										<button
											key={preset.value}
											onClick={() => { setPullInterval(preset.value); void handleUpdateInterval(preset.value); }}
											className={`py-1.5 text-[10px] font-bold uppercase rounded border transition-all ${
												pullInterval === preset.value
													? "bg-primary/20 border-primary text-primary"
													: "bg-background/20 border-white/[0.07] text-muted hover:text-text"
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
										className="w-16 bg-background border border-white/[0.07] rounded px-2 py-1 text-text text-xs outline-none focus:border-primary/50"
									/>
									<span className="text-[10px] text-muted uppercase font-bold">Minutes</span>
									<button
										onClick={() => void handleUpdateInterval(pullInterval)}
										className="ml-auto text-primary hover:text-text text-[10px] font-bold uppercase tracking-widest p-1 transition-colors"
									>
										Save
									</button>
								</div>
							</div>
						)}
					</div>
				)}

				{logs && (
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<h3 className="text-xs font-medium text-muted uppercase tracking-wider">Console Output</h3>
							<button
								onClick={() => setShowLogs(!showLogs)}
								className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors bg-white/[0.04] px-2 py-1 rounded border border-white/[0.07]"
							>
								{showLogs ? "Hide Logs" : "Show Logs"}
							</button>
						</div>
						{showLogs && (
							<pre
								ref={logsRef}
								className={`bg-black/60 border ${logBorderColor} rounded-lg p-4 text-[11px] font-mono text-muted max-h-48 overflow-y-auto whitespace-pre-wrap break-words`}
								style={{ scrollbarWidth: "thin" }}
							>
								{logs}
							</pre>
						)}
					</div>
				)}

				{!hasUrl && !inputHasContent && (
					<div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
						<p className="text-xs font-bold text-primary/80 uppercase tracking-wider mb-1">Getting Started</p>
						<p className="text-[11px] text-muted leading-relaxed">
							Connecting a repository allows you to deploy code directly from Git.
							The file manager will be locked to prevent conflicts while Git is active.
						</p>
					</div>
				)}
			</div>
		</Modal>
	);
}

export default GitVersionControlModal;
