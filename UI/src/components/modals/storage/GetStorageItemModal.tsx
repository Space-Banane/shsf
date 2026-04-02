import React, { useState } from "react";
import Modal from "../Modal";
import { getStorageItem, Storage, StorageItem } from "../../../services/backend.storage";

interface GetStorageItemModalProps {
	isOpen: boolean;
	onClose: () => void;
	selectedStorage: Storage | null;
}

function GetStorageItemModal({
	isOpen,
	onClose,
	selectedStorage,
}: GetStorageItemModalProps) {
	const [key, setKey] = useState("");
	const [result, setResult] = useState<StorageItem | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const handleGet = async () => {
		if (!selectedStorage) return;
		setIsLoading(true);
		setError("");
		setResult(null);
		try {
			const res = await getStorageItem(selectedStorage.name, key);
			if (res.status === "OK") {
				setResult(res.data);
			} else {
				setError(res.message || "Item not found");
			}
		} catch (e) {
			setError("Failed to get item");
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		setKey("");
		setResult(null);
		setError("");
		onClose();
	};

	if (!isOpen || !selectedStorage) return null;

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Get Item by Key">
			<div className="text-center mb-6">
				<div className="text-5xl mb-2">🔍</div>
				<p className="text-text/70">
					Retrieve a single item from{" "}
					<span className="font-bold text-primary">{selectedStorage.name}</span> by
					key.
				</p>
			</div>
			<div className="space-y-4">
				<input
					type="text"
					className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none font-mono"
					placeholder="Key"
					value={key}
					onChange={(e) => setKey(e.target.value)}
					disabled={isLoading}
				/>
				<div className="flex gap-3 pt-2">
					<button
						onClick={handleClose}
						className="flex-1 px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text hover:border-primary/40 transition-all duration-300"
						disabled={isLoading}
					>
						Cancel
					</button>
					<button
						onClick={handleGet}
						disabled={isLoading || !key}
						className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-all duration-300"
					>
						{isLoading ? "Searching..." : "Get Item"}
					</button>
				</div>
				{error && (
					<div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
						{error}
					</div>
				)}
				{result && (
					<div className="bg-background/30 border border-primary/10 rounded-xl p-4 mt-2">
						<div className="font-mono text-primary mb-1">
							Key: {result.key}
						</div>
						<div className="font-mono text-text mb-1 text-sm break-all">
							Value: {JSON.stringify(result.value)}
						</div>
						<div className="text-xs text-text/60">
							Expires At:{" "}
							{result.expiresAt ? (
								new Date(result.expiresAt).toLocaleString()
							) : (
								<span className="text-text/30">Never</span>
							)}
						</div>
					</div>
				)}
			</div>
		</Modal>
	);
}

export default GetStorageItemModal;
