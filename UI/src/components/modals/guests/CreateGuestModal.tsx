import React, { useState } from "react";
import { createGuestUser } from "../../../services/backend.guest";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, labelClass, ModalError, ModalFooter } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";

interface CreateGuestModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

function CreateGuestModal({ isOpen, onClose, onSuccess }: CreateGuestModalProps) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	useShiftEnterSubmit(() => { handleSubmit(new Event("submit") as any); }, isOpen && !isLoading);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");
		try {
			const res = await createGuestUser({ displayName: name, email, password });
			if (res.status === "OK") {
				setName(""); setEmail(""); setPassword("");
				onSuccess();
				onClose();
			} else {
				setError((res as any).message || "Failed to create guest");
			}
		} catch {
			setError("Failed to create guest");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Create Guest User" isLoading={isLoading}>
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
						autoFocus
					/>
				</div>
				<div>
					<label className={labelClass}>Email</label>
					<input
						type="email"
						className={inputClass}
						placeholder="guest@example.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						disabled={isLoading}
					/>
				</div>
				<div>
					<label className={labelClass}>Password</label>
					<input
						type="password"
						className={inputClass}
						placeholder="••••••••"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						disabled={isLoading}
					/>
				</div>
				<ModalFooter>
					<button type="button" onClick={onClose} className={cancelBtnClass} disabled={isLoading}>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isLoading || !name || !email || !password}
						className={primaryBtnClass}
					>
						Create
					</button>
				</ModalFooter>
			</form>
		</Modal>
	);
}

export default CreateGuestModal;
