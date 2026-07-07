import React, { useState } from "react";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, labelClass, ModalError, ModalFooter } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import { renameNamespace } from "../../../services/backend.namespaces";

interface RenameNamespaceModalProps {
	isOpen: boolean;
	onClose: () => void;
	onRename: () => void;
	namespaceId: number | null;
	currentName: string;
}

function RenameNamespaceModal({
	isOpen,
	onClose,
	onRename,
	namespaceId,
	currentName,
}: RenameNamespaceModalProps) {
	const [name, setName] = useState(currentName);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	useShiftEnterSubmit(() => handleSubmit(), isOpen && !isLoading);

	React.useEffect(() => {
		setName(currentName);
	}, [currentName, isOpen]);

	const handleSubmit = async () => {
		if (!namespaceId) { setError("No namespace selected"); return; }
		if (!name.trim()) { setError("Please enter a namespace name"); return; }
		setError("");
		setIsLoading(true);
		try {
			const response = await renameNamespace(namespaceId, name);
			if (response.status === "OK") {
				onRename();
				onClose();
			} else {
				setError("Error renaming namespace: " + response.message);
			}
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => { if (!isLoading) { onClose(); setError(""); } };

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Rename Namespace" isLoading={isLoading}>
			<div className="space-y-4">
				<ModalError message={error} />
				<div>
					<label className={labelClass}>New namespace name</label>
					<input
						type="text"
						placeholder="Enter new namespace name"
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
						Rename
					</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}

export default RenameNamespaceModal;
