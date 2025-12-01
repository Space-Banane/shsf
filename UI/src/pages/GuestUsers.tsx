import { useEffect, useState } from "react";
import {
	listGuestUsers,
	createGuestUser,
	updateGuestUser,
	deleteGuestUser,
	assignFunctionToGuest,
	unassignFunctionFromGuest,
	GuestUser,
	getFunctionNamesForGuest,
	clearGuestSessions,
} from "../services/backend.guest";
import { ActionButton } from "../components/buttons/ActionButton";
import { MotionButton } from "../components/buttons/MotionButtons";

function GuestUserCard({
	guest,
	functionNames,
	deleteLoading,
	deleteId,
	clearSessionsLoading,
	clearSessionsError,
	deleteError,
	onEdit,
	onDelete,
	onClearSessions,
}: {
	guest: GuestUser;
	functionNames: Record<number, string[]>;
	deleteLoading: boolean;
	deleteId: number | null;
	clearSessionsLoading: number | null;
	clearSessionsError: string | null;
	deleteError: string | null;
	onEdit: (g: GuestUser) => void;
	onDelete: (id: number) => void;
	onClearSessions: (id: number) => void;
}) {
	return (
		<div
			key={guest.id}
			className="rounded-xl overflow-hidden shadow-lg border border-primary/30 bg-gradient-to-br from-blue-950/60 via-purple-950/50 to-indigo-950/60"
		>
			{/* Card header */}
			<div className="flex items-center gap-3 px-5 py-3 border-b border-primary/20">
				<div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500 flex items-center justify-center text-2xl shadow">
					<span role="img" aria-label="guest">
						👤
					</span>
				</div>
				<div className="flex-1">
					<div className="font-bold text-primary text-lg">{guest.displayName}</div>
					<div className="text-xs text-text/60">{guest.email}</div>
				</div>
				<div className="flex gap-2">
					<ActionButton
						icon="✏️"
						label="Edit"
						variant="secondary"
						onClick={() => onEdit(guest)}
					/>
					<ActionButton
						icon="🗑️"
						label={deleteLoading && deleteId === guest.id ? "Deleting..." : "Delete"}
						variant="delete"
						onClick={() => onDelete(guest.id)}
						disabled={deleteLoading && deleteId === guest.id}
					/>
					<ActionButton
						icon="🧹"
						label={
							clearSessionsLoading === guest.id ? "Clearing..." : "Clear Sessions"
						}
						variant="secondary"
						onClick={() => onClearSessions(guest.id)}
						disabled={clearSessionsLoading === guest.id}
					/>
				</div>
			</div>
			{/* Card body */}
			<div className="px-5 py-4 flex flex-col gap-2 bg-background/70">
				<div className="flex flex-col md:flex-row md:gap-8 gap-2">
					<div>
						<div className="text-xs text-text/50">
							Created: {new Date(guest.createdAt).toLocaleString()}
						</div>
						<div className="text-xs text-text/60 mt-1">
							Active Sessions:{" "}
							<span className="font-semibold">{guest.activeSessions ?? 0}</span>
						</div>
					</div>
					<div>
						<div className="text-xs text-text/60">
							Permitted Functions:{" "}
							{guest.permittedFunctions && guest.permittedFunctions.length > 0 ? (
								<span className="font-semibold text-blue-400">
									{functionNames[guest.id] && functionNames[guest.id].length > 0
										? functionNames[guest.id].join(", ")
										: guest.permittedFunctions.join(", ")}
								</span>
							) : (
								<span className="text-text/40">None</span>
							)}
						</div>
					</div>
				</div>
				<div className="mt-2">
					<p className="text-sm text-text/60 italic">
						To unassign a guest from a Function, go to the Function's detail page.
					</p>
				</div>
				{deleteError && deleteId === guest.id && (
					<div className="text-red-400">{deleteError}</div>
				)}
				{clearSessionsError && (
					<div className="text-red-400">{clearSessionsError}</div>
				)}
			</div>
		</div>
	);
}

