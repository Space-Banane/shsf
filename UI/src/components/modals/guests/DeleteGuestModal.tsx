import React, { useState } from "react";
import { deleteGuestUser, GuestUser } from "../../../services/backend.guest";
import Modal from "../Modal";
import { cancelBtnClass, deleteBtnClass, ModalError } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";

interface DeleteGuestModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	guest: GuestUser | null;
}

function DeleteGuestModal({ isOpen, onClose, onSuccess, guest }: DeleteGuestModalProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	useShiftEnterSubmit(() => handleDelete(), isOpen && !isLoading);

	const handleDelete = async () => {
		if (!guest) return;
		setIsLoading(true);
		setError("");
		try {
			const res = await deleteGuestUser(guest.id);
			if (res.status === "OK") {
				onSuccess();
				onClose();
			} else {
				setError((res as any).message || "Failed to delete guest");
			}
		} catch {
			setError("Failed to delete guest");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Delete Guest User" isLoading={isLoading}>
			<div className="space-y-5">
				<ModalError message={error} />
				<p className="text-sm text-text/80">
					Are you sure you want to permanently delete{" "}
					<span className="font-semibold text-text">{guest?.displayName}</span>{" "}
					({guest?.email})? This action cannot be undone.
				</p>
				<div className="flex justify-end gap-3">
					<button onClick={onClose} className={cancelBtnClass} disabled={isLoading}>
						Cancel
					</button>
					<button onClick={handleDelete} className={deleteBtnClass} disabled={isLoading}>
						Delete User
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default DeleteGuestModal;
