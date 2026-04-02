import React, { useState, useEffect } from "react";
import { updateGuestUser, GuestUser } from "../../../services/backend.guest";
import Modal from "../Modal";

interface UpdateGuestModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	guest: GuestUser | null;
}

function UpdateGuestModal({
	isOpen,
	onClose,
	onSuccess,
	guest,
}: UpdateGuestModalProps) {
	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (guest) {
			setName(guest.displayName);
			setPassword("");
		}
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
		} catch (e) {
			setError("Failed to update guest");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Update Guest User">
			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="text-center mb-6">
					<div className="text-5xl mb-2">👤</div>
					<p className="text-text/70 text-sm">Update guest user information.</p>
				</div>
				<input
					type="text"
					className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none"
					placeholder="Display Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
					disabled={isLoading}
				/>
				<input
					type="password"
					className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none"
					placeholder="New Password (optional)"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					disabled={isLoading}
				/>
				{error && (
					<div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
						{error}
					</div>
				)}
				<div className="flex gap-3 pt-2">
					<button
						type="button"
						onClick={onClose}
						className="flex-1 px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text hover:border-primary/40 transition-all duration-300"
						disabled={isLoading}
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isLoading || !name}
						className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-all duration-300"
					>
						{isLoading ? "Updating..." : "Update"}
					</button>
				</div>
			</form>
		</Modal>
	);
}

export default UpdateGuestModal;