import React, { useState } from "react";
import Modal from "../Modal";
import { cancelBtnClass, deleteBtnClass } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";

interface DeleteFileModalProps {
	isOpen: boolean;
	onClose: () => void;
	onDelete: () => Promise<boolean>;
	filename: string;
}

function DeleteFileModal({ isOpen, onClose, onDelete, filename }: DeleteFileModalProps) {
	const [isLoading, setIsLoading] = useState(false);

	useShiftEnterSubmit(() => handleDelete(), isOpen && !isLoading);

	const handleDelete = async () => {
		setIsLoading(true);
		try {
			const success = await onDelete();
			if (success) onClose();
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => { if (!isLoading) onClose(); };

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Delete File" isLoading={isLoading}>
			<div className="space-y-5">
				<div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
					This action cannot be undone. The file and all its contents will be permanently removed.
				</div>
				<p className="text-sm text-text/80">
					Are you sure you want to delete{" "}
					<span className="font-semibold text-text font-mono">{filename}</span>?
				</p>
				<div className="flex justify-end gap-3">
					<button onClick={handleClose} className={cancelBtnClass} disabled={isLoading}>
						Cancel
					</button>
					<button onClick={handleDelete} className={deleteBtnClass} disabled={isLoading}>
						Delete File
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default DeleteFileModal;
