import { useState } from "react";
import Modal from "../Modal";
import { cancelBtnClass, deleteBtnClass, ModalError } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import { deleteNamespace } from "../../../services/backend.namespaces";

interface DeleteNamespaceModalProps {
	isOpen: boolean;
	onClose: () => void;
	onDelete: () => void;
	namespaceId: number | null;
	namespaceName: string;
}

function DeleteNamespaceModal({
	isOpen,
	onClose,
	onDelete,
	namespaceId,
	namespaceName,
}: DeleteNamespaceModalProps) {
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useShiftEnterSubmit(() => handleDelete(), isOpen && !isDeleting);

	const handleDelete = async () => {
		if (!namespaceId) return;
		setIsDeleting(true);
		setError(null);
		try {
			const response = await deleteNamespace(namespaceId);
			if (response.status === "OK") {
				onDelete();
				onClose();
			} else {
				setError(response.message || "Failed to delete namespace");
			}
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Delete Namespace" isLoading={isDeleting}>
			<div className="space-y-5">
				<ModalError message={error} />
				<div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
					This will permanently delete the namespace and all functions within it. This action
					cannot be undone.
				</div>
				<p className="text-sm text-text/80">
					Are you sure you want to delete{" "}
					<span className="font-semibold text-text">{namespaceName}</span> and all its functions?
				</p>
				<div className="flex justify-end gap-3">
					<button onClick={onClose} className={cancelBtnClass} disabled={isDeleting}>
						Cancel
					</button>
					<button onClick={handleDelete} className={deleteBtnClass} disabled={isDeleting}>
						Delete Namespace
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default DeleteNamespaceModal;
