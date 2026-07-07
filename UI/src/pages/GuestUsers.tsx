import { useEffect, useState } from "react";
import {
	listGuestUsers,
	GuestUser,
	getFunctionNamesForGuest,
} from "../services/backend.guest";
import CreateGuestModal from "../components/modals/guests/CreateGuestModal";
import UpdateGuestModal from "../components/modals/guests/UpdateGuestModal";
import DeleteGuestModal from "../components/modals/guests/DeleteGuestModal";
import ClearGuestSessionsModal from "../components/modals/guests/ClearGuestSessionsModal";
import { Icon } from "../components/ui/Icon";

export default function GuestUsersPage() {
	const [guests, setGuests] = useState<GuestUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedGuest, setSelectedGuest] = useState<GuestUser | null>(null);
	const [functionNames, setFunctionNames] = useState<string[]>([]);
	const [itemLoading, setItemLoading] = useState(false);
	const [itemError, setItemError] = useState("");
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showUpdateModal, setShowUpdateModal] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [showClearModal, setShowClearModal] = useState(false);
	const [targetGuest, setTargetGuest] = useState<GuestUser | null>(null);

	const fetchGuests = async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await listGuestUsers();
			const guestsArr =
				(res as any).guests ??
				((res as any).data && (res as any).data.guests) ??
				[];
			if (Array.isArray(guestsArr)) {
				setGuests(guestsArr);
				if (selectedGuest) {
					const updated = guestsArr.find((g: GuestUser) => g.id === selectedGuest.id);
					if (updated) setSelectedGuest(updated);
				}
			} else {
				setError((res as any).error || "Failed to load guests");
			}
		} catch { setError("Failed to load guests"); }
		finally { setLoading(false); }
	};

	const loadGuestDetails = async (guest: GuestUser) => {
		setItemLoading(true);
		setItemError("");
		try {
			if (guest.permittedFunctions && guest.permittedFunctions.length > 0) {
				const res = await getFunctionNamesForGuest(guest.permittedFunctions);
				if (res.status === "OK") {
					let names: string[] = [];
					if (Array.isArray((res as any).data)) names = (res as any).data;
					else if ((res as any).data && Array.isArray((res as any).data.data)) names = (res as any).data.data;
					setFunctionNames(names);
				} else {
					setItemError("Failed to load permitted functions");
				}
			} else {
				setFunctionNames([]);
			}
		} catch { setItemError("Failed to load guest details"); }
		finally { setItemLoading(false); }
	};

	useEffect(() => { fetchGuests(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
	useEffect(() => {
		if (selectedGuest) loadGuestDetails(selectedGuest);
		else setFunctionNames([]);
	}, [selectedGuest]);

	const btnSecondary = "px-3 py-1.5 border border-white/[0.07] text-text/70 text-sm font-medium rounded-lg hover:bg-surface-raised hover:text-text hover:border-primary/20 transition-colors";
	const btnPrimary = "px-3 py-1.5 bg-primary text-background text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors";

	return (
		<div>
			{selectedGuest ? (
				<>
					{/* Guest detail */}
					<div className="flex items-center gap-3 mb-6">
						<button onClick={() => setSelectedGuest(null)} className="p-1.5 text-muted hover:text-text hover:bg-surface rounded-lg transition-colors">
							<Icon name="chevron-left" className="w-4 h-4" />
						</button>
						<div className="flex-1">
							<h1 className="text-2xl font-semibold text-text">{selectedGuest.displayName}</h1>
							<p className="text-sm text-muted mt-0.5">{selectedGuest.email}</p>
						</div>
						<div className="flex gap-2">
							<button className={btnSecondary} onClick={() => { setTargetGuest(selectedGuest); setShowClearModal(true); }}>
								Clear Sessions
							</button>
							<button className={btnPrimary} onClick={() => { setTargetGuest(selectedGuest); setShowUpdateModal(true); }}>
								Edit
							</button>
						</div>
					</div>

					<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
						<Stat label="Created" value={new Date(selectedGuest.createdAt).toLocaleDateString()} />
						<Stat label="Active Sessions" value={String(selectedGuest.activeSessions ?? 0)} />
						<Stat label="Permitted Functions" value={String(selectedGuest.permittedFunctions?.length ?? 0)} />
					</div>

					<div className="bg-surface border border-white/[0.07] rounded-xl">
						<div className="px-5 py-3 border-b border-white/[0.07]">
							<h2 className="text-sm font-semibold text-text">Permitted Functions</h2>
						</div>
						{itemLoading ? (
							<div className="flex justify-center py-10">
								<div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
							</div>
						) : itemError ? (
							<p className="px-5 py-4 text-sm text-red-400">{itemError}</p>
						) : !selectedGuest.permittedFunctions || selectedGuest.permittedFunctions.length === 0 ? (
							<p className="px-5 py-8 text-sm text-muted text-center">No functions assigned.</p>
						) : (
							<ul className="divide-y divide-white/[0.04]">
								{selectedGuest.permittedFunctions.map((fnId, idx) => (
									<li key={fnId}>
										<a
											href={`/functions/${fnId}?preopen=guests`}
											className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.03] transition-colors group"
										>
											<span className="text-sm font-medium text-text/85 group-hover:text-primary transition-colors">
												{functionNames[idx] || `Function #${fnId}`}
											</span>
											<Icon name="arrow-top-right-on-square" className="w-3.5 h-3.5 text-muted" />
										</a>
									</li>
								))}
							</ul>
						)}
					</div>
					<p className="text-xs text-muted/50 mt-3">
						To manage function permissions, visit the specific function's configuration page.
					</p>
				</>
			) : (
				<>
					{/* Guest list */}
					<div className="flex items-center justify-between mb-6">
						<div>
							<h1 className="text-2xl font-semibold text-text">Guest Users</h1>
							<p className="text-sm text-muted mt-0.5">Limited accounts with controlled access to specific functions</p>
						</div>
						<button className={btnPrimary} onClick={() => setShowCreateModal(true)}>
							<span className="flex items-center gap-1.5">
								<Icon name="plus" className="w-4 h-4" />
								New Guest
							</span>
						</button>
					</div>

					<div className="bg-surface border border-white/[0.07] rounded-xl">
						{loading ? (
							<div className="flex justify-center py-12">
								<div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
							</div>
						) : error ? (
							<p className="px-5 py-4 text-sm text-red-400">{error}</p>
						) : guests.length === 0 ? (
							<div className="flex flex-col items-center py-16 text-center">
								<div className="w-10 h-10 rounded-xl bg-background border border-white/[0.07] flex items-center justify-center mb-3">
									<Icon name="users" className="w-5 h-5 text-primary/40" />
								</div>
								<p className="text-sm text-muted">No guest users yet.</p>
							</div>
						) : (
							<ul className="divide-y divide-white/[0.04]">
								{guests.map((guest) => (
									<li key={guest.id}>
										<button
											className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors group text-left"
											onClick={() => setSelectedGuest(guest)}
										>
											<div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
												{guest.displayName?.[0]?.toUpperCase() ?? "?"}
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium text-text group-hover:text-primary transition-colors">{guest.displayName}</p>
												<p className="text-xs text-muted truncate">{guest.email}</p>
											</div>
											<span className="text-xs text-muted/50">{guest.permittedFunctions?.length ?? 0} fn</span>
											<button
												className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
												title="Delete"
												onClick={(e) => { e.stopPropagation(); setTargetGuest(guest); setShowDeleteModal(true); }}
											>
												<Icon name="trash" className="w-3.5 h-3.5" />
											</button>
											<Icon name="chevron-right" className="w-4 h-4 text-muted/40 shrink-0" />
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				</>
			)}

			<CreateGuestModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onSuccess={fetchGuests} />
			<UpdateGuestModal isOpen={showUpdateModal} onClose={() => { setShowUpdateModal(false); setTargetGuest(null); }} onSuccess={fetchGuests} guest={targetGuest} />
			<DeleteGuestModal
				isOpen={showDeleteModal}
				onClose={() => { setShowDeleteModal(false); setTargetGuest(null); }}
				onSuccess={() => { if (selectedGuest?.id === targetGuest?.id) setSelectedGuest(null); fetchGuests(); }}
				guest={targetGuest}
			/>
			<ClearGuestSessionsModal isOpen={showClearModal} onClose={() => setShowClearModal(false)} onSuccess={fetchGuests} guest={targetGuest} />
		</div>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="bg-surface border border-white/[0.07] rounded-xl px-4 py-3">
			<p className="text-xs text-muted uppercase tracking-wider mb-1">{label}</p>
			<p className="text-sm font-semibold text-text">{value}</p>
		</div>
	);
}
