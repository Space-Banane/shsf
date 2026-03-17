import React, { useState } from "react";
import Modal from "./Modal";
import { clearStorageItems, Storage } from "../../services/backend.storage";

interface ClearStorageModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	selectedStorage: Storage | null;
}

function ClearStorageModal({
	isOpen,
	onClose,
	onSuccess,
	selectedStorage,
}: ClearStorageModalProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const handleClear = async () => {
		if (!selectedStorage) return;
		setIsLoading(true);
		setError("");
		try {
			const res = await clearStorageItems(selectedStorage.name);
			if (res.status === "OK") {
				onSuccess();
				onClose();
			} else {
				setError(res.message || "Failed to clear items");
			}
		} catch (e) {
			setError("Failed to clear items");
		} finally {
			setIsLoading(false);
		}
	};

	if (!isOpen || !selectedStorage) return null;

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Clear All Items">
			<div className="text-center mb-6">
				<div className="text-5xl mb-2">🧹</div>
				<p className="text-text/70">
					Are you sure you want to clear all items in{" "}
					<span className="font-bold text-primary">{selectedStorage.name}</span>?
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
					className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-all duration-300"
				>
					{isLoading ? "Clearing..." : "Clear All"}
				</button>
			</div>
		</Modal>
	);
}

export default ClearStorageModal;
