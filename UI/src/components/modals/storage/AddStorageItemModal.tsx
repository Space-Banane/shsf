import React, { useState } from "react";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, textareaClass, labelClass, ModalError, ModalFooter } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
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

	useShiftEnterSubmit(
		() => {
			let parsed = value;
			try { parsed = JSON.parse(value); } catch { /* use string value */ }
			handleSubmit(parsed);
		},
		isOpen && !isLoading && key.trim().length > 0,
	);

	React.useEffect(() => {
		if (!isOpen) return;
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
			const payload: any = { key, value: parsedValue !== undefined ? parsedValue : value };
			if (expiresAt) payload.expiresAt = expiresAt;
			const res = await setStorageItem(selectedStorage.name, payload);
			if (res.status === "OK") {
				setKey(""); setValue(""); setExpiresAt("");
				onSuccess();
				handleClose();
			} else {
				setError(res.message || "Failed to set item");
			}
		} catch {
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
			isLoading={isLoading}
		>
			<div className="space-y-4">
				<ModalError message={error} />
				<div>
					<label className={labelClass}>Key</label>
					<input
						type="text"
						className={`${inputClass} font-mono`}
						placeholder="item-key"
						value={key}
						onChange={(e) => setKey(e.target.value)}
						disabled={isLoading || Boolean(initialItem)}
					/>
				</div>
				<div>
					<label className={labelClass}>Value (JSON or string)</label>
					<textarea
						className={`${textareaClass} font-mono`}
						placeholder='{"hello": "world"}'
						value={value}
						onChange={(e) => setValue(e.target.value)}
						disabled={isLoading}
						rows={3}
					/>
				</div>
				<div>
					<div className="flex items-center justify-between mb-1.5">
						<label className={labelClass.replace("mb-1.5", "")}>Expires at (optional)</label>
						<button
							type="button"
							className="text-xs text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
							onClick={() => setExpiresAt("")}
							disabled={isLoading || !expiresAt}
						>
							Clear
						</button>
					</div>
					<input
						type="datetime-local"
						className={`${inputClass} font-mono`}
						value={expiresAt}
						onChange={(e) => setExpiresAt(e.target.value)}
						disabled={isLoading}
					/>
				</div>
				<ModalFooter>
					<button onClick={handleClose} className={cancelBtnClass} disabled={isLoading}>
						Cancel
					</button>
					<button
						onClick={() => {
							let parsed = value;
							try { parsed = JSON.parse(value); } catch { /* use string value */ }
							handleSubmit(parsed);
						}}
						disabled={isLoading || !key}
						className={primaryBtnClass}
					>
						{initialItem ? "Update" : "Save"}
					</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}

export default AddStorageItemModal;
