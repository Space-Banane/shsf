import React from "react";
import Modal from "../Modal";
import { cancelBtnClass, deleteBtnClass } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";

interface DeleteFunctionModalProps {
	isOpen: boolean;
	onClose: () => void;
	onDelete: (functionId: number) => Promise<boolean>;
	functionId: number | null;
	functionName: string;
}

function DeleteFunctionModal({
	isOpen,
	onClose,
	onDelete,
	functionId,
	functionName,
}: DeleteFunctionModalProps) {
	const [isDeleting, setIsDeleting] = React.useState(false);

	useShiftEnterSubmit(() => handleDelete(), isOpen && !isDeleting);

	const handleDelete = async () => {
		if (!functionId) return;
		setIsDeleting(true);
		try {
			const success = await onDelete(functionId);
			if (success) onClose();
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Delete Function" isLoading={isDeleting}>
			<div className="space-y-5">
				<div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
					This action cannot be undone. All function data, configurations, and associated files
					will be permanently removed.
				</div>
				<p className="text-sm text-text/80">
					Are you sure you want to delete{" "}
					<span className="font-semibold text-text">{functionName}</span>?
				</p>
				<div className="flex justify-end gap-3">
					<button onClick={onClose} className={cancelBtnClass} disabled={isDeleting}>
						Cancel
					</button>
					<button onClick={handleDelete} className={deleteBtnClass} disabled={isDeleting}>
						Delete Function
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default DeleteFunctionModal;
