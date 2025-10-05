import React, { useState } from "react";
import Modal from "./Modal";
import { renameNamespace } from "../../services/backend.namespaces";

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
	currentName 
}: RenameNamespaceModalProps) {
	const [name, setName] = useState(currentName);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	
	React.useEffect(() => {
		setName(currentName);
	}, [currentName, isOpen]);

	const handleSubmit = async () => {
		if (!namespaceId) {
			setError("No namespace selected");
			return;
		}
		
		if (!name.trim()) {
			setError("Please enter a namespace name");
			return;
		}

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
		} catch (err) {
			setError("An unexpected error occurred");
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		if (!isLoading) {
			onClose();
			setError("");
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Rename Namespace" isLoading={isLoading}>
			<div className="space-y-6">
				{/* Error Message */}
				{error && (
					<div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
						<div className="flex items-center gap-3">
							<span className="text-red-400 text-lg">⚠️</span>
							<p className="text-red-300 text-sm font-medium">{error}</p>
						</div>
					</div>
				)}

				{/* Current Namespace Info */}
				<div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
					<div className="flex items-center gap-3">
						<span className="text-blue-400 text-lg">📁</span>
						<div>
							<p className="text-blue-300 text-sm font-medium">Current namespace name</p>
							<p className="text-blue-200/80 text-xs">{currentName}</p>
						</div>
					</div>
				</div>

				{/* New Namespace Name Input */}
				<div className="space-y-2">
					<label className="flex items-center gap-2 text-sm font-medium text-gray-300">
						<span className="text-lg">✏️</span>
						New Namespace Name
					</label>
					<input
						type="text"
						placeholder="Enter new namespace name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
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
						onClick={handleSubmit} 
						className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
						disabled={isLoading}
					>
						<span className="text-sm">✏️</span>
						Rename Namespace
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default RenameNamespaceModal;
