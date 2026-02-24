import { useContext, useState, useEffect } from "react";
import { UserContext } from "../App";
import { Navigate } from "react-router-dom";
import { BASE_URL } from "..";
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

export const AdminPage = () => {
	const { user, loading } = useContext(UserContext);
	const [secret, setSecret] = useState<string | null>(null);
	const [secretLoading, setSecretLoading] = useState(false);
	const [secretError, setSecretError] = useState<string | null>(null);
	const [showModal, setShowModal] = useState(false);
	const [password, setPassword] = useState("");

	const [linkLocked, setLinkLocked] = useState<boolean | null>(null);
	const [linkLockLoading, setLinkLockLoading] = useState(false);
	const [linkLockError, setLinkLockError] = useState<string | null>(null);

	const [registrationDisabled, setRegistrationDisabledState] = useState<boolean | null>(null);
	const [registrationLoading, setRegistrationLoading] = useState(false);
	const [registrationError, setRegistrationError] = useState<string | null>(null);

	// Link status state
	const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null);
	const [linkable, setLinkable] = useState<boolean | null>(null);
	const [instanceUUID, setInstanceUUID] = useState<string | null>(null);
	const [linkStatusLoading, setLinkStatusLoading] = useState(false);
	const [linkStatusError, setLinkStatusError] = useState<string | null>(null);

	// Unlink
	const [unlinkLoading, setUnlinkLoading] = useState(false);
	const [unlinkError, setUnlinkError] = useState<string | null>(null);

	const refreshLinkStatus = async () => {
		setLinkStatusLoading(true);
		try {
			const [statusRes, linkableRes, uuidRes] = await Promise.all([
				getLinkStatus(),
				getLinkable(),
				getInstanceUUID(),
			]);
			if (statusRes.status === "OK") setLinkStatus(statusRes as LinkStatus);
			if (linkableRes.status === "OK") setLinkable(linkableRes.linkable);
			if (uuidRes.status === "OK") setInstanceUUID(uuidRes.uuid);
		} catch {
			setLinkStatusError("Failed to load link status.");
		} finally {
			setLinkStatusLoading(false);
		}
	};

	useEffect(() => {
		if (!user || user.role !== "Admin") return;
		getLinkLock()
			.then((d) => { if (d.status === "OK") setLinkLocked(d.locked); })
			.catch(() => setLinkLockError("Failed to load link lock state."));
		getRegistrationDisabled()
			.then((d) => { if (d.status === "OK") setRegistrationDisabledState(d.disabled); })
			.catch(() => setRegistrationError("Failed to load registration state."));
		refreshLinkStatus();
	}, [user]);

	if (!loading && (!user || user.role !== "Admin")) {
		return <Navigate to="/" replace />;
	}

	const toggleLinkLock = async () => {
		if (linkLocked === null) return;
		setLinkLockLoading(true);
		setLinkLockError(null);
		try {
			const data = await setLinkLock(!linkLocked);
			if (data.status === "OK") {
				setLinkLocked(data.locked);
				// Also refresh linkable since lock state affects it
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

	const toggleRegistration = async () => {
		if (registrationDisabled === null) return;
		setRegistrationLoading(true);
		setRegistrationError(null);
		try {
			const data = await apiSetRegistrationDisabled(!registrationDisabled);
			if (data.status === "OK") {
				setRegistrationDisabledState(data.disabled);
			} else {
				setRegistrationError("Failed to update.");
			}
		} catch {
			setRegistrationError("An error occurred.");
		} finally {
			setRegistrationLoading(false);
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

	const openModal = () => {
		setPassword("");
		setSecretError(null);
		setShowModal(true);
	};

	const closeModal = () => {
		setShowModal(false);
		setPassword("");
		setSecretError(null);
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
				closeModal();
			} else {
				setSecretError(data.message ?? "Failed to fetch secret.");
			}
		} catch {
			setSecretError("An error occurred while fetching the secret.");
		} finally {
			setSecretLoading(false);
		}
	};

	return (
		<div className="max-w-3xl mx-auto py-10">
			<h1 className="text-3xl font-bold text-primary mb-4">Admin Panel</h1>
			<p className="text-text text-lg mb-2">Pretty empty here!</p>
			<p className="text-text/70 mb-8">There is more on the way, i promise!</p>

			{/* Link Lock */}
			<div className="bg-[#282844] border border-purple-500/20 rounded-lg p-6 mb-4">
				<h2 className="text-xl font-semibold text-primary mb-2">Link Lock</h2>
				<p className="text-text/70 text-sm mb-4">
					When enabled, prevents this instance from being linked to a global account.
				</p>
				{linkLocked === null ? (
					<div className="animate-pulse h-8 w-24 rounded-md bg-[#383863]" />
				) : (
					<div className="flex items-center gap-4">
						<button
							onClick={toggleLinkLock}
							disabled={linkLockLoading}
							className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
								linkLocked ? "bg-blue-600" : "bg-[#383863]"
							}`}
						>
							<span
								className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
									linkLocked ? "translate-x-6" : "translate-x-1"
								}`}
							/>
						</button>
						<span className="text-text text-sm">
							{linkLocked ? "Locked — linking is disabled" : "Unlocked — linking is allowed"}
						</span>
					</div>
				)}
				{linkLockError && <p className="mt-3 text-sm text-red-400">{linkLockError}</p>}
			</div>

			{/* Link Status */}
			<div className="bg-[#282844] border border-purple-500/20 rounded-lg p-6 mb-4">
				<div className="flex items-center justify-between mb-2">
					<h2 className="text-xl font-semibold text-primary">Link Status</h2>
					<button
						onClick={refreshLinkStatus}
						disabled={linkStatusLoading}
						className="text-xs text-text/50 hover:text-text transition-colors disabled:opacity-40"
					>
						{linkStatusLoading ? "Refreshing…" : "Refresh"}
					</button>
				</div>
				<p className="text-text/70 text-sm mb-4">
					Manage the remote-access link for this instance. Only one user may be linked at a time.
				</p>

				{linkStatus === null ? (
					<div className="animate-pulse h-8 w-40 rounded-md bg-[#383863]" />
				) : linkStatus.linked ? (
					/* ── Currently linked ── */
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<span className="inline-block h-2 w-2 rounded-full bg-green-400" />
							<span className="text-text text-sm font-medium">Linked</span>
						</div>
						<p className="text-text/70 text-sm">
							Linked to:{" "}
							<span className="text-primary font-mono">{linkStatus.global_user_email}</span>
							{" "}via SHSF.DEV
						</p>
						<button
							onClick={handleUnlink}
							disabled={unlinkLoading}
							className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition duration-150"
						>
							{unlinkLoading ? "Unlinking…" : "Unlink"}
						</button>
						{unlinkError && <p className="text-sm text-red-400">{unlinkError}</p>}
					</div>
				) : (
					/* ── Not linked ── */
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<span className="inline-block h-2 w-2 rounded-full bg-text/30" />
							<span className="text-text/60 text-sm">Not linked</span>
						</div>
						<p className="text-xs text-text/50">
							{linkable
								? "This instance is open for external linking."
								: "Linking is currently disabled (link lock is on). Disable the lock above to allow external linking."}
						</p>
					</div>
				)}
				{linkStatusError && <p className="mt-3 text-sm text-red-400">{linkStatusError}</p>}
			</div>

			{/* Disable Registration */}
			<div className="bg-[#282844] border border-purple-500/20 rounded-lg p-6 mb-4">
				<h2 className="text-xl font-semibold text-primary mb-2">Disable Registration</h2>
				<p className="text-text/70 text-sm mb-4">
					When enabled, prevents new users from registering an account on this instance.
				</p>
				{registrationDisabled === null ? (
					<div className="animate-pulse h-8 w-24 rounded-md bg-[#383863]" />
				) : (
					<div className="flex items-center gap-4">
						<button
							onClick={toggleRegistration}
							disabled={registrationLoading}
							className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
								registrationDisabled ? "bg-blue-600" : "bg-[#383863]"
							}`}
						>
							<span
								className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
									registrationDisabled ? "translate-x-6" : "translate-x-1"
								}`}
							/>
						</button>
						<span className="text-text text-sm">
							{registrationDisabled ? "Disabled — registration is blocked" : "Enabled — registration is open"}
						</span>
					</div>
				)}
				{registrationError && <p className="mt-3 text-sm text-red-400">{registrationError}</p>}
			</div>

			{/* Server Secret */}
			<div className="bg-[#282844] border border-purple-500/20 rounded-lg p-6">
				<h2 className="text-xl font-semibold text-primary mb-2">Server Secret</h2>
				<p className="text-text/70 text-sm mb-4">
					The server's configured secret value. Enter your password to reveal it.
				</p>

				{secret !== null ? (
					<div className="flex items-center gap-3">
						<code className="flex-1 bg-[#1a1a2e] text-green-400 font-mono text-sm px-4 py-2 rounded-md border border-purple-500/20 break-all">
							{secret}
						</code>
						<button
							onClick={() => setSecret(null)}
							className="text-sm text-text/50 hover:text-text transition-colors"
						>
							Hide
						</button>
					</div>
				) : (
					<button
						onClick={openModal}
						className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition duration-150 border border-purple-500/20"
					>
						Reveal Secret
					</button>
				)}
			</div>

			{/* Password Modal */}
			{showModal && (
				<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
					<div className="bg-[#282844] border border-purple-500/20 rounded-lg p-6 w-full max-w-sm shadow-xl">
						<h3 className="text-lg font-semibold text-primary mb-1">Confirm Identity</h3>
						<p className="text-text/60 text-sm mb-4">Enter your password to reveal the server secret.</p>

						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && !secretLoading && fetchSecret()}
							placeholder="Your password"
							className="w-full bg-[#1a1a2e] border border-purple-500/20 rounded-md px-3 py-2 text-text text-sm outline-none focus:border-blue-500 mb-3"
							autoFocus
						/>

						{secretError && (
							<p className="text-sm text-red-400 mb-3">{secretError}</p>
						)}

						<div className="flex gap-2 justify-end">
							<button
								onClick={closeModal}
								className="px-4 py-2 rounded-md text-sm text-text/70 hover:text-text hover:bg-[#383863] transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={fetchSecret}
								disabled={secretLoading || password.length === 0}
								className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition duration-150"
							>
								{secretLoading ? "Verifying..." : "Confirm"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
