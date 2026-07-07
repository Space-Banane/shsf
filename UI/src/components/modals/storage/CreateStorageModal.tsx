import React, { useState } from "react";
import { createStorage } from "../../../services/backend.storage";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, labelClass, ModalError, ModalFooter } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";

interface CreateStorageModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

function CreateStorageModal({ isOpen, onClose, onSuccess }: CreateStorageModalProps) {
	const [name, setName] = useState("");
	const [purpose, setPurpose] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	useShiftEnterSubmit(() => handleSubmit(), isOpen && !isLoading && name.trim().length > 0);

	const handleSubmit = async () => {
		setIsLoading(true);
		setError("");
		try {
			const res = await createStorage({ name, purpose });
			if (res.status === "OK") {
				setName(""); setPurpose("");
				onSuccess();
				onClose();
			} else {
				setError(res.message || "Failed to create storage");
			}
		} catch {
			setError("Failed to create storage");
		} finally {
			setIsLoading(false);
		}
	};

	if (!isOpen) return null;

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Create Storage" isLoading={isLoading}>
			<div className="space-y-4">
				<ModalError message={error} />
				<div>
					<label className={labelClass}>Storage name</label>
					<input
						type="text"
						className={`${inputClass} font-mono`}
						placeholder="e.g., my-cache"
						value={name}
						onChange={(e) => setName(e.target.value)}
						disabled={isLoading}
						autoFocus
					/>
				</div>
				<div>
					<label className={labelClass}>Purpose (optional)</label>
					<input
						type="text"
						className={inputClass}
						placeholder="What will this storage be used for?"
						value={purpose}
						onChange={(e) => setPurpose(e.target.value)}
						disabled={isLoading}
					/>
				</div>
				<ModalFooter>
					<button onClick={onClose} className={cancelBtnClass} disabled={isLoading}>
						Cancel
					</button>
					<button onClick={handleSubmit} disabled={isLoading || !name} className={primaryBtnClass}>
						Create
					</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}

export default CreateStorageModal;
