import React, { useEffect, useState } from "react";
import Modal from "../Modal";
import { cancelBtnClass } from "../Modal";
import {
	assignFunctionToGuest,
	GuestUser,
	listFunctionGuests,
	listGuestUsers,
	unassignFunctionFromGuest,
} from "../../../services/backend.guest";

interface GuestManagementProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: () => void;
	functionId: number | null;
}

function GuestManagement({ isOpen, onClose, onSuccess, functionId }: GuestManagementProps) {
	const [allUsers, setAllUsers] = useState<GuestUser[]>([]);
	const [guestUserIds, setGuestUserIds] = useState<number[]>([]);
	const [guestsLoading, setGuestsLoading] = useState(false);
	const [guestsError, setGuestsError] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen && functionId) {
			setGuestsLoading(true);
			setGuestsError(null);
			const fetchUsers = async () => {
				try {
					const [usersRes, guestsRes] = await Promise.all([
						listGuestUsers(),
						listFunctionGuests(functionId),
					]);
					if ("error" in usersRes) setGuestsError("Failed to load users");
					else setAllUsers(usersRes.guests);
					if ("error" in guestsRes) setGuestsError("Failed to load guest users");
					else setGuestUserIds(guestsRes.guests.map((g) => g.id));
				} catch {
					setGuestsError("Failed to load guest users");
				} finally {
					setGuestsLoading(false);
				}
			};
			fetchUsers();
		}
	}, [isOpen, functionId]);

	const handleToggleGuest = async (userId: number, checked: boolean) => {
		if (!functionId) return;
		setGuestsLoading(true);
		setGuestsError(null);
		try {
			if (checked) {
				const res = await assignFunctionToGuest(userId, functionId);
				if (res.status === "OK") setGuestUserIds((ids) => [...ids, userId]);
				else setGuestsError("Failed to add guest");
			} else {
				const res = await unassignFunctionFromGuest(userId, functionId);
				if (res.status === "OK") setGuestUserIds((ids) => ids.filter((id) => id !== userId));
				else setGuestsError("Failed to remove guest");
			}
		} catch {
			setGuestsError("Failed to update guest assignment");
		} finally {
			setGuestsLoading(false);
		}
	};

	const handleClose = () => { if (!guestsLoading) { onClose(); setGuestsError(null); } };

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Manage Guest Users"
			maxWidth="md"
			isLoading={guestsLoading}
		>
			<div className="space-y-4">
				{guestsError && (
					<p className="text-xs text-red-400">{guestsError}</p>
				)}
				<div className="space-y-1.5 max-h-52 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
					{allUsers.length === 0 ? (
						<p className="text-sm text-muted">No guest users found.</p>
					) : (
						allUsers.map((user) => (
							<label
								key={user.id}
								className="flex items-center gap-3 px-3 py-2.5 bg-background/40 border border-white/[0.07] rounded-lg cursor-pointer hover:bg-background/60 transition-colors"
							>
								<input
									type="checkbox"
									checked={guestUserIds.includes(user.id)}
									onChange={(e) => handleToggleGuest(user.id, e.target.checked)}
									disabled={guestsLoading}
									className="accent-primary w-4 h-4"
								/>
								<span className="text-sm text-text">
									{user.email || user.displayName || `User #${user.id}`}
								</span>
							</label>
						))
					)}
				</div>
				<div className="border-t border-white/[0.07] pt-3 space-y-1">
					<p className="text-xs text-muted">
						Assign users as guests to allow them to invoke this function.
					</p>
					<p className="text-xs text-muted">
						Once assigned, every web execution will require authentication.
					</p>
					<button
						onClick={() => (window.location.href = "/guest-users")}
						className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors"
					>
						Configure Guest Access →
					</button>
				</div>
				<div className="flex justify-end pt-2">
					<button onClick={handleClose} className={cancelBtnClass} disabled={guestsLoading}>
						Close
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default GuestManagement;
