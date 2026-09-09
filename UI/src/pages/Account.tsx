import { useCallback, useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserContext } from "../App";
import { Icon, IconName } from "../components/ui/Icon";
import { HelpTooltip } from "../components/ui/Tooltip";
import { useShiftEnterSubmit } from "../hooks/useShiftEnterSubmit";
import { deleteAccount, exportAccountData, getAccountSettings, updateAccountSettings } from "../services/backend.account";

interface EnvironmentVariable { name: string; value: string; }
type Notice = { type: "ok" | "err"; text: string };

const inputClass = "w-full rounded-lg border border-white/[0.07] bg-background px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/10";
const primaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/[0.07] px-4 py-2 text-sm font-medium text-text/80 transition-colors hover:border-primary/30 hover:bg-surface-raised hover:text-text focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50";

export const AccountPage = () => {
	const { user, refreshUser, loading } = useContext(UserContext);
	const [key, setKey] = useState("");
	const [showKey, setShowKey] = useState(false);
	const [aiSaving, setAiSaving] = useState(false);
	const [aiNotice, setAiNotice] = useState<Notice | null>(null);
	const [variables, setVariables] = useState<EnvironmentVariable[]>([]);
	const [variablesLoading, setVariablesLoading] = useState(true);
	const [variablesSaving, setVariablesSaving] = useState(false);
	const [variablesNotice, setVariablesNotice] = useState<Notice | null>(null);
	const [exportLoading, setExportLoading] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteText, setDeleteText] = useState("");
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [deleteError, setDeleteError] = useState("");
	const aiEnabled = Boolean(user?.apiKeyConfigured);

	const loadSettings = useCallback(async () => {
		setVariablesLoading(true); setVariablesNotice(null);
		try {
			const result = await getAccountSettings();
			if (result.status === "OK") setVariables(result.data.accountEnvironment);
			else setVariablesNotice({ type: "err", text: result.message });
		} catch { setVariablesNotice({ type: "err", text: "We couldn't load your shared environment variables. Try again." }); }
		finally { setVariablesLoading(false); }
	}, []);

	useEffect(() => { if (user) loadSettings(); }, [loadSettings, user]);

	const saveKey = async () => {
		if (!key.trim()) { setAiNotice({ type: "err", text: "Enter an OpenRouter API key before saving." }); return; }
		setAiSaving(true); setAiNotice(null);
		try {
			const result = await updateAccountSettings({ openRouterKey: key.trim() });
			if (result.status === "OK") { setKey(""); setAiNotice({ type: "ok", text: "API key saved. AI generation is ready to use." }); refreshUser(); }
			else setAiNotice({ type: "err", text: result.message });
		} catch { setAiNotice({ type: "err", text: "We couldn't save the API key. Try again." }); }
		finally { setAiSaving(false); }
	};

	const removeKey = async () => {
		setAiSaving(true); setAiNotice(null);
		try {
			const result = await updateAccountSettings({ openRouterKey: null });
			if (result.status === "OK") { setKey(""); setAiNotice({ type: "ok", text: "Saved API key removed. AI generation is now off." }); refreshUser(); }
			else setAiNotice({ type: "err", text: result.message });
		} catch { setAiNotice({ type: "err", text: "We couldn't remove the API key. Try again." }); }
		finally { setAiSaving(false); }
	};

	const saveVariables = async () => {
		setVariablesSaving(true); setVariablesNotice(null);
		try {
			const result = await updateAccountSettings({ accountEnvironment: variables.filter(({ name }) => name.trim()) });
			if (result.status === "OK") { setVariables(result.data?.accountEnvironment ?? []); setVariablesNotice({ type: "ok", text: "Shared environment variables saved." }); }
			else setVariablesNotice({ type: "err", text: result.message });
		} catch { setVariablesNotice({ type: "err", text: "We couldn't save your variables. Try again." }); }
		finally { setVariablesSaving(false); }
	};

	const exportData = async () => {
		setExportLoading(true);
		try {
			const response = await exportAccountData(); const url = URL.createObjectURL(await response.blob());
			const link = document.createElement("a"); link.href = url; link.download = `shsf-account-export-${new Date().toISOString().split("T")[0]}.json`;
			document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
		} finally { setExportLoading(false); }
	};

	const confirmDelete = async () => {
		if (deleteText !== "DELETE_MY_ACCOUNT") { setDeleteError("Type DELETE_MY_ACCOUNT exactly to continue."); return; }
		setDeleteLoading(true); setDeleteError("");
		try { const result = await deleteAccount(deleteText); if (result.status === "OK") window.location.href = "/"; else setDeleteError(result.message); }
		catch { setDeleteError("We couldn't delete your account. Try again."); }
		finally { setDeleteLoading(false); }
	};
	useShiftEnterSubmit(confirmDelete, deleteOpen && !deleteLoading && deleteText === "DELETE_MY_ACCOUNT");

	if (loading) return <Loading />;
	if (!user) return <Unavailable onRetry={refreshUser} />;
	const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Unavailable";

	return <div className="mx-auto max-w-6xl pb-10">
		<header className="mb-8 flex flex-col justify-between gap-5 border-b border-white/[0.07] pb-6 sm:flex-row sm:items-end">
			<div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Account settings</p><h1 className="text-3xl font-semibold tracking-tight text-text">Your workspace, your control.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Manage the credentials and defaults that make every function easier to run.</p></div>
			<button type="button" onClick={refreshUser} className={secondaryButton}><Icon name="arrow-path" className="h-4 w-4" /> Refresh account</button>
		</header>
		<section className="mb-8 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.12] via-surface to-surface">
			<div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-xl font-semibold text-primary">{user.email?.[0]?.toUpperCase() ?? "?"}</div><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold text-text">{user.email}</h2><p className="mt-1 text-sm text-muted">Member since {memberSince}</p></div><Link to="/functions" className={primaryButton}><Icon name="code-bracket" className="h-4 w-4" /> View functions</Link></div>
			<div className="grid border-t border-white/[0.07] sm:grid-cols-2"><Summary icon="envelope" label="Email" value={user.email} /><Summary icon="circle-stack" label="Shared variables" value={variablesLoading ? "Loading…" : `${variables.length} configured`} /></div>
		</section>
		<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
			<div className="space-y-8">
				<Section id="ai-settings" icon="sparkles" title="AI generation" description="Bring your own OpenRouter key to create and refine functions from a prompt.">
					<div className={`mb-5 flex gap-3 rounded-xl border p-3.5 text-sm ${aiEnabled ? "border-green-500/20 bg-green-500/[0.08] text-green-300" : "border-white/[0.07] bg-background/60 text-muted"}`}><Icon name={aiEnabled ? "check" : "information-circle"} className="mt-0.5 h-4 w-4 shrink-0" />{aiEnabled ? "AI generation is active for this account." : "Add an API key to enable AI-powered function generation."}</div>
					<label htmlFor="openrouter-key" className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">OpenRouter API key <HelpTooltip content="Your key is encrypted at rest and is never returned to the browser." placement="right" /></label>
					<div className="flex flex-col gap-2 sm:flex-row"><div className="relative min-w-0 flex-1"><input id="openrouter-key" type={showKey ? "text" : "password"} value={key} onChange={(event) => setKey(event.target.value)} placeholder={aiEnabled ? "Enter a new key to replace the saved one" : "sk-or-…"} className={`${inputClass} pr-11 font-mono`} /><button type="button" onClick={() => setShowKey((value) => !value)} className="absolute inset-y-0 right-0 px-3 text-muted hover:text-text" aria-label={showKey ? "Hide API key" : "Show API key"}><Icon name={showKey ? "eye-slash" : "eye"} className="h-4 w-4" /></button></div><button type="button" onClick={saveKey} disabled={aiSaving} className={primaryButton}>{aiSaving ? "Saving…" : "Save key"}</button></div>
					<div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-5 text-muted">Get a key from <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-primary hover:underline">OpenRouter</a>. The saved key is never displayed here.</p>{aiEnabled && <button type="button" onClick={removeKey} disabled={aiSaving} className="text-xs font-medium text-red-300 hover:text-red-200 disabled:opacity-50">Remove saved key</button>}</div><NoticeMessage notice={aiNotice} />
				</Section>
				<Section id="environment" icon="cog-6-tooth" title="Shared environment" description="Set defaults once for every function you own. Function-level values take precedence.">
					<div className="mb-5 flex items-start gap-3 rounded-xl border border-white/[0.07] bg-background/50 p-3.5 text-xs leading-5 text-muted"><Icon name="information-circle" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Use this for repeated configuration such as service URLs. Do not add secrets you would not want available to all of your functions.</div>
					{variablesLoading ? <div className="flex h-28 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /></div> : <>{variables.length === 0 ? <div className="rounded-xl border border-dashed border-white/[0.12] bg-background/30 px-5 py-8 text-center"><Icon name="cog-6-tooth" className="mx-auto mb-3 h-5 w-5 text-primary/60" /><p className="text-sm font-medium text-text">No shared variables yet</p><p className="mt-1 text-xs text-muted">Start with a service URL or an API key that every function needs.</p></div> : <><div className="mb-3 hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] gap-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted sm:grid"><span>Name</span><span>Value</span><span className="sr-only">Remove</span></div><div className="space-y-2">{variables.map((variable, index) => <div key={`${index}-${variable.name}`} className="grid gap-2 rounded-xl border border-white/[0.07] bg-background/40 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] sm:items-center sm:gap-3"><input type="text" placeholder="VARIABLE_NAME" className={`${inputClass} font-mono`} value={variable.name} onChange={(event) => setVariables((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /><input type="text" placeholder="value" className={`${inputClass} font-mono`} value={variable.value} onChange={(event) => setVariables((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} /><button type="button" onClick={() => setVariables((all) => all.filter((_, itemIndex) => itemIndex !== index))} className="inline-flex h-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-500/10 hover:text-red-300" aria-label={`Remove ${variable.name || "environment variable"}`}><Icon name="trash" className="h-4 w-4" /></button></div>)}</div></>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setVariables((all) => [...all, { name: "", value: "" }])} className={secondaryButton}><Icon name="plus" className="h-4 w-4" /> Add variable</button>{variables.length > 0 && <button type="button" onClick={saveVariables} disabled={variablesSaving} className={primaryButton}>{variablesSaving ? "Saving…" : "Save changes"}</button>}</div></>}<NoticeMessage notice={variablesNotice} />
				</Section>
			</div>
			<aside className="space-y-5 lg:sticky lg:top-6 lg:self-start"><div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-4"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Suggested next step</p><h2 className="mt-2 text-sm font-semibold text-text">{aiEnabled ? "Add shared defaults" : "Enable AI generation"}</h2><p className="mt-1 text-xs leading-5 text-muted">{aiEnabled ? "Use shared variables for configuration used by several functions." : "Add your OpenRouter API key to generate functions from a prompt."}</p><a href={aiEnabled ? "#environment" : "#ai-settings"} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-secondary">Open settings <Icon name="chevron-right" className="h-3.5 w-3.5" /></a></div><div className="rounded-xl border border-white/[0.07] bg-surface p-4"><h2 className="text-sm font-semibold text-text">Account tools</h2><div className="mt-3 space-y-1"><ToolLink icon="key" label="Access tokens" description="Programmatic access" to="/access-tokens" /><ToolLink icon="book-open" label="Documentation" description="Guides and references" to="/docs" /><button type="button" onClick={exportData} disabled={exportLoading} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04] disabled:opacity-50"><Icon name="arrow-down-tray" className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block text-sm text-text">{exportLoading ? "Preparing export…" : "Export account data"}</span><span className="block text-xs text-muted">Download a JSON copy</span></span></button></div></div><div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4"><div className="flex items-center gap-2"><Icon name="exclamation-triangle" className="h-4 w-4 text-red-300" /><h2 className="text-sm font-semibold text-red-200">Danger zone</h2></div><p className="mt-2 text-xs leading-5 text-muted">Deleting your account permanently removes your functions and associated data.</p><button type="button" onClick={() => setDeleteOpen(true)} className="mt-4 text-sm font-medium text-red-300 transition-colors hover:text-red-200">Delete account</button></div></aside>
		</div>
		{deleteOpen && <DeleteDialog confirmation={deleteText} error={deleteError} loading={deleteLoading} onChange={setDeleteText} onCancel={() => { setDeleteOpen(false); setDeleteText(""); setDeleteError(""); }} onDelete={confirmDelete} />}
	</div>;
};