export default function GuestUsersPage() {
	const [guests, setGuests] = useState<GuestUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Create form state
	const [showCreate, setShowCreate] = useState(false);
	const [createName, setCreateName] = useState("");
	const [createEmail, setCreateEmail] = useState("");
	const [createPassword, setCreatePassword] = useState("");
	const [createLoading, setCreateLoading] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

	// Edit state
	const [editId, setEditId] = useState<number | null>(null);
	const [editName, setEditName] = useState("");
	const [editPassword, setEditPassword] = useState("");
	const [editLoading, setEditLoading] = useState(false);
	const [editError, setEditError] = useState<string | null>(null);

	// Delete state
	const [deleteId, setDeleteId] = useState<number | null>(null);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	// Clear sessions state
	const [clearSessionsLoading, setClearSessionsLoading] = useState<
		number | null
	>(null);
	const [clearSessionsError, setClearSessionsError] = useState<string | null>(
		null,
	);

	// Map of guestId to function names
	const [functionNames, setFunctionNames] = useState<Record<number, string[]>>(
		{},
	);

	// Fetch function names for all guests
	const fetchFunctionNames = async (guests: GuestUser[]) => {
		const fnMap: Record<number, string[]> = {};
		for (const g of guests) {
			if (g.permittedFunctions && g.permittedFunctions.length > 0) {
				const res = await getFunctionNamesForGuest(g.permittedFunctions);
				// Accept both { data: [...] } and { data: { data: [...] } }
				let names: string[] = [];
				if (res.status === "OK") {
					if (Array.isArray((res as any).data)) {
						names = (res as any).data;
					} else if ((res as any).data && Array.isArray((res as any).data.data)) {
						names = (res as any).data.data;
					}
				}
				fnMap[g.id] = names;
			} else {
				fnMap[g.id] = [];
			}
		}
		setFunctionNames(fnMap);
	};

	// Fetch guests and their function names
	const fetchGuests = async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await listGuestUsers();
			const guestsArr =
				(res as any).guests ??
				((res as any).data && (res as any).data.guests) ??
				[];
			if (res.guests && Array.isArray(guestsArr)) {
				setGuests(guestsArr);
				fetchFunctionNames(guestsArr);
			} else {
				setError(res.error || "Failed to load guests");
			}
		} catch {
			setError("Failed to load guests");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchGuests();
	}, []);

	// Create guest handler
	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setCreateLoading(true);
		setCreateError(null);
		try {
			const res = await createGuestUser({
				displayName: createName,
				email: createEmail,
				password: createPassword,
			});
			if (res.status === "OK") {
				setShowCreate(false);
				setCreateName("");
				setCreateEmail("");
				setCreatePassword("");
				fetchGuests();
			} else {
				setCreateError((res as any).message || "Failed to create guest");
			}
		} catch {
			setCreateError("Failed to create guest");
		} finally {
			setCreateLoading(false);
		}
	};

	// Edit guest handler
	const handleEdit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (editId == null) return;
		setEditLoading(true);
		setEditError(null);
		try {
			const res = await updateGuestUser({
				id: editId,
				displayName: editName,
				password: editPassword || undefined,
			});
			if (res.status === "OK") {
				setEditId(null);
				setEditName("");
				setEditPassword("");
				fetchGuests();
			} else {
				setEditError((res as any).message || "Failed to update guest");
			}
		} catch {
			setEditError("Failed to update guest");
		} finally {
			setEditLoading(false);
		}
	};

	// Delete guest handler
	const handleDelete = async (id: number) => {
		setDeleteId(id);
		setDeleteLoading(true);
		setDeleteError(null);
		try {
			const res = await deleteGuestUser(id);
			if (res.status === "OK") {
				fetchGuests();
			} else {
				setDeleteError((res as any).message || "Failed to delete guest");
			}
		} catch {
			setDeleteError("Failed to delete guest");
		} finally {
			setDeleteId(null);
			setDeleteLoading(false);
		}
	};

	// Assign/unassign function handlers (simple demo, expects functionId input)
	const handleAssignFunction = async (guestId: number, functionId: number) => {
		await assignFunctionToGuest(guestId, functionId);
		fetchGuests();
	};
	const handleUnassignFunction = async (guestId: number, functionId: number) => {
		await unassignFunctionFromGuest(guestId, functionId);
		fetchGuests();
	};

	// Handler for clearing sessions
	const handleClearSessions = async (guestId: number) => {
		setClearSessionsLoading(guestId);
		setClearSessionsError(null);
		try {
			const res = await clearGuestSessions(guestId);
			if (res.status === "OK") {
				fetchGuests();
			} else {
				setClearSessionsError((res as any).message || "Failed to clear sessions");
			}
		} catch {
			setClearSessionsError("Failed to clear sessions");
		} finally {
			setClearSessionsLoading(null);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-[#181e2a] via-[#191726] to-[#1a1a22]">
			<div className="bg-gradient-to-r from-blue-900/70 via-purple-900/60 to-indigo-900/70 border-b border-primary/20 py-12 mb-10 shadow-lg">
				<div className="max-w-3xl mx-auto px-4 flex flex-col items-center text-center">
					<div className="flex items-center justify-center mb-4">
						<div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500 flex items-center justify-center shadow-lg border-4 border-background/40 text-4xl">
							<span role="img" aria-label="guest">
								👤
							</span>
						</div>
					</div>
					<h1 className="text-4xl md:text-5xl font-extrabold text-primary mb-2 drop-shadow">
						Guest Users
					</h1>
					<p className="text-lg text-text/70 max-w-xl mx-auto">
						Manage guest users for your account. Create, update, delete, and assign
						function permissions.
					</p>
				</div>
			</div>
			<div className="max-w-3xl mx-auto px-4 pb-16">
				<div className="mb-8">
					<ActionButton
						icon={showCreate ? "✖️" : "➕"}
						label={showCreate ? "Cancel" : "Add Guest User"}
						variant="primary"
						onClick={() => setShowCreate((v) => !v)}
					/>
				</div>
				{showCreate && (
					<form
						onSubmit={handleCreate}
						className="bg-gradient-to-br from-blue-900/30 via-purple-900/30 to-indigo-900/30 border border-primary/30 rounded-2xl p-6 mb-8 flex flex-col gap-4 shadow-lg"
					>
						<h2 className="text-xl font-bold text-primary mb-2">Create Guest User</h2>
						<input
							type="text"
							required
							minLength={2}
							maxLength={128}
							placeholder="Display Name"
							className="px-4 py-2 border border-primary/20 rounded-lg bg-background/80 text-text"
							value={createName}
							onChange={(e) => setCreateName(e.target.value)}
							disabled={createLoading}
						/>
						<input
							type="email"
							required
							placeholder="Email"
							className="px-4 py-2 border border-primary/20 rounded-lg bg-background/80 text-text"
							value={createEmail}
							onChange={(e) => setCreateEmail(e.target.value)}
							disabled={createLoading}
						/>
						<input
							type="password"
							required
							minLength={8}
							maxLength={256}
							placeholder="Password (min 8 chars)"
							className="px-4 py-2 border border-primary/20 rounded-lg bg-background/80 text-text"
							value={createPassword}
							onChange={(e) => setCreatePassword(e.target.value)}
							disabled={createLoading}
						/>
						<MotionButton
							label={createLoading ? "Creating..." : "Create"}
							variant="default"
							onClick={() => {}}
							size="sm"
						/>
						{createError && <div className="text-red-400">{createError}</div>}
					</form>
				)}
				<h2 className="text-xl font-bold text-primary mb-4">Guest Users</h2>
				{loading ? (
					<div className="text-text/60">Loading...</div>
				) : error ? (
					<div className="text-red-400">{error}</div>
				) : guests.length === 0 ? (
					<div className="text-text/60">No guest users found.</div>
				) : (
					<div className="space-y-6">
						{guests.map((g) =>
							editId === g.id ? (
								<form
									key={g.id}
									onSubmit={handleEdit}
									className="bg-background/60 border border-primary/20 rounded-lg p-4 flex flex-col gap-2"
								>
									<div className="flex flex-col md:flex-row gap-2 text-text">
										<input
											type="text"
											required
											minLength={2}
											maxLength={128}
											value={editName}
											onChange={(e) => setEditName(e.target.value)}
											className="flex-1 px-2 py-1 rounded border border-primary/20 bg-background/80"
											placeholder="Display Name"
											disabled={editLoading}
										/>
										<input
											type="password"
											minLength={8}
											maxLength={256}
											value={editPassword}
											onChange={(e) => setEditPassword(e.target.value)}
											className="flex-1 px-2 py-1 rounded border border-primary/20 bg-background/80"
											placeholder="New Password (optional)"
											disabled={editLoading}
										/>
									</div>
									<div className="flex gap-2 mt-2">
										<ActionButton
											icon="💾"
											label={editLoading ? "Saving..." : "Save"}
											variant="primary"
											onClick={() => {}}
											disabled={editLoading}
										/>
										<ActionButton
											icon="✖️"
											label="Cancel"
											variant="secondary"
											onClick={() => setEditId(null)}
											disabled={editLoading}
										/>
									</div>
									{editError && <div className="text-red-400">{editError}</div>}
								</form>
							) : (
								<GuestUserCard
									key={g.id}
									guest={g}
									functionNames={functionNames}
									deleteLoading={deleteLoading}
									deleteId={deleteId}
									clearSessionsLoading={clearSessionsLoading}
									clearSessionsError={clearSessionsError}
									deleteError={deleteError}
									onEdit={(guest) => {
										setEditId(guest.id);
										setEditName(guest.displayName);
										setEditPassword("");
									}}
									onDelete={handleDelete}
									onClearSessions={handleClearSessions}
								/>
							),
						)}
					</div>
				)}
			</div>
		</div>
	);
}
