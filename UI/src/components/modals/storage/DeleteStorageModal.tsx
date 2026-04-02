import React, { useState } from "react";
import Modal from "../Modal";
import { deleteStorage, Storage } from "../../../services/backend.storage";

interface DeleteStorageModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	target: Storage | null;
}

function DeleteStorageModal({
	isOpen,
	onClose,
	onSuccess,
	target,
}: DeleteStorageModalProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const handleDelete = async () => {
		if (!target) return;
		setIsLoading(true);
		setError("");
		try {
			const res = await deleteStorage(target.name);
			if (res.status === "OK") {
				onSuccess();
				onClose();
			} else {
				setError(res.message || "Failed to delete storage");
			}
		} catch (e) {
			setError("Failed to delete storage");
		} finally {
			setIsLoading(false);
		}
	};

	if (!isOpen || !target) return null;

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Delete Storage">
			<div className="text-center mb-6">
				<div className="text-5xl mb-2">⚠️</div>
				<p className="text-text/70">
					Are you sure you want to delete{" "}
					<span className="font-bold text-primary">{target.name}</span>? This
					cannot be undone.
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
					onClick={handleDelete}
					disabled={isLoading}
					className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed transition-all duration-300"
				>
					{isLoading ? "Deleting..." : "Delete"}
				</button>
			</div>
		</Modal>
	);
}

export default DeleteStorageModal;
