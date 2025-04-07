import React, { useState } from "react";
import Modal from "./Modal";
import { createNamespace } from "../../services/backend.namespaces";

interface CreateNamespaceModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

function CreateNamespaceModal({ isOpen, onClose, onSuccess }: CreateNamespaceModalProps) {
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
		<Modal isOpen={isOpen} onClose={handleClose} title="Create Namespace" isLoading={isLoading}>
			{error && <div className="bg-red-500/20 border border-red-500 p-2 rounded-md text-red-300 mb-4">{error}</div>}
			<div>
				<div className="space-y-1 mb-4">
					<label className="text-base text-gray-300" title="Enter a unique name for your new namespace">Namespace Name</label>
					<input
						type="text"
						placeholder="Namespace Name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md"
						disabled={isLoading}
					/>
				</div>
				<div className="flex justify-end">
					<button 
						onClick={handleClose} 
						className="bg-grayed hover:bg-grayed/70 text-white px-4 py-2 rounded-md mr-2"
						disabled={isLoading}
					>
						Cancel
					</button>
					<button 
						onClick={handleSubmit} 
						className="bg-primary hover:bg-primary/70 text-white px-4 py-2 rounded-md"
						disabled={isLoading}
					>
						Create
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default CreateNamespaceModal;
