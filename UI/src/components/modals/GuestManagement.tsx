import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import {
	assignFunctionToGuest,
	GuestUser,
	listFunctionGuests,
	listGuestUsers,
	unassignFunctionFromGuest,
} from "../../services/backend.guest";
import { ActionButton } from "../buttons/ActionButton";

interface GuestManagementProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: () => void;
	functionId: number | null;
}

function GuestManagement({
	isOpen,
	onClose,
	onSuccess,
	functionId,
}: GuestManagementProps) {
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

					if ("error" in usersRes) {
						setGuestsError("Failed to load users");
					} else {
						setAllUsers(usersRes.guests);
					}
					if ("error" in guestsRes) {
						setGuestsError("Failed to load guest users");
					} else {
						const guestIds = guestsRes.guests.map((guest) => guest.id);
						setGuestUserIds(guestIds);
					}
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
				if (res.status === "OK")
					setGuestUserIds((ids) => ids.filter((id) => id !== userId));
				else setGuestsError("Failed to remove guest");
			}
		} catch {
			setGuestsError("Failed to update guest assignment");
		} finally {
			setGuestsLoading(false);
		}
	};

	const handleClose = () => {
		if (!guestsLoading) {
			onClose();
			setGuestsError(null);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Manage Guest Users"
			maxWidth="md"
			isLoading={guestsLoading}
		>
			<div className="space-y-4">
				{guestsError && <p className="text-xs text-red-400 mb-2">{guestsError}</p>}
				{guestsLoading ? (
					<p className="text-xs text-gray-400">Loading users...</p>
				) : (
					<div className="space-y-2 max-h-48 overflow-y-auto">
						{allUsers.length === 0 ? (
							<p className="text-xs text-gray-400">No users found.</p>
						) : (
							allUsers.map((user) => (
								<label
									key={user.id}
									className="flex items-center gap-2 text-sm text-gray-200"
								>
									<input
										type="checkbox"
										checked={guestUserIds.includes(user.id)}
										onChange={(e) => handleToggleGuest(user.id, e.target.checked)}
										disabled={guestsLoading}
										className="accent-blue-500"
									/>
									<span>{user.email || user.displayName || `User #${user.id}`}</span>
								</label>
							))
						)}
					</div>
				)}
				<div className="border-t space-y-1 pt-2">
					<p className="text-xs text-gray-400 mt-2">
						Assign users as guests to allow them to invoke this function.
					</p>
					<p className="text-xs text-gray-400 mt-2">
						As soon as a guest user is assigned to a function, every execution via the
						web will need to be authenticated with a valid Auth method.
					</p>
					<ActionButton
						icon="⚙️"
						label="Configure Guest Access"
						onClick={() => (window.location.href = "/guest-users")}
						variant="secondary"
					/>
				</div>
				<div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700/50">
					<button
						onClick={handleClose}
						className="px-6 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg font-medium transition-all duration-300 border border-gray-600/50 hover:border-gray-500"
						disabled={guestsLoading}
					>
						Close
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default GuestManagement;
