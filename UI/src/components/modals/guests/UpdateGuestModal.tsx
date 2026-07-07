import React, { useState, useEffect } from "react";
import { updateGuestUser, GuestUser } from "../../../services/backend.guest";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, labelClass, ModalError, ModalFooter } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";

interface UpdateGuestModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	guest: GuestUser | null;
}

function UpdateGuestModal({ isOpen, onClose, onSuccess, guest }: UpdateGuestModalProps) {
	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	useShiftEnterSubmit(() => { handleSubmit(new Event("submit") as any); }, isOpen && !isLoading);

	useEffect(() => {
		if (guest) { setName(guest.displayName); setPassword(""); }
	}, [guest]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!guest) return;
		setIsLoading(true);
		setError("");
		try {
			const res = await updateGuestUser({
				id: guest.id,
				displayName: name,
				password: password || undefined,
			});
			if (res.status === "OK") {
				onSuccess();
				onClose();
			} else {
				setError((res as any).message || "Failed to update guest");
			}
		} catch {
			setError("Failed to update guest");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Update Guest User" isLoading={isLoading}>
			<form onSubmit={handleSubmit} className="space-y-4">
				<ModalError message={error} />
				<div>
					<label className={labelClass}>Display name</label>
					<input
						type="text"
						className={inputClass}
						placeholder="Display Name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
						disabled={isLoading}
					/>
				</div>
				<div>
					<label className={labelClass}>New password (optional)</label>
					<input
						type="password"
						className={inputClass}
						placeholder="Leave blank to keep current"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						disabled={isLoading}
					/>
				</div>
				<ModalFooter>
					<button type="button" onClick={onClose} className={cancelBtnClass} disabled={isLoading}>
						Cancel
					</button>
					<button type="submit" disabled={isLoading || !name} className={primaryBtnClass}>
						Update
					</button>
				</ModalFooter>
			</form>
		</Modal>
	);
}

export default UpdateGuestModal;
