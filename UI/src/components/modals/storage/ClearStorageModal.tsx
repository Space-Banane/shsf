import React, { useState } from "react";
import Modal from "../Modal";
import { cancelBtnClass, deleteBtnClass, ModalError } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import { clearStorageItems, Storage } from "../../../services/backend.storage";

interface ClearStorageModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	selectedStorage: Storage | null;
}

function ClearStorageModal({ isOpen, onClose, onSuccess, selectedStorage }: ClearStorageModalProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	useShiftEnterSubmit(() => handleClear(), isOpen && !isLoading && selectedStorage !== null);

	const handleClear = async () => {
		if (!selectedStorage) return;
		setIsLoading(true);
		setError("");
		try {
			const res = await clearStorageItems(selectedStorage.name);
			if (res.status === "OK") { onSuccess(); onClose(); }
			else setError(res.message || "Failed to clear items");
		} catch {
			setError("Failed to clear items");
		} finally {
			setIsLoading(false);
		}
	};

	if (!isOpen || !selectedStorage) return null;

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Clear All Items" isLoading={isLoading}>
			<div className="space-y-5">
				<ModalError message={error} />
				<p className="text-sm text-text/80">
					Are you sure you want to clear all items in{" "}
					<span className="font-semibold text-text">{selectedStorage.name}</span>? This cannot
					be undone.
				</p>
				<div className="flex justify-end gap-3">
					<button onClick={onClose} className={cancelBtnClass} disabled={isLoading}>
						Cancel
					</button>
					<button onClick={handleClear} className={deleteBtnClass} disabled={isLoading}>
						Clear All
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default ClearStorageModal;
