import React, { useState } from "react";
import Modal from "./Modal";
import { createNamespace } from "../../services/backend.namespaces";

interface CreateNamespaceModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

function CreateNamespaceModal({
	isOpen,
	onClose,
	onSuccess,
}: CreateNamespaceModalProps) {
	const [name, setName] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async () => {
		if (!name.trim()) {
			setError("Please enter a namespace name");
			return;
		}

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
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Create Namespace"
			isLoading={isLoading}
		>
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

				{/* Description */}
				<div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
					<div className="flex items-start gap-3">
						<span className="text-blue-400 text-lg">💡</span>
						<div>
							<p className="text-blue-300 text-sm font-medium mb-1">
								What's a namespace?
							</p>
							<p className="text-blue-200/80 text-xs leading-relaxed">
								Namespaces help you organize your functions into logical groups. Think
								of them as folders for your serverless functions.
							</p>
						</div>
					</div>
				</div>

				{/* Namespace Name Input */}
				<div className="space-y-2">
					<label className="flex items-center gap-2 text-sm font-medium text-gray-300">
						<span className="text-lg">📁</span>
						Namespace Name
					</label>
					<input
						type="text"
						placeholder="Enter namespace name (e.g., api, utils, services)"
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
						<span className="text-sm">📁</span>
						Create Namespace
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default CreateNamespaceModal;
