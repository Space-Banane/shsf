import React, { useState } from "react";
import Modal from "../Modal";
import { cancelBtnClass, deleteBtnClass, ModalError } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import { deleteStorage, Storage } from "../../../services/backend.storage";

interface DeleteStorageModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	target: Storage | null;
}

function DeleteStorageModal({ isOpen, onClose, onSuccess, target }: DeleteStorageModalProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	useShiftEnterSubmit(() => handleDelete(), isOpen && !isLoading && target !== null);

	const handleDelete = async () => {
		if (!target) return;
		setIsLoading(true);
		setError("");
		try {
			const res = await deleteStorage(target.name);
			if (res.status === "OK") { onSuccess(); onClose(); }
			else setError(res.message || "Failed to delete storage");
		} catch {
			setError("Failed to delete storage");
		} finally {
			setIsLoading(false);
		}
	};

	if (!isOpen || !target) return null;

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Delete Storage" isLoading={isLoading}>
			<div className="space-y-5">
				<ModalError message={error} />
				<p className="text-sm text-text/80">
					Are you sure you want to delete{" "}
					<span className="font-semibold text-text">{target.name}</span>? This cannot be undone.
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

export default DeleteStorageModal;
