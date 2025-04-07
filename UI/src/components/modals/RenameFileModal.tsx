import React, { useState, useEffect } from "react";
import Modal from "./Modal";

interface RenameFileModalProps {
	isOpen: boolean;
	onClose: () => void;
	onRename: (newFilename: string) => Promise<boolean>;
	currentFilename: string;
}

function RenameFileModal({ isOpen, onClose, onRename, currentFilename }: RenameFileModalProps) {
	const [newFilename, setNewFilename] = useState(currentFilename);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setNewFilename(currentFilename);
		}
	}, [isOpen, currentFilename]);

	const handleRename = async () => {
		if (!newFilename.trim() || newFilename.trim().length < 3) {
			alert("Filename must be at least 3 characters long.");
			return;
		}

		if (newFilename === currentFilename) {
			onClose();
			return;
		}

		setIsLoading(true);
		try {
			const success = await onRename(newFilename);
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
		<Modal isOpen={isOpen} onClose={handleClose} title="Rename File" isLoading={isLoading}>
			<div className="space-y-1 mb-4">
				<label className="text-base text-gray-300" title="Enter a new name for the file">New Filename</label>
				<input
					type="text"
					placeholder="New filename"
					value={newFilename}
					onChange={(e) => setNewFilename(e.target.value)}
					className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md"
					disabled={isLoading}
				/>
			</div>
			<div className="flex justify-end mt-4">
				<button 
					className="bg-grayed hover:bg-grayed/70 text-white px-4 py-2 rounded-md mr-2" 
					onClick={handleClose}
					disabled={isLoading}
				>
					Cancel
				</button>
				<button 
					className="bg-primary hover:bg-primary/70 text-white px-4 py-2 rounded-md" 
					onClick={handleRename}
					disabled={isLoading}
				>
					Rename
				</button>
			</div>
		</Modal>
	);
}

export default RenameFileModal;
