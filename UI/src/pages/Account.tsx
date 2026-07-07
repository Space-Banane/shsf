import { useContext, useState } from "react";
import { UserContext } from "../App";
import { deleteAccount, exportAccountData, updateAccountSettings } from "../services/backend.account";
import { HelpTooltip } from "../components/ui/Tooltip";
import { Icon } from "../components/ui/Icon";
import { Link } from "react-router-dom";

export const AccountPage = () => {
	const { user, refreshUser, loading } = useContext(UserContext);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [deleteConfirmation, setDeleteConfirmation] = useState("");
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [deleteError, setDeleteError] = useState("");
	const [exportLoading, setExportLoading] = useState(false);
	const aiFeaturesEnabled = Boolean(user?.apiKeyConfigured);

	const [openRouterKey, setOpenRouterKey] = useState<string>("");
	const [aiSettingsSaving, setAiSettingsSaving] = useState(false);
	const [aiSettingsMessage, setAiSettingsMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
	const [showKey, setShowKey] = useState(false);

	const handleSaveAiSettings = async () => {
		const trimmedKey = openRouterKey.trim();
		if (!trimmedKey) {
			setAiSettingsMessage({ type: "err", text: "Enter an OpenRouter API key before saving." });
			return;
		}
		setAiSettingsSaving(true);
		setAiSettingsMessage(null);
		try {
			const result = await updateAccountSettings({ openRouterKey: trimmedKey });
			if (result.status === "OK") {
				setAiSettingsMessage({ type: "ok", text: "API key saved successfully" });
				setOpenRouterKey("");
				refreshUser();
			} else {
				setAiSettingsMessage({ type: "err", text: result.message });
			}
		} catch {
			setAiSettingsMessage({ type: "err", text: "An error occurred while saving" });
		} finally {
			setAiSettingsSaving(false);
		}
	};

	const handleClearAiSettings = async () => {
		setAiSettingsSaving(true);
		setAiSettingsMessage(null);
		try {
			const result = await updateAccountSettings({ openRouterKey: null });
			if (result.status === "OK") {
				setAiSettingsMessage({ type: "ok", text: "Saved API key removed successfully" });
				setOpenRouterKey("");
				refreshUser();
			} else {
				setAiSettingsMessage({ type: "err", text: result.message });
			}
		} catch {
			setAiSettingsMessage({ type: "err", text: "An error occurred while clearing the key" });
		} finally {
			setAiSettingsSaving(false);
		}
	};

	const handleDeleteAccount = async () => {
		if (deleteConfirmation !== "DELETE_MY_ACCOUNT") {
			setDeleteError("Please type 'DELETE_MY_ACCOUNT' to confirm");
			return;
		}
		setDeleteLoading(true);
		setDeleteError("");
		try {
			const result = await deleteAccount(deleteConfirmation);
			if (result.status === "OK") {
				window.location.href = "/";
			} else {
				setDeleteError(result.message);
			}
		} catch {
			setDeleteError("An error occurred while deleting your account");
		} finally {
			setDeleteLoading(false);
		}
	};

	const handleExportData = async () => {
		setExportLoading(true);
		try {
			const response = await exportAccountData();
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `shsf-account-export-${new Date().toISOString().split("T")[0]}.json`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch {
			// handled silently
		} finally {
			setExportLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-24">
				<div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
			</div>
		);
	}

	const inputClass = "w-full px-3 py-2 bg-background border border-white/[0.07] rounded-lg text-text text-sm focus:border-primary/50 focus:outline-none placeholder:text-muted/60";
	const btnPrimary = "px-4 py-2 bg-primary text-background text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50";
	const btnSecondary = "px-4 py-2 border border-white/[0.07] text-text/70 text-sm font-medium rounded-lg hover:bg-surface-raised hover:text-text hover:border-primary/20 transition-colors disabled:opacity-50";

	return (
		<div>
			<div className="mb-6">
				<h1 className="text-2xl font-semibold text-text">Account</h1>
				<p className="text-sm text-muted mt-0.5">Manage your profile, settings, and account preferences</p>
			</div>

			{user ? (
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Left column */}
					<div className="lg:col-span-2 space-y-6">
						{/* Profile */}
						<div className="bg-surface border border-white/[0.07] rounded-xl">
							<div className="px-5 py-4 border-b border-white/[0.07]">
								<h2 className="text-sm font-semibold text-text">Profile Information</h2>
							</div>
							<div className="px-5 py-4">
								<div className="flex items-center gap-3 mb-4">
									<div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-semibold text-base shrink-0">
										{user.email?.[0]?.toUpperCase() ?? "?"}
									</div>
									<div>
										<p className="text-sm font-semibold text-text">{user.email}</p>
										<div className="flex gap-2 mt-0.5">
											<span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-xs">Active</span>
											<span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-xs">Verified</span>
										</div>
									</div>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div className="bg-background border border-white/[0.07] rounded-lg px-3 py-3">
										<p className="text-xs text-muted mb-1">Email Address</p>
										<p className="text-sm text-text font-medium">{user.email}</p>
									</div>
									<div className="bg-background border border-white/[0.07] rounded-lg px-3 py-3">
										<p className="text-xs text-muted mb-1">Account Since</p>
										<p className="text-sm text-text font-medium">
											{user.createdAt
												? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
												: "Unknown"}
										</p>
									</div>
								</div>
							</div>
						</div>

						{/* AI Settings */}
						<div className="bg-surface border border-white/[0.07] rounded-xl">
							<div className="px-5 py-4 border-b border-white/[0.07]">
								<h2 className="text-sm font-semibold text-text flex items-center gap-2">
									AI Settings
									<HelpTooltip
										content="AI-powered code generation lets you describe a function in plain language and have it written automatically. Requires an OpenRouter API key."
										placement="right"
									/>
								</h2>
							</div>
							<div className="px-5 py-4 space-y-4">
								<div className={`px-3 py-2 rounded-lg border text-xs ${aiFeaturesEnabled ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-white/[0.03] border-white/[0.07] text-muted"}`}>
									{aiFeaturesEnabled ? "AI features are currently enabled." : "AI features are disabled until an OpenRouter API key is configured."}
								</div>
								<p className="text-xs text-muted leading-relaxed">
									Provide your own{" "}
									<a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-primary/70 hover:text-primary underline underline-offset-2">
										OpenRouter API key
									</a>{" "}
									to enable AI-powered code generation. Your key is stored securely and used only for your requests.
								</p>

								<div>
									<label className="flex items-center gap-1.5 text-xs font-medium text-muted mb-1.5">
										OpenRouter API Key
										<HelpTooltip
											content="Get your key at openrouter.ai/keys. Keys start with sk-or-. Your key is encrypted at rest and never returned to the browser."
											placement="right"
										/>
									</label>
									<div className="flex gap-2">
										<input
											type={showKey ? "text" : "password"}
											value={openRouterKey}
											onChange={(e) => setOpenRouterKey(e.target.value)}
											placeholder={aiFeaturesEnabled ? "Enter a new key to replace the saved one" : "sk-or-…"}
											className={`${inputClass} flex-1 font-mono`}
										/>
										<button
											onClick={() => setShowKey((v) => !v)}
											className="px-3 py-2 border border-white/[0.07] rounded-lg text-muted hover:text-text hover:border-primary/20 transition-colors"
											title={showKey ? "Hide key" : "Show key"}
										>
											<Icon name={showKey ? "eye-slash" : "eye"} className="w-4 h-4" />
										</button>
									</div>
									<p className="text-xs text-muted/50 mt-1">The saved key is never shown back to the browser.</p>
								</div>

								{aiSettingsMessage && (
									<div className={`px-3 py-2 rounded-lg border text-sm ${aiSettingsMessage.type === "ok" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
										{aiSettingsMessage.text}
									</div>
								)}

								<div className="flex gap-2">
									<button onClick={handleSaveAiSettings} disabled={aiSettingsSaving} className={btnPrimary}>
										{aiSettingsSaving ? "Saving…" : "Save Key"}
									</button>
									{aiFeaturesEnabled && (
										<button onClick={handleClearAiSettings} disabled={aiSettingsSaving} className={btnSecondary}>
											{aiSettingsSaving ? "Clearing…" : "Remove Key"}
										</button>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Sidebar */}
					<div className="space-y-6">
						{/* Quick Actions */}
						<div className="bg-surface border border-white/[0.07] rounded-xl">
							<div className="px-5 py-4 border-b border-white/[0.07]">
								<h3 className="text-sm font-semibold text-text">Quick Actions</h3>
							</div>
							<ul className="divide-y divide-white/[0.04]">
								<SidebarAction icon="arrow-path" label="Refresh Profile" description="Reload account data" onClick={() => refreshUser()} />
								<SidebarAction icon="arrow-down-tray" label={exportLoading ? "Exporting…" : "Export Data"} description="Download as JSON" onClick={handleExportData} />
								<SidebarAction icon="code-bracket" label="My Functions" description="View deployed functions" href="/functions" />
								<SidebarAction icon="book-open" label="Documentation" description="Learn more about SHSF" href="/docs" />
								<SidebarAction icon="key" label="Access Tokens" description="Manage API tokens" href="/access-tokens" />
							</ul>
						</div>

						{/* Danger Zone */}
						<div className="bg-surface border border-red-500/20 rounded-xl">
							<div className="px-5 py-4 border-b border-red-500/20">
								<h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
							</div>
							<div className="px-5 py-4">
								<p className="text-xs text-muted mb-3">Permanently deletes your account and all associated data. This cannot be undone.</p>
								<button onClick={() => setShowDeleteModal(true)} className="w-full py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 rounded-lg text-red-400 text-sm font-medium transition-colors">
									Delete Account
								</button>
							</div>
						</div>
					</div>
				</div>
			) : (
				<div className="flex flex-col items-center py-20 text-center">
					<p className="text-sm text-muted mb-4">Unable to load account information.</p>
					<button onClick={() => refreshUser()} className="px-4 py-2 bg-primary text-background text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
						Try Again
					</button>
				</div>
			)}

			{/* Delete Account Modal */}
			{showDeleteModal && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div className="bg-surface-raised border border-white/[0.07] rounded-xl p-6 w-full max-w-md shadow-2xl">
						<h2 className="text-base font-semibold text-red-400 mb-1">Delete Account</h2>
						<p className="text-sm text-muted mb-4">This action cannot be undone. All your data will be permanently deleted.</p>
						<div className="space-y-3">
							<div>
								<label className="block text-xs font-medium text-muted mb-1.5">
									Type <code className="text-primary/80">DELETE_MY_ACCOUNT</code> to confirm
								</label>
								<input
									type="text"
									value={deleteConfirmation}
									onChange={(e) => setDeleteConfirmation(e.target.value)}
									className="w-full px-3 py-2 bg-background border border-white/[0.07] rounded-lg text-text text-sm font-mono focus:border-red-500/50 focus:outline-none"
									placeholder="DELETE_MY_ACCOUNT"
								/>
							</div>
							{deleteError && (
								<p className="text-sm text-red-400">{deleteError}</p>
							)}
							<div className="flex gap-2 pt-1">
								<button
									onClick={() => { setShowDeleteModal(false); setDeleteConfirmation(""); setDeleteError(""); }}
									className={btnSecondary + " flex-1 justify-center"}
									disabled={deleteLoading}
								>
									Cancel
								</button>
								<button
									onClick={handleDeleteAccount}
									disabled={deleteLoading || deleteConfirmation !== "DELETE_MY_ACCOUNT"}
									className="flex-1 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									{deleteLoading ? "Deleting…" : "Delete Account"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

function SidebarAction({
	icon,
	label,
	description,
	onClick,
	href,
}: {
	icon: string;
	label: string;
	description: string;
	onClick?: () => void;
	href?: string;
}) {
	const cls = "w-full flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors group text-left";
	const inner = (
		<>
			<Icon name={icon as any} className="w-4 h-4 text-primary/50 shrink-0" />
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-text">{label}</p>
				<p className="text-xs text-muted">{description}</p>
			</div>
			<Icon name="chevron-right" className="w-3.5 h-3.5 text-muted/40 shrink-0" />
		</>
	);
	if (href) return <li><Link to={href} className={cls}>{inner}</Link></li>;
	return <li><button onClick={onClick} className={cls}>{inner}</button></li>;
}