function Section({ id, icon, title, description, children }: { id: string; icon: IconName; title: string; description: string; children: React.ReactNode }) { return <section id={id} className="scroll-mt-6 rounded-2xl border border-white/[0.07] bg-surface"><div className="border-b border-white/[0.07] px-5 py-4 sm:px-6"><div className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name={icon} className="h-4 w-4" /></div><div><h2 className="text-base font-semibold text-text">{title}</h2><p className="mt-0.5 text-sm leading-5 text-muted">{description}</p></div></div></div><div className="p-5 sm:p-6">{children}</div></section>; }
function Summary({ icon, label, value }: { icon: IconName; label: string; value: string }) { return <div className="flex min-w-0 items-center gap-3 border-b border-white/[0.07] px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><Icon name={icon} className="h-4 w-4 shrink-0 text-primary/80" /><div className="min-w-0"><p className="text-xs text-muted">{label}</p><p className="truncate text-sm font-medium text-text">{value}</p></div></div>; }
function NoticeMessage({ notice }: { notice: Notice | null }) { return notice ? <p role="status" className={`mt-4 rounded-lg border px-3 py-2 text-sm ${notice.type === "ok" ? "border-green-500/20 bg-green-500/[0.08] text-green-300" : "border-red-500/20 bg-red-500/[0.08] text-red-300"}`}>{notice.text}</p> : null; }
function ToolLink({ icon, label, description, to }: { icon: IconName; label: string; description: string; to: string }) { return <Link to={to} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.04]"><Icon name={icon} className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block text-sm text-text">{label}</span><span className="block text-xs text-muted">{description}</span></span><Icon name="chevron-right" className="h-3.5 w-3.5 text-muted" /></Link>; }
function Loading() { return <div className="flex min-h-[28rem] items-center justify-center"><div className="flex items-center gap-3 text-sm text-muted"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />Loading account settings…</div></div>; }
function Unavailable({ onRetry }: { onRetry: () => void }) { return <div className="mx-auto flex min-h-[28rem] max-w-md flex-col items-center justify-center text-center"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-red-300"><Icon name="exclamation-triangle" className="h-5 w-5" /></div><h1 className="text-lg font-semibold text-text">Account unavailable</h1><p className="mt-2 text-sm text-muted">We couldn't load your account information.</p><button type="button" onClick={onRetry} className={`${primaryButton} mt-5`}>Try again</button></div>; }
function DeleteDialog({ confirmation, error, loading, onChange, onCancel, onDelete }: { confirmation: string; error: string; loading: boolean; onChange: (value: string) => void; onCancel: () => void; onDelete: () => void }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-account-title"><div className="w-full max-w-md rounded-2xl border border-red-500/25 bg-surface-raised p-6 shadow-2xl"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-300"><Icon name="exclamation-triangle" className="h-5 w-5" /></div><h2 id="delete-account-title" className="mt-4 text-lg font-semibold text-text">Delete your account?</h2><p className="mt-2 text-sm leading-6 text-muted">This permanently deletes your functions, credentials, and account data. This cannot be undone.</p><label htmlFor="delete-confirmation" className="mt-5 block text-xs font-medium text-muted">Type <code className="rounded bg-background px-1.5 py-0.5 text-primary">DELETE_MY_ACCOUNT</code> to confirm</label><input id="delete-confirmation" autoFocus type="text" value={confirmation} onChange={(event) => onChange(event.target.value)} placeholder="DELETE_MY_ACCOUNT" className={`${inputClass} mt-2 font-mono focus:border-red-500/60 focus:ring-red-500/10`} />{error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} disabled={loading} className={secondaryButton}>Cancel</button><button type="button" onClick={onDelete} disabled={loading || confirmation !== "DELETE_MY_ACCOUNT"} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Deleting…" : "Delete account"}</button></div></div></div>; }
