import React, { useState } from "react";
import { createStorage } from "../../services/backend.storage";
import Modal from "./Modal";

interface CreateStorageModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

function CreateStorageModal({
	isOpen,
	onClose,
	onSuccess,
}: CreateStorageModalProps) {
	const [name, setName] = useState("");
	const [purpose, setPurpose] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async () => {
		setIsLoading(true);
		setError("");
		try {
			const res = await createStorage({
				name: name,
				purpose: purpose,
			});
			if (res.status === "OK") {
				setName("");
				setPurpose("");
				onSuccess();
				onClose();
			} else {
				setError(res.message || "Failed to create storage");
			}
		} catch (e) {
			setError("Failed to create storage");
		} finally {
			setIsLoading(false);
		}
	};

	if (!isOpen) return null;

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Create Storage">
			<div className="text-center mb-6">
				<div className="text-5xl mb-2">🗄️</div>
				<p className="text-text/70">Create a new virtual database (storage).</p>
			</div>
			<div className="space-y-4">
				<input
					type="text"
					className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none font-mono"
					placeholder="Storage Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					disabled={isLoading}
				/>
				<input
					type="text"
					className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none font-mono"
					placeholder="Purpose (optional)"
					value={purpose}
					onChange={(e) => setPurpose(e.target.value)}
					disabled={isLoading}
				/>
				{error && (
					<div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
						{error}
					</div>
				)}
				<div className="flex gap-3 pt-2">
					<button
						onClick={onClose}
						className="flex-1 px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text hover:border-primary/40 transition-all duration-300"
						disabled={isLoading}
					>
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						disabled={isLoading || !name}
						className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-all duration-300"
					>
						{isLoading ? "Creating..." : "Create"}
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default CreateStorageModal;
