import { useContext, useState, useEffect, useCallback } from "react";
import { UserContext } from "../App";
import { Navigate } from "react-router-dom";
import { BASE_URL } from "..";
import { HelpTooltip } from "../components/ui/Tooltip";
import { useShiftEnterSubmit } from "../hooks/useShiftEnterSubmit";
import {
	getLinkStatus,
	getLinkable,
	unlinkInstance,
	getLinkLock,
	setLinkLock,
	getRegistrationDisabled,
	setRegistrationDisabled as apiSetRegistrationDisabled,
	getInstanceUUID,
	type LinkStatus,
} from "../services/backend.global";
import {
	adminListUsers,
	adminCreateUser,
	adminUpdateUser,
	adminDeleteUser,
	adminGetStats,
	getGuestAccessDisabled,
	setGuestAccessDisabled as apiSetGuestAccessDisabled,
	getExternalAccessDisabled,
	setExternalAccessDisabled as apiSetExternalAccessDisabled,
	getDisabledImages,
	setDisabledImages as apiSetDisabledImages,
	getUpdateStatus,
	setAutoUpdate as apiSetAutoUpdate,
	triggerUpdateCheck,
	triggerUpdateApply,
	type AdminUser,
	type AdminStats,
	type UpdateStatus,
} from "../services/backend.admin";

// ─── Constants ─────────────────────────────────────────────────────────────────

const ALL_IMAGES = [
	{ image: "python:3.11", family: "Python", deprecated: false },
	{ image: "python:3.12", family: "Python", deprecated: false },
	{ image: "python:3.13", family: "Python", deprecated: false },
	{ image: "python:3.14", family: "Python", deprecated: false },
	{ image: "python:3.15", family: "Python", deprecated: false },
	{ image: "python:3.9", family: "Python", deprecated: true },
	{ image: "python:3.10", family: "Python", deprecated: true },
	{ image: "golang:1.22", family: "Go", deprecated: false },
	{ image: "golang:1.23", family: "Go", deprecated: false },
	{ image: "golang:1.20", family: "Go", deprecated: true },
	{ image: "golang:1.21", family: "Go", deprecated: true },
	{ image: "node:20", family: "Node.js", deprecated: false },
	{ image: "node:22", family: "Node.js", deprecated: false },
	{ image: "node:24", family: "Node.js", deprecated: false },
];

// ─── Shared UI helpers ─────────────────────────────────────────────────────────

const cardClass = "bg-surface border border-white/[0.07] rounded-xl p-5 hover:border-primary/20 transition-colors";

function Toggle({ active, onChange, disabled }: { active: boolean; onChange: () => void; disabled?: boolean }) {
	return (
		<button
			onClick={onChange}
			disabled={disabled}
			className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${active ? "bg-primary/80" : "bg-white/10"}`}
		>
			<span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${active ? "translate-x-6" : "translate-x-1"}`} />
		</button>
	);
}

