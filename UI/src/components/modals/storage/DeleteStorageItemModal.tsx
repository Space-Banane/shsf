import React, { useState } from "react";
import Modal from "../Modal";
import { deleteStorageItem, Storage } from "../../../services/backend.storage";

interface DeleteStorageItemModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	selectedStorage: Storage | null;
	deleteItemKey: string | null;
}

function DeleteStorageItemModal({
	isOpen,
	onClose,
	onSuccess,
	selectedStorage,
	deleteItemKey,
}: DeleteStorageItemModalProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const handleDelete = async () => {
		if (!selectedStorage || !deleteItemKey) return;
		setIsLoading(true);
		setError("");
		try {
			const res = await deleteStorageItem(selectedStorage.name, deleteItemKey);
			if (res.status === "OK") {
				onSuccess();
				onClose();
			} else {
				setError(res.message || "Failed to delete item");
			}
		} catch (e) {
			setError("Failed to delete item");
		} finally {
			setIsLoading(false);
		}
	};

	if (!isOpen || !selectedStorage || !deleteItemKey) return null;

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Delete Item"
		>
			<div className="text-center mb-6">
				<div className="text-5xl mb-2">⚠️</div>
				<p className="text-text/70">
					Are you sure you want to delete the item{" "}
					<span className="font-bold text-primary">{deleteItemKey}</span>?
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

export default DeleteStorageItemModal;
