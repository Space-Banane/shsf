import { useCallback, useEffect, useState } from "react";
import {
	addGroupMember,
	createGroup,
	deleteGroup,
	listAdminGroups,
	listAudit,
	removeGroupMember,
	type AdminGroup,
	type AuditEntry,
} from "../../services/backend.sharing";

const input = "h-9 rounded-lg border border-white/[0.08] bg-background/60 px-3 text-sm text-text outline-none focus:border-primary/50";
const btn = "h-9 px-3 rounded-lg text-sm font-medium bg-primary text-background hover:bg-primary/90 disabled:opacity-50";
const card = "bg-surface border border-white/[0.07] rounded-xl p-5";

/** Admin-managed groups (members, SSO mapping) and the share/membership audit trail. */
export default function GroupsTab() {
	const [groups, setGroups] = useState<AdminGroup[] | null>(null);
	const [audit, setAudit] = useState<AuditEntry[]>([]);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [form, setForm] = useState({ name: "", ssoProvider: "", ssoGroupId: "" });
	const [memberEmail, setMemberEmail] = useState<Record<number, string>>({});

	const load = useCallback(async () => {
		const [g, a] = await Promise.all([listAdminGroups(), listAudit()]);
		if (g.status === "OK") setGroups(g.data);
		else {
			setGroups([]);
			setError(g.message);
		}
		if (a.status === "OK") setAudit(a.data);
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const run = async (action: () => Promise<{ status: string; message?: string }>) => {
		setBusy(true);
		setError("");
		const res = await action();
		setBusy(false);
		if (res.status !== "OK") setError(res.message ?? "Request failed");
		await load();
		return res.status === "OK";
	};

	const create = async () => {
		if (!form.name.trim()) return setError("Group name is required");
		const ok = await run(() =>
			createGroup({
				name: form.name.trim(),
				ssoProvider: form.ssoProvider.trim() || null,
				ssoGroupId: form.ssoGroupId.trim() || null,
			}),
		);
		if (ok) setForm({ name: "", ssoProvider: "", ssoGroupId: "" });
	};

	return (
		<div className="space-y-4">
			{error && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>}

			<div className={card}>
				<h2 className="text-base font-semibold text-primary mb-1">New group</h2>
				<p className="text-xs text-muted mb-3">
					Users share resources with groups they belong to. Optionally map an SSO provider group so synced members land here.
				</p>
				<div className="flex flex-wrap gap-2">
					<input className={input} placeholder="Name" aria-label="Group name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
					<input className={input} placeholder="SSO provider (optional)" aria-label="SSO provider" value={form.ssoProvider} onChange={(e) => setForm({ ...form, ssoProvider: e.target.value })} />
					<input className={input} placeholder="SSO group id (optional)" aria-label="SSO group id" value={form.ssoGroupId} onChange={(e) => setForm({ ...form, ssoGroupId: e.target.value })} />
					<button className={btn} disabled={busy} onClick={() => void create()}>Create</button>
				</div>
			</div>

			{groups === null ? (
				<p className="text-sm text-muted">Loading groups…</p>
			) : groups.length === 0 ? (
				<p className="text-sm text-muted">No groups yet.</p>
			) : (
				groups.map((g) => (
					<div key={g.id} className={card}>
						<div className="flex items-start justify-between gap-3">
							<div>
								<h3 className="font-semibold text-text">{g.name}</h3>
								<p className="text-xs text-muted">
									{g.members.length} member{g.members.length === 1 ? "" : "s"} · {g._count.shares} share{g._count.shares === 1 ? "" : "s"}
									{g.ssoProvider && ` · SSO ${g.ssoProvider}:${g.ssoGroupId}`}
								</p>
							</div>
							<button
								className="text-xs text-red-400 hover:underline disabled:opacity-50"
								disabled={busy}
								onClick={() => window.confirm(`Delete group "${g.name}"? Its shares are revoked.`) && void run(() => deleteGroup(g.id))}
							>
								Delete
							</button>
						</div>
						<ul className="mt-3 space-y-1">
							{g.members.map((m) => (
								<li key={m.user.id} className="flex items-center justify-between text-sm">
									<span>
										{m.user.displayName} <span className="text-muted">({m.user.email})</span>
										{m.source === "sso" && <span className="ml-2 text-[10px] uppercase text-blue-300">sso</span>}
									</span>
									<button className="text-xs text-muted hover:text-red-400" disabled={busy} onClick={() => void run(() => removeGroupMember(g.id, m.user.id))}>
										Remove
									</button>
								</li>
							))}
						</ul>
						<div className="mt-3 flex gap-2">
							<input
								className={`${input} flex-1`}
								placeholder="user@example.com"
								aria-label={`Add member to ${g.name}`}
								value={memberEmail[g.id] ?? ""}
								onChange={(e) => setMemberEmail({ ...memberEmail, [g.id]: e.target.value })}
							/>
							<button
								className={btn}
								disabled={busy || !memberEmail[g.id]?.trim()}
								onClick={async () => {
									if (await run(() => addGroupMember(g.id, memberEmail[g.id].trim()))) setMemberEmail({ ...memberEmail, [g.id]: "" });
								}}
							>
								Add member
							</button>
						</div>
					</div>
				))
			)}

			<div className={card}>
				<h2 className="text-base font-semibold text-primary mb-3">Audit log</h2>
				{audit.length === 0 ? (
					<p className="text-sm text-muted">No group or share changes recorded yet.</p>
				) : (
					<ul className="space-y-1 font-mono text-xs text-text/80 max-h-80 overflow-y-auto">
						{audit.map((e) => (
							<li key={e.id}>
								{new Date(e.createdAt).toLocaleString()} · {e.action} {e.targetType}#{e.targetId ?? "-"} by {e.actorId === null ? "system" : `user#${e.actorId}`}
								{e.details ? ` ${JSON.stringify(e.details)}` : ""}
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
