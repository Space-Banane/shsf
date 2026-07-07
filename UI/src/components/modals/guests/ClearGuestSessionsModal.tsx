import React, { useState } from "react";
import { clearGuestSessions, GuestUser } from "../../../services/backend.guest";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, ModalError } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";

interface ClearGuestSessionsModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	guest: GuestUser | null;
}

function ClearGuestSessionsModal({
	isOpen,
	onClose,
	onSuccess,
	guest,
}: ClearGuestSessionsModalProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	useShiftEnterSubmit(() => handleClear(), isOpen && !isLoading);

	const handleClear = async () => {
		if (!guest) return;
		setIsLoading(true);
		setError("");
		try {
			const res = await clearGuestSessions(guest.id);
			if (res.status === "OK") {
				onSuccess();
				onClose();
			} else {
				setError((res as any).message || "Failed to clear sessions");
			}
		} catch {
			setError("Failed to clear sessions");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Clear Guest Sessions" isLoading={isLoading}>
			<div className="space-y-5">
				<ModalError message={error} />
				<p className="text-sm text-text/80">
					This will clear all active login sessions for{" "}
					<span className="font-semibold text-text">{guest?.displayName}</span>. They will need
					to log in again.
				</p>
				<div className="flex justify-end gap-3">
					<button onClick={onClose} className={cancelBtnClass} disabled={isLoading}>
						Cancel
					</button>
					<button onClick={handleClear} className={primaryBtnClass} disabled={isLoading}>
						Clear Sessions
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default ClearGuestSessionsModal;
