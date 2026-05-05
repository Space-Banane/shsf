import React, { useState } from "react";
import Modal from "../Modal";
import {
	setStorageItem,
	Storage,
	StorageItem,
} from "../../../services/backend.storage";

interface AddStorageItemModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	selectedStorage: Storage | null;
	initialItem?: StorageItem | null;
}

function AddStorageItemModal({
	isOpen,
	onClose,
	onSuccess,
	selectedStorage,
	initialItem = null,
}: AddStorageItemModalProps) {
	const [key, setKey] = useState(initialItem?.key ?? "");
	const [value, setValue] = useState(
		initialItem ? JSON.stringify(initialItem.value, null, 2) : "",
	);
	const [expiresAt, setExpiresAt] = useState(
		initialItem?.expiresAt ? initialItem.expiresAt.slice(0, 16) : "",
	);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	React.useEffect(() => {
		if (!isOpen) {
			return;
		}

		setKey(initialItem?.key ?? "");
		setValue(initialItem ? JSON.stringify(initialItem.value, null, 2) : "");
		setExpiresAt(initialItem?.expiresAt ? initialItem.expiresAt.slice(0, 16) : "");
		setError("");
	}, [initialItem, isOpen]);

	const handleClose = () => {
		setKey(initialItem?.key ?? "");
		setValue(initialItem ? JSON.stringify(initialItem.value, null, 2) : "");
		setExpiresAt(initialItem?.expiresAt ? initialItem.expiresAt.slice(0, 16) : "");
		setError("");
		onClose();
	};

	const handleSubmit = async (parsedValue?: any) => {
		if (!selectedStorage) return;
		setIsLoading(true);
		setError("");
		try {
			const payload: any = {
				key: key,
				value: parsedValue !== undefined ? parsedValue : value,
			};
			if (expiresAt) payload.expiresAt = expiresAt;
			const res = await setStorageItem(selectedStorage.name, payload);
			if (res.status === "OK") {
				setKey("");
				setValue("");
				setExpiresAt("");
				onSuccess();
				handleClose();
			} else {
				setError(res.message || "Failed to set item");
			}
		} catch (e) {
			setError("Failed to set item");
		} finally {
			setIsLoading(false);
		}
	};

	if (!isOpen || !selectedStorage) return null;

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title={initialItem ? "Edit Item" : "Add Item"}
		>
			<div className="text-center mb-6">
				<div className="text-5xl mb-2">{initialItem ? "✏️" : "➕"}</div>
				<p className="text-text/70">
					{initialItem ? "Update" : "Add or update"} an item in{" "}
					<span className="font-bold text-primary">{selectedStorage.name}</span>.
				</p>
			</div>
			<div className="space-y-4">
				<input
					type="text"
					className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none font-mono"
					placeholder="Key"
					value={key}
					onChange={(e) => setKey(e.target.value)}
					disabled={isLoading || Boolean(initialItem)}
				/>
				<textarea
					className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none font-mono"
					placeholder="Value (JSON or string)"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					disabled={isLoading}
					rows={3}
				/>
				<div className="space-y-1">
					<div className="flex items-center justify-between gap-3">
						<label className="text-xs text-text/50 ml-1">Expires At (optional)</label>
						<button
							type="button"
							className="text-xs text-primary hover:text-primary/80 disabled:text-text/30 transition-all duration-300"
							onClick={() => setExpiresAt("")}
							disabled={isLoading || !expiresAt}
						>
							Clear Expiry
						</button>
					</div>
					<input
						type="datetime-local"
						className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none font-mono"
						value={expiresAt}
						onChange={(e) => setExpiresAt(e.target.value)}
						disabled={isLoading}
					/>
				</div>
				{error && (
					<div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
						{error}
					</div>
				)}
				<div className="flex gap-3 pt-2">
					<button
						onClick={handleClose}
						className="flex-1 px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text hover:border-primary/40 transition-all duration-300"
						disabled={isLoading}
					>
						Cancel
					</button>
					<button
						onClick={() => {
							// Try to parse value as JSON, fallback to string
							let parsed = value;
							try {
								parsed = JSON.parse(value);
							} catch {
								// Intentionally ignore JSON parse errors and use the string value
							}
							handleSubmit(parsed);
						}}
						disabled={isLoading || !key}
						className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-all duration-300"
					>
						{isLoading ? "Saving..." : initialItem ? "Update" : "Save"}
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default AddStorageItemModal;
