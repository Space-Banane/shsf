import React, { useState } from "react";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, labelClass, ModalError, ModalFooter } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import { createNamespace } from "../../../services/backend.namespaces";

interface CreateNamespaceModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

function CreateNamespaceModal({ isOpen, onClose, onSuccess }: CreateNamespaceModalProps) {
	const [name, setName] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	useShiftEnterSubmit(() => handleSubmit(), isOpen && !isLoading);

	const handleSubmit = async () => {
		if (!name.trim()) { setError("Please enter a namespace name"); return; }
		setError("");
		setIsLoading(true);
		try {
			const response = await createNamespace(name);
			if (response.status === "OK") {
				onSuccess();
				onClose();
				setName("");
			} else {
				setError("Error creating namespace: " + response.message);
			}
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => { if (!isLoading) { onClose(); setError(""); } };

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Create Namespace" isLoading={isLoading}>
			<div className="space-y-4">
				<ModalError message={error} />
				<div>
					<label className={labelClass}>Namespace name</label>
					<input
						type="text"
						placeholder="e.g., api, utils, services"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className={inputClass}
						disabled={isLoading}
						autoFocus
					/>
				</div>
				<ModalFooter>
					<button onClick={handleClose} className={cancelBtnClass} disabled={isLoading}>
						Cancel
					</button>
					<button onClick={handleSubmit} className={primaryBtnClass} disabled={isLoading}>
						Create Namespace
					</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}

export default CreateNamespaceModal;
