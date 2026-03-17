import React, { useState } from "react";
import { clearGuestSessions, GuestUser } from "../../services/backend.guest";
import Modal from "./Modal";

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
		} catch (e) {
			setError("Failed to clear sessions");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Clear Guest Sessions">
			<div className="space-y-4">
				<div className="text-center mb-6">
					<div className="text-5xl mb-2">🧹</div>
					<h3 className="text-xl font-bold text-primary">Clear all active sessions?</h3>
					<p className="text-text/70 mt-2">
						This will clear all active login sessions for guest{" "}
						<span className="text-primary font-bold">
							{guest?.displayName}
						</span>.
					</p>
				</div>
				{error && (
					<div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
						{error}
					</div>
				)}
				<div className="flex gap-3 pt-2">
					<button
						onClick={onClose}
						className="flex-1 px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text hover:border-primary/40 transition-all duration-300"
						disabled={isLoading}
					>
						Cancel
					</button>
					<button
						onClick={handleClear}
						disabled={isLoading}
						className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
					>
						{isLoading ? (
							<>
								<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
								Clearing...
							</>
						) : (
							"Clear Sessions"
						)}
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default ClearGuestSessionsModal;