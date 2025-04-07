import React, { useState } from "react";
import Modal from "./Modal";

interface DeleteFileModalProps {
	isOpen: boolean;
	onClose: () => void;
	onDelete: () => Promise<boolean>;
	filename: string;
}

function DeleteFileModal({ isOpen, onClose, onDelete, filename }: DeleteFileModalProps) {
	const [isLoading, setIsLoading] = useState(false);

	const handleDelete = async () => {
		setIsLoading(true);
		try {
			const success = await onDelete();
			if (success) {
				onClose();
			}
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		if (!isLoading) {
			onClose();
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Delete File" isLoading={isLoading}>
			<p className="mb-4">Are you sure you want to delete <span className="font-semibold">{filename}</span>?</p>
			<div className="flex justify-end mt-4">
				<button 
					className="bg-grayed hover:bg-grayed/70 text-white px-4 py-2 rounded-md mr-2" 
					onClick={handleClose}
					disabled={isLoading}
				>
					Cancel
				</button>
				<button 
					className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md" 
					onClick={handleDelete}
					disabled={isLoading}
				>
					Delete
				</button>
			</div>
		</Modal>
	);
}

export default DeleteFileModal;
