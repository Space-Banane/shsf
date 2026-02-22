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
	const [periodicPull, setPeriodicPull] = useState(false);
	const [pullInterval, setPullInterval] = useState(10);
	const [savedHasCredentials, setSavedHasCredentials] = useState(false);

	// Input state
	const [urlInput, setUrlInput] = useState("");
	const [usernameInput, setUsernameInput] = useState("");
	const [sourceDirInput, setSourceDirInput] = useState("");
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
					setPeriodicPull(res.data.git_periodic_pull);
					setPullInterval(res.data.git_pull_interval ?? 10);
					setUrlInput(res.data.git_url ?? "");
					setUsernameInput(res.data.git_username ?? "");
					setSourceDirInput(res.data.git_source_dir ?? "");
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

	const urlChanged = urlInput.trim() !== (savedUrl ?? "");
	const hasUrl = Boolean(savedUrl);
	const inputHasContent = urlInput.trim().length > 0;

	const handleClone = async () => {
		if (!functionId || !inputHasContent) return;
		setIsBusy(true);
		setLogs("");
		setLogStatus("idle");
		appendLog(`[GIT] Starting clone of: ${urlInput.trim()}`);

		try {
			const pw = getPassword();
			const res = await gitClone(
				functionId,
				urlInput.trim(),
				ENABLE_GIT_AUTH ? usernameInput || undefined : undefined,
				ENABLE_GIT_AUTH ? pw || undefined : undefined,
				sourceDirInput.trim() || undefined,
			);
			if ("logs" in res) appendLog(res.logs);
			if (res.status === "OK") {
				appendLog("\n✅ Clone completed successfully!");
				setLogStatus("ok");
				setSavedUrl(urlInput.trim());
				setSavedHasCredentials(Boolean(pw));
				clearPassword();
				onChanged?.();
			} else {
				appendLog("\n❌ Clone failed: " + res.message);
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
		setIsBusy(true);
		try {
			const pw = getPassword();
			const res = await updateGitSettings(
				functionId,
				undefined,
				usernameInput || null,
				pw || null,
			);
			if (res.status === "OK") {
				appendLog("[GIT] Credentials updated.");
				setLogStatus("ok");
				setSavedHasCredentials(Boolean(pw));
				clearPassword();
			} else {
				appendLog("[ERROR] Failed to save credentials: " + res.message);
				setLogStatus("error");
			}
		} catch (err: any) {
			appendLog("[ERROR] " + (err?.message ?? "Unexpected error"));
			setLogStatus("error");
		} finally {
			setIsBusy(false);
		}
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
					setSavedUrl(null);
					setUrlInput("");
					setUsernameInput("");
					clearPassword();
					setSourceDirInput("");
				setSavedHasCredentials(false);
				setPeriodicPull(false);
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
			title="VERSION // CONTROL"
			maxWidth="lg"
			isLoading={loading}
		>
			<div className="space-y-6">
				{/* Git URL Input */}
				<div className="space-y-2">
					<label className="text-xs font-bold uppercase tracking-widest text-primary/70">
						Repository URL
					</label>
					<div className="flex gap-2">
						<input
							type="text"
							value={urlInput}
							onChange={(e) => setUrlInput(e.target.value)}
							placeholder="https://github.com/user/repo.git"
							className="flex-1 bg-background/40 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder-gray-600"
						/>
					</div>
					{hasUrl && !urlChanged && (
						<p className="text-xs text-green-400/80 flex items-center gap-1">
							<span>✅</span> Git source active — file manager is disabled
						</p>
					)}
					{hasUrl && urlChanged && (
						<p className="text-xs text-yellow-400/80 flex items-center gap-1">
							<span>⚠️</span> URL changed — cloning will permanently delete all files in the app directory and re-clone from this repository
						</p>
					)}
				</div>

				{/* Source Directory */}
				<div className="space-y-2">
					<label className="text-xs font-bold uppercase tracking-widest text-primary/70">
						Source Directory
						<span className="ml-2 text-primary/40 normal-case font-normal">(optional — subdirectory inside the repo to deploy)</span>
					</label>
					<input
						type="text"
						value={sourceDirInput}
						onChange={(e) => setSourceDirInput(e.target.value)}
						placeholder="e.g. src/my-function  (leave blank to use entire repo)"
						className="w-full bg-background/40 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder-gray-600"
					/>
					{sourceDirInput.trim() && (
						<p className="text-xs text-blue-400/80 flex items-center gap-1">
							<span>📂</span> Only <code className="bg-black/30 px-1 rounded">{sourceDirInput.trim()}</code> will be synced into the function app directory
						</p>
					)}
				</div>

				{/* Authentication (private repos) */}
				{ENABLE_GIT_AUTH ? (
					<div className="space-y-2">
						<label className="text-xs font-bold uppercase tracking-widest text-primary/70">
							Authentication
							<span className="ml-2 text-primary/40 normal-case font-normal">(optional — for private repos)</span>
						</label>
						<div className="grid grid-cols-2 gap-2">
							<input
								type="text"
								value={usernameInput}
								onChange={(e) => setUsernameInput(e.target.value)}
								placeholder="Username"
								autoComplete="off"
								className="bg-background/40 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder-gray-600"
							/>
							<input
								type="password"
								ref={passwordRef}
								defaultValue=""
								placeholder={savedHasCredentials ? "Token saved — enter new to replace" : "Access Token"}
								autoComplete="off"
								className="bg-background/40 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder-gray-600"
							/>
						</div>
						{savedHasCredentials && (
							<p className="text-xs text-blue-400/80 flex items-center gap-1">
								<span>🔑</span> Token saved
							</p>
						)}
						<div className="grid grid-cols-2 gap-2">
							<ActionButton
								icon="💾"
								label="Save Credentials"
								variant="secondary"
								disabled={isBusy || (!usernameInput.trim() && !passwordHasContent)}
								onClick={handleSaveCredentials}
							/>
							<ActionButton
								icon="🗑️"
								label="Remove Credentials"
								variant="delete"
								disabled={isBusy || !savedHasCredentials}
								onClick={handleRemoveCredentials}
							/>
						</div>
					</div>
				) : (
					<div className="space-y-2">
						<div className="relative opacity-50 pointer-events-none select-none space-y-2">
							<label className="text-xs font-bold uppercase tracking-widest text-primary/70">
								Authentication
								<span className="ml-2 text-primary/40 normal-case font-normal">(optional — for private repos)</span>
							</label>
							<div className="grid grid-cols-2 gap-2">
								<input
									type="text"
									value=""
									readOnly
									placeholder="Username"
									className="bg-background/40 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm outline-none placeholder-gray-600"
								/>
								<input
									type="password"
									value=""
									readOnly
									placeholder="Access Token"
									className="bg-background/40 border border-primary/20 rounded-lg px-3 py-2 text-white text-sm outline-none placeholder-gray-600"
								/>
							</div>
							<p className="text-xs text-yellow-400/70 flex items-center gap-1">
								<span>🚧</span> Private repo authentication — coming back soon
							</p>
						</div>
						{/* Remove button always accessible even when auth input is disabled */}
						<button
							onClick={handleRemoveCredentials}
							disabled={isBusy || !savedHasCredentials}
							className="text-xs text-red-400/70 hover:text-red-400 disabled:text-gray-60-600 disabled:cursor-not-allowed transition-colors"
						>
							Remove credentials
						</button>
					</div>
				)}

				{/* Action Buttons */}
				<div className="grid grid-cols-2 gap-3">
					{/* Clone button: visible when URL input has content */}
					{inputHasContent && (
						<ActionButton
							icon={urlChanged && hasUrl ? "💥" : "📥"}
							label={urlChanged && hasUrl ? "Re-Clone (nuke + clone)" : "Clone"}
							variant="primary"
							disabled={isBusy || !inputHasContent}
							onClick={handleClone}
						/>
					)}

					{/* Pull button: visible only when git is configured and URL hasn't changed */}
					{hasUrl && !urlChanged && (
						<ActionButton
							icon="⬇️"
							label="Pull"
							variant="secondary"
							disabled={isBusy}
							onClick={handlePull}
						/>
					)}

					{/* Remove git config */}
					{hasUrl && (
						<ActionButton
							icon="🗑️"
							label="Remove Git Config"
							variant="delete"
							disabled={isBusy}
							onClick={handleRemoveGit}
						/>
					)}

					{/* Remove git config */}
					{hasUrl && (
						<ActionButton
							icon="📂"
							label="Open Git Repo"
							variant="secondary"
							disabled={isBusy}
							onClick={()=>{
								if (!savedUrl) return;
								const url = new URL(savedUrl);
								// Strip credentials for safety
								url.username = "";
								url.password = "";
								window.open(url.toString(), "_blank");
							}}
						/>
					)}
				</div>

				{/* Periodic Pull Toggle + Interval */}
				{hasUrl && (
					<div className="bg-background/30 border border-primary/10 rounded-lg p-4 space-y-4">
						{/* Toggle row */}
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-semibold text-primary">Periodic Pull</p>
								<p className="text-xs text-gray-400 mt-0.5">
									Automatically pull from git on a schedule
								</p>
							</div>
							<button
								onClick={() => handleTogglePeriodicPull(!periodicPull)}
								disabled={isBusy}
								className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none disabled:opacity-50 ${
									periodicPull ? "bg-blue-600" : "bg-gray-600"
								}`}
							>
								<span
									className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${
										periodicPull ? "translate-x-6" : "translate-x-0"
									}`}
								/>
							</button>
						</div>

						{/* Interval selector — always visible so users can change it before enabling */}
						<div className="space-y-2">
							<label className="text-xs font-bold uppercase tracking-widest text-primary/70">
								Pull Interval
							</label>

							{/* Preset buttons */}
							<div className="grid grid-cols-4 gap-1.5">
								{[
									{ label: "5 min", value: 5 },
									{ label: "10 min", value: 10 },
									{ label: "15 min", value: 15 },
									{ label: "30 min", value: 30 },
									{ label: "1 hour", value: 60 },
									{ label: "2 hours", value: 120 },
									{ label: "6 hours", value: 360 },
									{ label: "Daily", value: 1440 },
								].map((preset) => (
									<button
										key={preset.value}
										type="button"
										onClick={() => handleUpdateInterval(preset.value)}
										disabled={isBusy}
										className={`p-1.5 text-xs rounded-lg border transition-all duration-300 ${
											pullInterval === preset.value
												? "bg-primary/20 border-primary/50 text-primary font-semibold"
												: "bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:border-primary/30 hover:text-white"
										}`}
									>
										{preset.label}
									</button>
								))}
							</div>

							{/* Custom number input */}
							<div className="flex items-center gap-2">
								<input
									type="number"
									min={1}
									max={1440}
									value={pullInterval}
									onChange={(e) => {
										const val = Math.max(1, Math.min(1440, parseInt(e.target.value) || 1));
										setPullInterval(val);
									}}
									onBlur={(e) => {
										const val = Math.max(1, Math.min(1440, parseInt(e.target.value) || 1));
										handleUpdateInterval(val);
									}}
									disabled={isBusy}
									className="w-24 bg-background/40 border border-primary/20 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-primary/50 transition-colors"
								/>
								<span className="text-xs text-gray-400">minutes (1–1440)</span>
							</div>
						</div>
					</div>
				)}

				{/* Log Output */}
				{logs && (
					<div className="space-y-1">
						<label className="text-xs font-bold uppercase tracking-widest text-primary/70">
							Output
						</label>
						<pre
							ref={logsRef}
							className={`bg-black/40 border ${logBorderColor} rounded-lg p-3 text-xs font-mono text-gray-300 max-h-64 overflow-y-auto whitespace-pre-wrap break-words`}
							style={{ scrollbarWidth: "thin" }}
						>
							{logs}
						</pre>
					</div>
				)}

				{/* Info box when no git configured */}
				{!hasUrl && !inputHasContent && (
					<div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-4 text-sm text-blue-300">
						<p className="font-semibold mb-1">📌 How it works</p>
						<ul className="space-y-1 text-xs text-blue-300/80 list-disc list-inside">
							<li>Enter a git repository URL above and click <strong>Clone</strong></li>
							<li>Optionally set a <strong>Source Directory</strong> to only deploy a subdirectory of the repo</li>
							<li>The app directory will be cleared and the repo (or subdirectory) will be cloned there</li>
							<li>The file manager will be disabled while git source is active</li>
							<li>Enable <strong>Periodic Pull</strong> to auto-update on your chosen schedule</li>
							<li>Use <strong>Pull</strong> for a manual update at any time</li>
						</ul>
					</div>
				)}
			</div>
		</Modal>
	);
}

export default GitVersionControlModal;
