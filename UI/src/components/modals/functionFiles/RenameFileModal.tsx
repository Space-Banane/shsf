import React, { useState, useEffect, useMemo } from "react";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, labelClass, ModalFooter } from "../Modal";
import { toast } from "react-toastify";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";

interface RenameFileModalProps {
	isOpen: boolean;
	onClose: () => void;
	onRename: (newFilename: string) => Promise<boolean>;
	currentFilename: string;
	allowedFileTypes?: string[];
}

function RenameFileModal({
	isOpen,
	onClose,
	onRename,
	currentFilename,
	allowedFileTypes,
}: RenameFileModalProps) {
	const [newFilename, setNewFilename] = useState(currentFilename);
	const [isLoading, setIsLoading] = useState(false);
	const lowerCaseAllowedFileTypes = useMemo(
		() => allowedFileTypes?.map((e) => e.toLowerCase()) ?? [],
		[allowedFileTypes],
	);

	useShiftEnterSubmit(() => handleRename(), isOpen && !isLoading);

	const getFilenameExtension = (name: string) => {
		const idx = name.lastIndexOf(".");
		return idx !== -1 ? name.slice(idx).toLowerCase() : "";
	};

	useEffect(() => {
		if (isOpen) setNewFilename(currentFilename);
	}, [isOpen, currentFilename]);

	const handleRename = async () => {
		if (!newFilename.trim() || newFilename.trim().length < 3) {
			toast.error("Filename must be at least 3 characters long.");
			return;
		}
		if (newFilename === currentFilename) { onClose(); return; }
		if (allowedFileTypes && allowedFileTypes.length > 0) {
			const ext = getFilenameExtension(newFilename);
			if (!lowerCaseAllowedFileTypes.includes(ext)) {
				toast.error(
					`File type ${ext || "(none)"} is not allowed. Allowed: ${allowedFileTypes.join(", ")}`,
				);
				return;
			}
		}
		setIsLoading(true);
		try {
			const success = await onRename(newFilename);
			if (success) onClose();
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => { if (!isLoading) onClose(); };

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Rename File" isLoading={isLoading}>
			<div className="space-y-4">
				<div>
					<label className={labelClass}>New filename</label>
					<input
						type="text"
						placeholder="Enter new filename"
						value={newFilename}
						onChange={(e) => setNewFilename(e.target.value)}
						className={`${inputClass} font-mono`}
						disabled={isLoading}
						autoFocus
					/>
					{allowedFileTypes && allowedFileTypes.length > 0 && (
						<p className="mt-1.5 text-xs text-muted">
							Allowed types: {allowedFileTypes.join(", ")}
						</p>
					)}
				</div>
				<ModalFooter>
					<button onClick={handleClose} className={cancelBtnClass} disabled={isLoading}>
						Cancel
					</button>
					<button onClick={handleRename} className={primaryBtnClass} disabled={isLoading}>
						Rename
					</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}

export default RenameFileModal;