function Skeleton({ className = "h-6 w-24" }: { className?: string }) {
	return <div className={`animate-pulse rounded-full bg-white/10 ${className}`} />;
}

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "info" }) {
	const styles = {
		default: "bg-white/10 text-text/70",
		success: "bg-green-500/15 text-green-400 border border-green-500/20",
		warning: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
		danger: "bg-red-500/15 text-red-400 border border-red-500/20",
		info: "bg-primary/15 text-primary border border-primary/20",
	};
	return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[variant]}`}>{children}</span>;
}

// ─── Tab: Overview / Connectivity ──────────────────────────────────────────────

function OverviewTab() {
	const [linkLocked, setLinkLocked] = useState<boolean | null>(null);
	const [linkLockLoading, setLinkLockLoading] = useState(false);
	const [linkLockError, setLinkLockError] = useState<string | null>(null);

	const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null);
	const [linkable, setLinkable] = useState<boolean | null>(null);
	const [instanceUUID, setInstanceUUID] = useState<string | null>(null);
	const [linkStatusLoading, setLinkStatusLoading] = useState(false);
	const [linkStatusError, setLinkStatusError] = useState<string | null>(null);

	const [unlinkLoading, setUnlinkLoading] = useState(false);
	const [unlinkError, setUnlinkError] = useState<string | null>(null);

	const [secret, setSecret] = useState<string | null>(null);
	const [secretLoading, setSecretLoading] = useState(false);
	const [secretError, setSecretError] = useState<string | null>(null);
	const [showModal, setShowModal] = useState(false);
	const [password, setPassword] = useState("");

	const refreshLinkStatus = useCallback(async () => {
		setLinkStatusLoading(true);
		try {
			const [statusRes, linkableRes, uuidRes] = await Promise.all([getLinkStatus(), getLinkable(), getInstanceUUID()]);
			if (statusRes.status === "OK") setLinkStatus(statusRes as LinkStatus);
			if (linkableRes.status === "OK") setLinkable(linkableRes.linkable);
			if (uuidRes.status === "OK") setInstanceUUID(uuidRes.uuid);
		} catch {
			setLinkStatusError("Failed to load link status.");
		} finally {
			setLinkStatusLoading(false);
		}
	}, []);

	useEffect(() => {
		getLinkLock()
			.then((d) => { if (d.status === "OK") setLinkLocked(d.locked); })
			.catch(() => setLinkLockError("Failed to load link lock state."));
		refreshLinkStatus();
	}, [refreshLinkStatus]);

	const toggleLinkLock = async () => {
		if (linkLocked === null) return;
		setLinkLockLoading(true);
		setLinkLockError(null);
		try {
			const data = await setLinkLock(!linkLocked);
			if (data.status === "OK") {
				setLinkLocked(data.locked);
				getLinkable().then((r) => { if (r.status === "OK") setLinkable(r.linkable); });
			} else {
				setLinkLockError("Failed to update.");
			}
		} catch {
			setLinkLockError("An error occurred.");
		} finally {
			setLinkLockLoading(false);
		}
	};

	const handleUnlink = async () => {
		if (!linkStatus?.linked || !instanceUUID) return;
		setUnlinkLoading(true);
		setUnlinkError(null);
		try {
			const data = await unlinkInstance(linkStatus.global_user_email, instanceUUID);
			if (data.status === "OK") {
				await refreshLinkStatus();
			} else {
				setUnlinkError(data.message ?? "Failed to unlink.");
			}
		} catch {
			setUnlinkError("An error occurred while unlinking.");
		} finally {
			setUnlinkLoading(false);
		}
	};

	const fetchSecret = async () => {
		setSecretLoading(true);
		setSecretError(null);
		try {
			const res = await fetch(`${BASE_URL}/api/global/showSecret`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password }),
			});
			const data = await res.json();
			if (data.status === "OK") {
				setSecret(data.secret);
				setShowModal(false);
				setPassword("");
			} else {
				setSecretError(data.message ?? "Failed to fetch secret.");
			}
		} catch {
			setSecretError("An error occurred while fetching the secret.");
		} finally {
			setSecretLoading(false);
		}
	};

	useShiftEnterSubmit(() => { if (showModal && !secretLoading && password.length > 0) fetchSecret(); }, showModal);

	return (
		<div className="space-y-4">
			{/* Link Lock */}
			<div className={cardClass}>
				<h2 className="text-base font-semibold text-primary mb-1 flex items-center gap-2">
					Link Lock
					<HelpTooltip content="When locked, no one can initiate a new link between this instance and SHSF.DEV." placement="right" />
				</h2>
				<p className="text-text/60 text-sm mb-3">Prevents this instance from being linked to a global account.</p>
				{linkLocked === null ? <Skeleton /> : (
					<div className="flex items-center gap-3">
						<Toggle active={linkLocked} onChange={toggleLinkLock} disabled={linkLockLoading} />
						<span className="text-text/80 text-sm">{linkLocked ? "Locked — linking is disabled" : "Unlocked — linking is allowed"}</span>
					</div>
				)}
				{linkLockError && <p className="mt-2 text-sm text-red-400">{linkLockError}</p>}
			</div>

			{/* Link Status */}
			<div className={cardClass}>
				<div className="flex items-center justify-between mb-1">
					<h2 className="text-base font-semibold text-primary flex items-center gap-2">
						Link Status
						<HelpTooltip content="Whether this instance is linked to an external SHSF.DEV account." placement="right" />
					</h2>
					<button onClick={refreshLinkStatus} disabled={linkStatusLoading} className="text-xs text-text/50 hover:text-text/80 transition-colors disabled:opacity-40">
						{linkStatusLoading ? "Refreshing…" : "Refresh"}
					</button>
				</div>
				<p className="text-text/60 text-sm mb-3">Manage the remote-access link for this instance.</p>
				{linkStatus === null ? <Skeleton className="h-6 w-40" /> : linkStatus.linked ? (
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<span className="inline-block h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
							<span className="text-text text-sm font-medium">Linked</span>
						</div>
						<p className="text-text/70 text-sm">Linked to: <span className="text-primary font-mono">{linkStatus.global_user_email}</span> via SHSF.DEV</p>
						<button onClick={handleUnlink} disabled={unlinkLoading} className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 hover:border-red-500/50 disabled:opacity-50 text-red-400 rounded-lg text-sm font-medium transition-all duration-200">
							{unlinkLoading ? "Unlinking…" : "Unlink"}
						</button>
						{unlinkError && <p className="text-sm text-red-400">{unlinkError}</p>}
					</div>
				) : (
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<span className="inline-block h-2 w-2 rounded-full bg-text/20" />
							<span className="text-text/60 text-sm">Not linked</span>
						</div>
						<p className="text-xs text-text/40">{linkable ? "This instance is open for external linking." : "Linking is currently disabled (link lock is on)."}</p>
					</div>
				)}
				{linkStatusError && <p className="mt-2 text-sm text-red-400">{linkStatusError}</p>}
			</div>

			{/* Server Secret */}
			<div className={cardClass}>
				<h2 className="text-base font-semibold text-primary mb-1 flex items-center gap-2">
					Server Secret
					<HelpTooltip content="The SECRET value from your server's .env file. Only reveal it in a trusted environment." placement="right" />
				</h2>
				<p className="text-text/60 text-sm mb-3">The server's configured secret value. Enter your password to reveal it.</p>
				{secret !== null ? (
					<div className="flex items-center gap-3">
						<code className="flex-1 bg-background/70 text-green-400 font-mono text-sm px-4 py-2 rounded-lg border border-primary/10 break-all">{secret}</code>
						<button onClick={() => setSecret(null)} className="text-sm text-text/50 hover:text-text/80 transition-colors">Hide</button>
					</div>
				) : (
					<button onClick={() => { setPassword(""); setSecretError(null); setShowModal(true); }} className="px-3 py-1.5 bg-primary/20 border border-primary/30 hover:bg-primary/30 hover:border-primary/50 text-primary rounded-lg text-sm font-medium transition-all duration-200">
						Reveal Secret
					</button>
				)}
			</div>

			{instanceUUID && (
				<div className={cardClass}>
					<h2 className="text-base font-semibold text-primary mb-1">Instance UUID</h2>
					<p className="text-text/60 text-sm mb-2">Unique identifier for this SHSF instance.</p>
					<code className="block bg-background/70 text-text/70 font-mono text-xs px-4 py-2 rounded-lg border border-primary/10 break-all">{instanceUUID}</code>
				</div>
			)}

			{showModal && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
					<div className="bg-surface-raised border border-white/[0.07] rounded-xl p-6 w-full max-w-sm shadow-2xl">
						<h3 className="text-lg font-semibold text-primary mb-1">Confirm Identity</h3>
						<p className="text-text/60 text-sm mb-4">Enter your password to reveal the server secret.</p>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Your password"
							className="w-full bg-background/60 border border-primary/20 rounded-lg px-3 py-2 text-text text-sm outline-none focus:border-primary/50 mb-3"
							autoFocus
						/>
						{secretError && <p className="text-sm text-red-400 mb-3">{secretError}</p>}
						<div className="flex gap-2 justify-end">
							<button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm text-text/70 hover:text-text hover:bg-white/5 transition-colors">Cancel</button>
							<button onClick={fetchSecret} disabled={secretLoading || password.length === 0} className="px-4 py-2 bg-primary/20 border border-primary/30 hover:bg-primary/30 disabled:opacity-50 text-primary rounded-lg text-sm font-medium transition-all duration-200">
								{secretLoading ? "Verifying..." : "Confirm"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// ─── Tab: Access Control ────────────────────────────────────────────────────────

function AccessControlTab() {
	const [registrationDisabled, setRegistrationDisabledState] = useState<boolean | null>(null);
	const [registrationLoading, setRegistrationLoading] = useState(false);
	const [registrationError, setRegistrationError] = useState<string | null>(null);

	const [guestAccessDisabled, setGuestAccessDisabledState] = useState<boolean | null>(null);
	const [guestLoading, setGuestLoading] = useState(false);
	const [guestError, setGuestError] = useState<string | null>(null);

	const [externalAccessDisabled, setExternalAccessDisabledState] = useState<boolean | null>(null);
	const [externalLoading, setExternalLoading] = useState(false);
	const [externalError, setExternalError] = useState<string | null>(null);

	useEffect(() => {
		getRegistrationDisabled()
			.then((d) => { if (d.status === "OK") setRegistrationDisabledState(d.disabled); })
			.catch(() => setRegistrationError("Failed to load registration state."));
		getGuestAccessDisabled()
			.then((d) => { if (d.status === "OK") setGuestAccessDisabledState(d.disabled); })
			.catch(() => setGuestError("Failed to load guest access state."));
		getExternalAccessDisabled()
			.then((d) => { if (d.status === "OK") setExternalAccessDisabledState(d.disabled); })
			.catch(() => setExternalError("Failed to load external access state."));
	}, []);

	const toggleRegistration = async () => {
		if (registrationDisabled === null) return;
		setRegistrationLoading(true);
		setRegistrationError(null);
		try {
			const data = await apiSetRegistrationDisabled(!registrationDisabled);
			if (data.status === "OK") setRegistrationDisabledState(data.disabled);
			else setRegistrationError("Failed to update.");
		} catch {
			setRegistrationError("An error occurred.");
		} finally {
			setRegistrationLoading(false);
		}
	};

	const toggleGuestAccess = async () => {
		if (guestAccessDisabled === null) return;
		setGuestLoading(true);
		setGuestError(null);
		try {
			const data = await apiSetGuestAccessDisabled(!guestAccessDisabled);
			if (data.status === "OK") setGuestAccessDisabledState(data.disabled);
			else setGuestError("Failed to update.");
		} catch {
			setGuestError("An error occurred.");
		} finally {
			setGuestLoading(false);
		}
	};

	const toggleExternalAccess = async () => {
		if (externalAccessDisabled === null) return;
		setExternalLoading(true);
		setExternalError(null);
		try {
			const data = await apiSetExternalAccessDisabled(!externalAccessDisabled);
			if (data.status === "OK") setExternalAccessDisabledState(data.disabled);
			else setExternalError("Failed to update.");
		} catch {
			setExternalError("An error occurred.");
		} finally {
			setExternalLoading(false);
		}
	};

	const controls = [
		{
			title: "Disable Registration",
			tooltip: "When enabled, the /register page returns an error and no new accounts can be created. Existing accounts are unaffected.",
			description: "Prevents new users from registering an account on this instance.",
			state: registrationDisabled,
			loading: registrationLoading,
			error: registrationError,
			toggle: toggleRegistration,
			activeLabel: "Disabled — registration is blocked",
			inactiveLabel: "Enabled — registration is open",
			dangerWhenActive: true,
		},
		{
			title: "Disable Guest Access",
			tooltip: "When enabled, all guest user authentication attempts are rejected. Existing guest sessions remain active until they expire.",
			description: "Blocks all guest users from logging in to access shared functions.",
			state: guestAccessDisabled,
			loading: guestLoading,
			error: guestError,
			toggle: toggleGuestAccess,
			activeLabel: "Disabled — guest logins are blocked",
			inactiveLabel: "Enabled — guest logins are allowed",
			dangerWhenActive: true,
		},
		{
			title: "Disable External Access",
			tooltip: "When enabled, function executions via API key (external callers) are blocked. Session-based (UI) execution is unaffected.",
			description: "Blocks function invocations made via API keys from external services.",
			state: externalAccessDisabled,
			loading: externalLoading,
			error: externalError,
			toggle: toggleExternalAccess,
			activeLabel: "Disabled — API key execution blocked",
			inactiveLabel: "Enabled — API key execution allowed",
			dangerWhenActive: true,
		},
	];

	return (
		<div className="space-y-4">
			{controls.map((ctrl) => (
				<div key={ctrl.title} className={cardClass}>
					<h2 className="text-base font-semibold text-primary mb-1 flex items-center gap-2">
						{ctrl.title}
						<HelpTooltip content={ctrl.tooltip} placement="right" />
						{ctrl.state && ctrl.dangerWhenActive && (
							<Badge variant="danger">Active</Badge>
						)}
					</h2>
					<p className="text-text/60 text-sm mb-3">{ctrl.description}</p>
					{ctrl.state === null ? <Skeleton /> : (
						<div className="flex items-center gap-3">
							<Toggle active={ctrl.state} onChange={ctrl.toggle} disabled={ctrl.loading} />
							<span className={`text-sm ${ctrl.state && ctrl.dangerWhenActive ? "text-red-400/80" : "text-text/80"}`}>
								{ctrl.state ? ctrl.activeLabel : ctrl.inactiveLabel}
							</span>
						</div>
					)}
					{ctrl.error && <p className="mt-2 text-sm text-red-400">{ctrl.error}</p>}
				</div>
			))}
		</div>
	);
}

// ─── Tab: Users ─────────────────────────────────────────────────────────────────

function UsersTab() {
	const [users, setUsers] = useState<AdminUser[] | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [search, setSearch] = useState("");

	// Create modal
	const [showCreate, setShowCreate] = useState(false);
	const [createForm, setCreateForm] = useState({ displayName: "", email: "", password: "", role: "User" as "Admin" | "User", allow_docker_mount: false });
	const [createLoading, setCreateLoading] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

	// Edit modal
	const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
	const [editForm, setEditForm] = useState({ displayName: "", role: "User" as "Admin" | "User", allow_docker_mount: false, password: "" });
	const [editLoading, setEditLoading] = useState(false);
	const [editError, setEditError] = useState<string | null>(null);

	// Delete modal
	const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const loadUsers = useCallback(async () => {
		setLoadError(null);
		try {
			const data = await adminListUsers();
			if (data.status === "OK") setUsers(data.users);
			else setLoadError(data.message);
		} catch {
			setLoadError("Failed to load users.");
		}
	}, []);

	useEffect(() => { loadUsers(); }, [loadUsers]);

	const openEdit = (user: AdminUser) => {
		setEditTarget(user);
		setEditForm({ displayName: user.displayName, role: user.role, allow_docker_mount: user.allow_docker_mount, password: "" });
		setEditError(null);
	};

	const handleCreate = async () => {
		setCreateLoading(true);
		setCreateError(null);
		try {
			const data = await adminCreateUser(createForm);
			if (data.status === "OK") {
				setShowCreate(false);
				setCreateForm({ displayName: "", email: "", password: "", role: "User", allow_docker_mount: false });
				loadUsers();
			} else {
				setCreateError(data.message);
			}
		} catch {
			setCreateError("An error occurred.");
		} finally {
			setCreateLoading(false);
		}
	};

	const handleEdit = async () => {
		if (!editTarget) return;
		setEditLoading(true);
		setEditError(null);
		try {
			const payload: Parameters<typeof adminUpdateUser>[1] = {
				displayName: editForm.displayName,
				role: editForm.role,
				allow_docker_mount: editForm.allow_docker_mount,
			};
			if (editForm.password) payload.password = editForm.password;
			const data = await adminUpdateUser(editTarget.id, payload);
			if (data.status === "OK") {
				setEditTarget(null);
				loadUsers();
			} else {
				setEditError(data.message);
			}
		} catch {
			setEditError("An error occurred.");
		} finally {
			setEditLoading(false);
		}
	};

	const handleDelete = async () => {
		if (!deleteTarget) return;
		setDeleteLoading(true);
		setDeleteError(null);
		try {
			const data = await adminDeleteUser(deleteTarget.id);
			if (data.status === "OK") {
				setDeleteTarget(null);
				loadUsers();
			} else {
				setDeleteError(data.message);
			}
		} catch {
			setDeleteError("An error occurred.");
		} finally {
			setDeleteLoading(false);
		}
	};

	useShiftEnterSubmit(() => { if (showCreate && !createLoading) handleCreate(); }, showCreate);
	useShiftEnterSubmit(() => { if (editTarget !== null && !editLoading) handleEdit(); }, editTarget !== null);
	useShiftEnterSubmit(() => { if (deleteTarget !== null && !deleteLoading) handleDelete(); }, deleteTarget !== null);

	const filtered = (users ?? []).filter(
		(u) =>
			u.displayName.toLowerCase().includes(search.toLowerCase()) ||
			u.email.toLowerCase().includes(search.toLowerCase()),
	);

	const inputCls = "w-full bg-background/60 border border-primary/20 rounded-lg px-3 py-2 text-text text-sm outline-none focus:border-primary/50 placeholder-text/30";
	const labelCls = "block text-xs text-text/60 mb-1 font-medium";

	return (
		<div>
			<div className="flex items-center justify-between mb-4">
				<input
					type="text"
					placeholder="Search users…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="bg-background/60 border border-primary/20 rounded-lg px-3 py-2 text-text text-sm outline-none focus:border-primary/50 w-64 placeholder-text/30"
				/>
				<button
					onClick={() => { setCreateError(null); setShowCreate(true); }}
					className="px-3 py-1.5 bg-primary/20 border border-primary/30 hover:bg-primary/30 text-primary rounded-lg text-sm font-medium transition-all duration-200"
				>
					+ Create User
				</button>
			</div>

			{loadError && <p className="text-sm text-red-400 mb-3">{loadError}</p>}

			{users === null ? (
				<div className="space-y-2">
					{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
				</div>
			) : filtered.length === 0 ? (
				<p className="text-text/40 text-sm text-center py-8">{search ? "No users match the search." : "No users found."}</p>
			) : (
				<div className="space-y-2">
					{filtered.map((user) => (
						<div key={user.id} className={`${cardClass} flex items-center justify-between`}>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2 flex-wrap">
									<span className="font-medium text-text truncate">{user.displayName}</span>
									<Badge variant={user.role === "Admin" ? "warning" : "default"}>{user.role}</Badge>
									{user.allow_docker_mount && <Badge variant="danger">Docker Mount</Badge>}
								</div>
								<p className="text-text/50 text-xs mt-0.5 truncate">{user.email}</p>
								<p className="text-text/30 text-xs mt-0.5">
									{user._count.functions} fn · {user._count.namespaces} ns · {user._count.sessions} sessions
								</p>
							</div>
							<div className="flex items-center gap-2 ml-4 shrink-0">
								<button
									onClick={() => openEdit(user)}
									className="px-3 py-1 text-xs text-text/60 hover:text-text bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all duration-150"
								>
									Edit
								</button>
								<button
									onClick={() => { setDeleteError(null); setDeleteTarget(user); }}
									className="px-3 py-1 text-xs text-red-400/70 hover:text-red-400 bg-red-500/5 hover:bg-red-500/15 rounded-lg border border-red-500/10 hover:border-red-500/30 transition-all duration-150"
								>
									Delete
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Create modal */}
			{showCreate && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div className="bg-surface-raised border border-white/[0.07] rounded-xl p-6 w-full max-w-md shadow-2xl">
						<h3 className="text-lg font-semibold text-primary mb-4">Create User</h3>
						<div className="space-y-3">
							<div>
								<label className={labelCls}>Display Name</label>
								<input type="text" className={inputCls} placeholder="Jane Doe" value={createForm.displayName} onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))} />
							</div>
							<div>
								<label className={labelCls}>Email</label>
								<input type="email" className={inputCls} placeholder="jane@example.com" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
							</div>
							<div>
								<label className={labelCls}>Password</label>
								<input type="password" className={inputCls} placeholder="Min. 8 characters" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
							</div>
							<div>
								<label className={labelCls}>Role</label>
								<select className={inputCls} value={createForm.role} onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as "Admin" | "User" }))}>
									<option value="User">User</option>
									<option value="Admin">Admin</option>
								</select>
							</div>
							<label className="flex items-center gap-3 cursor-pointer">
								<Toggle active={createForm.allow_docker_mount} onChange={() => setCreateForm((f) => ({ ...f, allow_docker_mount: !f.allow_docker_mount }))} />
								<span className="text-sm text-text/80">Allow Docker socket mount</span>
								<HelpTooltip content="Grants this user permission to enable Docker socket mount on their functions." placement="right" />
							</label>
						</div>
						{createError && <p className="text-sm text-red-400 mt-3">{createError}</p>}
						<div className="flex gap-2 justify-end mt-5">
							<button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-text/70 hover:text-text hover:bg-white/5 transition-colors">Cancel</button>
							<button
								onClick={handleCreate}
								disabled={createLoading || !createForm.displayName || !createForm.email || !createForm.password}
								className="px-4 py-2 bg-primary/20 border border-primary/30 hover:bg-primary/30 disabled:opacity-50 text-primary rounded-lg text-sm font-medium transition-all duration-200"
							>
								{createLoading ? "Creating…" : "Create"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Edit modal */}
			{editTarget && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div className="bg-surface-raised border border-white/[0.07] rounded-xl p-6 w-full max-w-md shadow-2xl">
						<h3 className="text-lg font-semibold text-primary mb-1">Edit User</h3>
						<p className="text-text/50 text-sm mb-4">{editTarget.email}</p>
						<div className="space-y-3">
							<div>
								<label className={labelCls}>Display Name</label>
								<input type="text" className={inputCls} value={editForm.displayName} onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))} />
							</div>
							<div>
								<label className={labelCls}>Role</label>
								<select className={inputCls} value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as "Admin" | "User" }))}>
									<option value="User">User</option>
									<option value="Admin">Admin</option>
								</select>
							</div>
							<div>
								<label className={labelCls}>New Password <span className="text-text/30">(leave blank to keep)</span></label>
								<input type="password" className={inputCls} placeholder="Min. 8 characters" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} />
							</div>
							<label className="flex items-center gap-3 cursor-pointer">
								<Toggle active={editForm.allow_docker_mount} onChange={() => setEditForm((f) => ({ ...f, allow_docker_mount: !f.allow_docker_mount }))} />
								<span className="text-sm text-text/80">Allow Docker socket mount</span>
								<HelpTooltip content="Grants this user permission to enable Docker socket mount on their functions." placement="right" />
							</label>
						</div>
						{editError && <p className="text-sm text-red-400 mt-3">{editError}</p>}
						<div className="flex gap-2 justify-end mt-5">
							<button onClick={() => setEditTarget(null)} className="px-4 py-2 rounded-lg text-sm text-text/70 hover:text-text hover:bg-white/5 transition-colors">Cancel</button>
							<button
								onClick={handleEdit}
								disabled={editLoading}
								className="px-4 py-2 bg-primary/20 border border-primary/30 hover:bg-primary/30 disabled:opacity-50 text-primary rounded-lg text-sm font-medium transition-all duration-200"
							>
								{editLoading ? "Saving…" : "Save Changes"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Delete modal */}
			{deleteTarget && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div className="bg-surface-raised border border-white/[0.07] rounded-xl p-6 w-full max-w-sm shadow-2xl">
						<h3 className="text-lg font-semibold text-red-400 mb-1">Delete User</h3>
						<p className="text-text/70 text-sm mb-1">This will permanently delete the account for:</p>
						<p className="text-primary font-medium mb-1">{deleteTarget.displayName}</p>
						<p className="text-text/50 text-sm mb-3">{deleteTarget.email}</p>
						<p className="text-text/60 text-xs mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
							This also deletes all their functions, files, namespaces, and data. Docker containers will be cleaned up. This action cannot be undone.
						</p>
						{deleteError && <p className="text-sm text-red-400 mb-3">{deleteError}</p>}
						<div className="flex gap-2 justify-end">
							<button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-sm text-text/70 hover:text-text hover:bg-white/5 transition-colors">Cancel</button>
							<button onClick={handleDelete} disabled={deleteLoading} className="px-4 py-2 bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 text-red-400 rounded-lg text-sm font-medium transition-all duration-200">
								{deleteLoading ? "Deleting…" : "Delete User"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// ─── Tab: Runtimes ──────────────────────────────────────────────────────────────

function RuntimesTab() {
	const [disabledImages, setDisabledImagesState] = useState<string[] | null>(null);
	const [savingImage, setSavingImage] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [lastSaved, setLastSaved] = useState<string | null>(null);

	useEffect(() => {
		getDisabledImages()
			.then((d) => { if (d.status === "OK") setDisabledImagesState(d.disabledImages); })
			.catch(() => setSaveError("Failed to load disabled images."));
	}, []);

	const toggleImage = async (image: string) => {
		if (disabledImages === null || savingImage !== null) return;
		const next = disabledImages.includes(image)
			? disabledImages.filter((i) => i !== image)
			: [...disabledImages, image];
		setDisabledImagesState(next);
		setSavingImage(image);
		setSaveError(null);
		try {
			const data = await apiSetDisabledImages(next);
			if (data.status === "OK") {
				setDisabledImagesState(data.disabledImages);
				setLastSaved(image);
				setTimeout(() => setLastSaved(null), 1500);
			} else {
				setDisabledImagesState(disabledImages);
				setSaveError("Failed to update.");
			}
		} catch {
			setDisabledImagesState(disabledImages);
			setSaveError("An error occurred.");
		} finally {
			setSavingImage(null);
		}
	};

	const families = [...new Set(ALL_IMAGES.map((i) => i.family))];

	return (
		<div>
			<div className="flex items-center justify-between mb-4">
				<p className="text-text/60 text-sm">Toggle which runtime images are available for new functions. Disabled images cannot be selected when creating or updating a function.</p>
			</div>

			{saveError && <p className="text-sm text-red-400 mb-3">{saveError}</p>}

			{disabledImages === null ? (
				<div className="space-y-2">
					{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
				</div>
			) : (
				<div className="space-y-5">
					{families.map((family) => (
						<div key={family}>
							<h3 className="text-sm font-semibold text-text/50 uppercase tracking-wider mb-2">{family}</h3>
							<div className="space-y-2">
								{ALL_IMAGES.filter((i) => i.family === family).map(({ image, deprecated }) => {
									const isDisabled = disabledImages.includes(image);
									const isSaving = savingImage === image;
									const justSaved = lastSaved === image;
									return (
										<div key={image} className={`${cardClass} flex items-center justify-between`}>
											<div className="flex items-center gap-3">
												<code className="text-sm font-mono text-text/80">{image}</code>
												{deprecated && <Badge variant="warning">Deprecated</Badge>}
												{isDisabled && <Badge variant="danger">Disabled</Badge>}
												{justSaved && <span className="text-xs text-green-400">Saved</span>}
												{isSaving && <span className="text-xs text-text/40">Saving…</span>}
											</div>
											<Toggle active={!isDisabled} onChange={() => toggleImage(image)} disabled={savingImage !== null} />
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ─── Tab: Statistics ────────────────────────────────────────────────────────────

function StatisticsTab() {
	const [stats, setStats] = useState<AdminStats | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const loadStats = useCallback(async () => {
		setLoading(true);
		setLoadError(null);
		try {
			const data = await adminGetStats();
			if (data.status === "OK") setStats(data.stats);
			else setLoadError(data.message);
		} catch {
			setLoadError("Failed to load statistics.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { loadStats(); }, [loadStats]);

	if (loading) {
		return (
			<div className="space-y-4">
				<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
					{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-20 rounded-xl w-full" />)}
				</div>
				<Skeleton className="h-40 w-full rounded-xl" />
			</div>
		);
	}

	if (loadError || !stats) {
		return (
			<div className="text-center py-12">
				<p className="text-red-400 text-sm mb-3">{loadError ?? "Failed to load stats."}</p>
				<button onClick={loadStats} className="px-3 py-1.5 bg-primary/20 border border-primary/30 hover:bg-primary/30 text-primary rounded-lg text-sm">Retry</button>
			</div>
		);
	}

	const statCards = [
		{ label: "Users", value: stats.overview.totalUsers, icon: "👤" },
		{ label: "Functions", value: stats.overview.totalFunctions, icon: "⚡" },
		{ label: "Namespaces", value: stats.overview.totalNamespaces, icon: "📁" },
		{ label: "Total Executions", value: stats.overview.totalExecutions.toLocaleString(), icon: "▶" },
		{ label: "RAM Allocated", value: `${stats.overview.totalRamAllocatedMb} MB`, icon: "💾" },
		{ label: "Avg Duration", value: `${stats.executions.avgDurationSeconds}s`, icon: "⏱" },
	];

	const successRate =
		stats.executions.successCount + stats.executions.failureCount > 0
			? Math.round((stats.executions.successCount / (stats.executions.successCount + stats.executions.failureCount)) * 100)
			: null;

	return (
		<div className="space-y-5">
			{/* Stat cards */}
			<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
				{statCards.map(({ label, value, icon }) => (
					<div key={label} className={`${cardClass} flex flex-col`}>
						<span className="text-xl mb-1">{icon}</span>
						<span className="text-2xl font-bold text-primary">{value}</span>
						<span className="text-xs text-text/50 mt-0.5">{label}</span>
					</div>
				))}
			</div>

			{/* Execution timeline */}
			<div className={cardClass}>
				<h3 className="text-base font-semibold text-primary mb-3">Execution Activity</h3>
				<div className="grid grid-cols-3 gap-3 text-center">
					{[
						{ label: "Last 24 h", value: stats.executions.last24h },
						{ label: "Last 7 d", value: stats.executions.last7d },
						{ label: "Last 30 d", value: stats.executions.last30d },
					].map(({ label, value }) => (
						<div key={label} className="bg-white/5 rounded-lg p-3">
							<p className="text-xl font-bold text-text">{value.toLocaleString()}</p>
							<p className="text-xs text-text/50 mt-0.5">{label}</p>
						</div>
					))}
				</div>
				{successRate !== null && (
					<div className="mt-3 flex items-center gap-3">
						<div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
							<div className="h-full bg-green-500/70 rounded-full" style={{ width: `${successRate}%` }} />
						</div>
						<span className="text-xs text-text/60 shrink-0">
							{successRate}% success rate ({stats.executions.successCount}/{stats.executions.successCount + stats.executions.failureCount} sampled)
						</span>
					</div>
				)}
			</div>

			{/* Top functions */}
			{stats.topFunctions.length > 0 && (
				<div className={cardClass}>
					<h3 className="text-base font-semibold text-primary mb-3">Top Functions by Execution Count</h3>
					<div className="space-y-2">
						{stats.topFunctions.map((fn, i) => (
							<div key={fn.id} className="flex items-center justify-between">
								<div className="flex items-center gap-3 min-w-0">
									<span className="text-text/30 text-xs w-5 text-right shrink-0">#{i + 1}</span>
									<span className="text-sm text-text truncate">{fn.name}</span>
									<Badge variant="default">{fn.image.split(":")[0].split("/").pop()}</Badge>
								</div>
								<span className="text-sm text-primary font-mono shrink-0 ml-3">{fn.executionCount.toLocaleString()}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Runtime breakdown */}
			{Object.keys(stats.imageBreakdown).length > 0 && (
				<div className={cardClass}>
					<h3 className="text-base font-semibold text-primary mb-3">Runtime Distribution</h3>
					<div className="space-y-2">
						{Object.entries(stats.imageBreakdown)
							.sort(([, a], [, b]) => b - a)
							.map(([image, count]) => {
								const total = Object.values(stats.imageBreakdown).reduce((s, v) => s + v, 0);
								const pct = Math.round((count / total) * 100);
								return (
									<div key={image} className="flex items-center gap-3">
										<code className="text-xs text-text/70 w-52 shrink-0 truncate">{image}</code>
										<div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
											<div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
										</div>
										<span className="text-xs text-text/50 w-10 text-right shrink-0">{count}</span>
									</div>
								);
							})}
					</div>
				</div>
			)}

			{/* Recent execution timings */}
			{stats.recentTimings.length > 0 && (
				<div className={cardClass}>
					<h3 className="text-base font-semibold text-primary mb-3">Recent Execution Timings</h3>
					<div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
						{stats.recentTimings.map((t, i) => (
							<div key={i} className="flex items-center justify-between text-sm">
								<span className="text-text/70 truncate flex-1">{t.functionName}</span>
								<div className="flex items-center gap-2 ml-3 shrink-0">
									<Badge variant={t.exitCode === 0 ? "success" : t.exitCode === null ? "default" : "danger"}>
										{t.exitCode === 0 ? "OK" : t.exitCode === null ? "?" : `Exit ${t.exitCode}`}
									</Badge>
									<span className="text-text/60 font-mono text-xs w-14 text-right">{t.totalSeconds.toFixed(2)}s</span>
								</div>
							</div>
						))}
					</div>
					<button onClick={loadStats} className="mt-3 text-xs text-text/40 hover:text-text/70 transition-colors">Refresh</button>
				</div>
			)}
		</div>
	);
}

// ─── Tab: Updates ──────────────────────────────────────────────────────────────

function UpdatesTab() {
	const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	const [checking, setChecking] = useState(false);
	const [checkError, setCheckError] = useState<string | null>(null);

	const [applying, setApplying] = useState(false);
	const [applyMessage, setApplyMessage] = useState<string | null>(null);
	const [applyError, setApplyError] = useState<string | null>(null);
	const [restarting, setRestarting] = useState(false);

	const [autoUpdateLoading, setAutoUpdateLoading] = useState(false);
	const updateBusy = updateStatus !== null && updateStatus.phase !== "idle";
	const updateError = updateStatus?.error;

	const load = useCallback(async (silent = false) => {
		if (!silent) setLoadError(null);
		try {
			const data = await getUpdateStatus();
			if (data.status === "OK") {
				setUpdateStatus(data);
				setLoadError(null);
			} else if (!silent) setLoadError("Failed to load update status.");
		} catch {
			if (!silent) setLoadError("Failed to load update status.");
		}
	}, []);

	useEffect(() => { load(); }, [load]);

	// Poll until the replacement process reports idle. The old process can
	// still answer /health during the helper delay, so health polling alone is
	// not sufficient to detect that the restart has actually completed.
	useEffect(() => {
		if (!restarting && !updateBusy) return;
		const id = setInterval(() => { void load(true); }, 2000);
		return () => clearInterval(id);
	}, [restarting, updateBusy, load]);

	useEffect(() => {
		if (restarting && updateStatus?.phase === "idle") {
			setRestarting(false);
			if (updateError) {
				setApplyError(updateError);
				setApplyMessage(null);
			} else {
				setApplyMessage("Service is back online with the new version.");
			}
		}
	}, [restarting, updateStatus?.phase, updateError]);

	const handleCheck = async () => {
		setChecking(true);
		setCheckError(null);
		setApplyMessage(null);
		try {
			const data = await triggerUpdateCheck();
			if (data.status === "OK") {
				await load();
			} else {
				setCheckError(data.message);
			}
		} catch {
			setCheckError("Update check failed.");
		} finally {
			setChecking(false);
		}
	};

	const handleApply = async () => {
		setApplying(true);
		setApplyError(null);
		setApplyMessage(null);
		try {
			const data = await triggerUpdateApply();
			if (data.status === "OK") {
				setApplyMessage(data.message + " Waiting for service to restart…");
				setRestarting(true);
				setUpdateStatus((prev) => prev ? {
					...prev,
					phase: "applying",
					updateAvailable: false,
					newImageId: null,
					error: null,
				} : prev);
			} else {
				setApplyError(data.message);
			}
		} catch {
			setApplyError("Failed to apply update.");
		} finally {
			setApplying(false);
		}
	};

	const toggleAutoUpdate = async () => {
		if (!updateStatus) return;
		setAutoUpdateLoading(true);
		try {
			const data = await apiSetAutoUpdate(!updateStatus.autoUpdateEnabled);
			if (data.status === "OK") setUpdateStatus((prev) => prev ? { ...prev, autoUpdateEnabled: data.autoUpdateEnabled } : prev);
		} catch {
			// ignore
		} finally {
			setAutoUpdateLoading(false);
		}
	};

	const isIdle = !updateStatus || updateStatus.phase === "idle";
	const isBusy = checking || applying || restarting || !isIdle;

	return (
		<div className="space-y-4">
			{loadError && <p className="text-sm text-red-400">{loadError}</p>}

			{/* Current state */}
			<div className={cardClass}>
				<h2 className="text-base font-semibold text-primary mb-1 flex items-center gap-2">
					Instance Image
					<HelpTooltip content="The Docker image currently running this SHSF instance." placement="right" />
				</h2>
				<p className="text-text/60 text-sm mb-3">Manage updates for the SHSF backend image.</p>

				{updateStatus === null ? (
					<Skeleton className="h-6 w-48" />
				) : (
					<div className="space-y-2">
						<div className="flex items-center gap-3 flex-wrap">
							<span className="text-xs text-text/50">Current image ID</span>
							<code className="font-mono text-xs text-text/80 bg-background/60 px-2 py-0.5 rounded">
								{updateStatus.currentImageId ?? "unknown"}
							</code>
							{updateStatus.updateAvailable === true && (
								<Badge variant="warning">Update available</Badge>
							)}
							{updateStatus.updateAvailable === false && (
								<Badge variant="success">Up to date</Badge>
							)}
						</div>

						{updateStatus.newImageId && (
							<div className="flex items-center gap-3">
								<span className="text-xs text-text/50">New image ID</span>
								<code className="font-mono text-xs text-green-400 bg-background/60 px-2 py-0.5 rounded">
									{updateStatus.newImageId}
								</code>
							</div>
						)}

						{updateStatus.lastCheckedAt && (
							<p className="text-xs text-text/40">
								Last checked: {new Date(updateStatus.lastCheckedAt).toLocaleString()}
							</p>
						)}

						{updateStatus.phase !== "idle" && (
							<div className="flex items-center gap-2 mt-2">
								<span className="inline-block h-2 w-2 rounded-full bg-primary/70 animate-pulse" />
								<span className="text-sm text-primary/80">
									{updateStatus.phase === "checking" && "Pulling image and checking for update…"}
									{updateStatus.phase === "applying" && "Recreating container…"}
								</span>
							</div>
						)}

						{restarting && (
							<div className="flex items-center gap-2 mt-2">
								<span className="inline-block h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
								<span className="text-sm text-yellow-400/80">Waiting for service to come back online…</span>
							</div>
						)}

						{updateStatus.error && (
							<p className="text-sm text-red-400 mt-1">{updateStatus.error}</p>
						)}

						{applyMessage && (
							<p className="text-sm text-green-400 mt-1">{applyMessage}</p>
						)}
					</div>
				)}
			</div>

			{/* Actions */}
			<div className={cardClass}>
				<h2 className="text-base font-semibold text-primary mb-1">Update Actions</h2>
				<p className="text-text/60 text-sm mb-4">
					"Check" compares the running image with the selected tag in the registry. "Update Now" pulls and force-recreates the Docker Compose project — the service will be briefly unavailable.
				</p>

				{checkError && <p className="text-sm text-red-400 mb-3">{checkError}</p>}
				{applyError && <p className="text-sm text-red-400 mb-3">{applyError}</p>}

				<div className="flex items-center gap-3 flex-wrap">
					<button
						onClick={handleCheck}
						disabled={isBusy}
						className="px-3 py-1.5 bg-primary/20 border border-primary/30 hover:bg-primary/30 disabled:opacity-50 text-primary rounded-lg text-sm font-medium transition-all duration-200"
					>
						{checking || (!isIdle && updateStatus?.phase === "checking") ? "Checking…" : "Check for Update"}
					</button>

					{updateStatus?.updateAvailable && (
						<button
							onClick={handleApply}
							disabled={isBusy}
							className="px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30 disabled:opacity-50 text-yellow-400 rounded-lg text-sm font-medium transition-all duration-200"
						>
							{applying || (!isIdle && updateStatus.phase === "applying") ? "Applying…" : "Update Now"}
						</button>
					)}
				</div>
			</div>

			{/* Auto-update toggle */}
			<div className={cardClass}>
				<h2 className="text-base font-semibold text-primary mb-1 flex items-center gap-2">
					Auto-Update
					<HelpTooltip content="When enabled, SHSF checks for a new image every 6 hours and force-recreates the Docker Compose project if one is found." placement="right" />
				</h2>
				<p className="text-text/60 text-sm mb-3">Automatically pull and apply new images every 6 hours.</p>
				{updateStatus === null ? (
					<Skeleton />
				) : (
					<div className="flex items-center gap-3">
						<Toggle
							active={updateStatus.autoUpdateEnabled}
							onChange={toggleAutoUpdate}
							disabled={autoUpdateLoading}
						/>
						<span className="text-text/80 text-sm">
							{updateStatus.autoUpdateEnabled ? "Enabled — updates apply automatically" : "Disabled — manual updates only"}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}

// ─── Main AdminPage ─────────────────────────────────────────────────────────────

type Tab = "overview" | "access" | "users" | "runtimes" | "stats" | "updates";

const TABS: { id: Tab; label: string; description: string }[] = [
	{ id: "overview", label: "Connectivity", description: "Link management & server secret" },
	{ id: "access", label: "Access Control", description: "Registration, guest & external access" },
	{ id: "users", label: "Users", description: "Create, edit, and delete user accounts" },
	{ id: "runtimes", label: "Runtimes", description: "Enable or disable runtime images" },
	{ id: "stats", label: "Statistics", description: "Execution stats and resource usage" },
	{ id: "updates", label: "Updates", description: "Check for and apply image updates" },
];

export const AdminPage = () => {
	const { user, loading } = useContext(UserContext);
	const [activeTab, setActiveTab] = useState<Tab>("overview");

	if (!loading && (!user || user.role !== "Admin")) {
		return <Navigate to="/" replace />;
	}

	return (
		<div className="max-w-4xl mx-auto py-10 px-4">
			<h1 className="text-3xl font-bold text-primary mb-1">Admin Panel</h1>
			<p className="text-text/50 text-sm mb-7">Instance-wide settings and management</p>

			{/* Tab bar */}
			<div className="flex gap-1 flex-wrap mb-7 border-b border-white/5 pb-0">
				{TABS.map(({ id, label }) => (
					<button
						key={id}
						onClick={() => setActiveTab(id)}
						className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-150 border-b-2 -mb-px ${
							activeTab === id
								? "text-primary border-primary bg-primary/5"
								: "text-text/50 border-transparent hover:text-text/80 hover:border-white/20"
						}`}
					>
						{label}
					</button>
				))}
			</div>

			{/* Tab content */}
			{activeTab === "overview" && <OverviewTab />}
			{activeTab === "access" && <AccessControlTab />}
			{activeTab === "users" && <UsersTab />}
			{activeTab === "runtimes" && <RuntimesTab />}
			{activeTab === "stats" && <StatisticsTab />}
			{activeTab === "updates" && <UpdatesTab />}
		</div>
	);
};
