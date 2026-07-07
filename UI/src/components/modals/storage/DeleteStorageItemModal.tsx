import React, { useState } from "react";
import Modal from "../Modal";
import { cancelBtnClass, deleteBtnClass, ModalError } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
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

	useShiftEnterSubmit(() => handleDelete(), isOpen && !isLoading && deleteItemKey !== null);

	const handleDelete = async () => {
		if (!selectedStorage || !deleteItemKey) return;
		setIsLoading(true);
		setError("");
		try {
			const res = await deleteStorageItem(selectedStorage.name, deleteItemKey);
			if (res.status === "OK") { onSuccess(); onClose(); }
			else setError(res.message || "Failed to delete item");
		} catch {
			setError("Failed to delete item");
		} finally {
			setIsLoading(false);
		}
	};

	if (!isOpen || !selectedStorage || !deleteItemKey) return null;

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Delete Item" isLoading={isLoading}>
			<div className="space-y-5">
				<ModalError message={error} />
				<p className="text-sm text-text/80">
					Are you sure you want to delete the item{" "}
					<span className="font-semibold text-text font-mono">{deleteItemKey}</span>?
				</p>
				<div className="flex justify-end gap-3">
					<button onClick={onClose} className={cancelBtnClass} disabled={isLoading}>
						Cancel
					</button>
					<button onClick={handleDelete} className={deleteBtnClass} disabled={isLoading}>
						Delete
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default DeleteStorageItemModal;
