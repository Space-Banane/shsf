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
			<div className="space-y-6">
				{/* Current File Info */}
				<div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
					<div className="flex items-center gap-3">
						<span className="text-blue-400 text-lg">📄</span>
						<div>
							<p className="text-blue-300 text-sm font-medium">Current filename</p>
							<p className="text-blue-200/80 text-xs font-mono">{currentFilename}</p>
						</div>
					</div>
				</div>

				{/* New Filename Input */}
				<div className="space-y-2">
					<label className="flex items-center gap-2 text-sm font-medium text-gray-300">
						<span className="text-lg">✏️</span>
						New Filename
					</label>
					<input
						type="text"
						placeholder="Enter new filename"
						value={newFilename}
						onChange={(e) => setNewFilename(e.target.value)}
						className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 font-mono"
						disabled={isLoading}
					/>
				</div>

				{/* Action Buttons */}
				<div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700/50">
					<button 
						onClick={handleClose}
						className="px-6 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg font-medium transition-all duration-300 border border-gray-600/50 hover:border-gray-500"
						disabled={isLoading}
					>
						Cancel
					</button>
					<button 
						onClick={handleRename}
						className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
						disabled={isLoading}
					>
						<span className="text-sm">✏️</span>
						Rename File
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default RenameFileModal;
