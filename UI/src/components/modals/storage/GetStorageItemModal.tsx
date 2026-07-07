import React, { useState } from "react";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, labelClass, ModalError } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import { getStorageItem, Storage, StorageItem } from "../../../services/backend.storage";

interface GetStorageItemModalProps {
	isOpen: boolean;
	onClose: () => void;
	selectedStorage: Storage | null;
}

function GetStorageItemModal({ isOpen, onClose, selectedStorage }: GetStorageItemModalProps) {
	const [key, setKey] = useState("");
	const [result, setResult] = useState<StorageItem | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	useShiftEnterSubmit(() => handleGet(), isOpen && !isLoading && key.trim().length > 0);

	const handleGet = async () => {
		if (!selectedStorage) return;
		setIsLoading(true);
		setError("");
		setResult(null);
		try {
			const res = await getStorageItem(selectedStorage.name, key);
			if (res.status === "OK") setResult(res.data);
			else setError(res.message || "Item not found");
		} catch {
			setError("Failed to get item");
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => { setKey(""); setResult(null); setError(""); onClose(); };

	if (!isOpen || !selectedStorage) return null;

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Get Item by Key" isLoading={isLoading}>
			<div className="space-y-4">
				<div>
					<label className={labelClass}>Key</label>
					<input
						type="text"
						className={`${inputClass} font-mono`}
						placeholder="item-key"
						value={key}
						onChange={(e) => setKey(e.target.value)}
						disabled={isLoading}
						autoFocus
					/>
				</div>
				<ModalError message={error} />
				{result && (
					<div className="bg-background/40 border border-white/[0.07] rounded-lg p-4 space-y-2 font-mono text-sm">
						<div>
							<span className="text-muted text-xs">Key</span>
							<p className="text-primary">{result.key}</p>
						</div>
						<div>
							<span className="text-muted text-xs">Value</span>
							<p className="text-text break-all">{JSON.stringify(result.value)}</p>
						</div>
						<div>
							<span className="text-muted text-xs">Expires at</span>
							<p className="text-text/70">
								{result.expiresAt ? new Date(result.expiresAt).toLocaleString() : "Never"}
							</p>
						</div>
					</div>
				)}
				<div className="flex justify-end gap-3">
					<button onClick={handleClose} className={cancelBtnClass} disabled={isLoading}>
						Close
					</button>
					<button onClick={handleGet} disabled={isLoading || !key} className={primaryBtnClass}>
						Get Item
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default GetStorageItemModal;
