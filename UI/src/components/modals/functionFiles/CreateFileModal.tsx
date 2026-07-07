import React, { useState } from "react";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, labelClass, ModalError, ModalFooter } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";

interface CreateFileModalProps {
	isOpen: boolean;
	onClose: () => void;
	onCreate: (filename: string, content: string) => Promise<boolean>;
	allowedFileTypes?: string[];
}

function CreateFileModal({ isOpen, onClose, onCreate, allowedFileTypes }: CreateFileModalProps) {
	const [filename, setFilename] = useState("");
	const [content] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const lowerCaseAllowedFileTypes = React.useMemo(
		() => allowedFileTypes?.map((e) => e.toLowerCase()) ?? [],
		[allowedFileTypes],
	);

	const getFilenameExtension = (name: string) => {
		const idx = name.lastIndexOf(".");
		return idx !== -1 ? name.slice(idx).toLowerCase() : "";
	};

	const handleCreate = async () => {
		setError(null);
		if (!filename.trim()) { setError("Please enter a filename"); return; }
		if (allowedFileTypes && allowedFileTypes.length > 0) {
			const ext = getFilenameExtension(filename);
			if (!lowerCaseAllowedFileTypes.includes(ext)) {
				setError(`File type ${ext || "(none)"} is not allowed. Allowed: ${allowedFileTypes.join(", ")}`);
				return;
			}
		}
		setIsLoading(true);
		try {
			const success = await onCreate(filename, content);
			if (success) { setFilename(""); onClose(); }
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => { if (!isLoading) { setError(null); onClose(); } };

	useShiftEnterSubmit(() => handleCreate(), isOpen && !isLoading);

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Create File" isLoading={isLoading}>
			<div className="space-y-4">
				<ModalError message={error} />
				<div>
					<label className={labelClass}>Filename</label>
					<input
						type="text"
						placeholder={
							allowedFileTypes
								? `e.g., ${allowedFileTypes.join(", ")}`
								: "e.g., main.py"
						}
						value={filename}
						onChange={(e) => setFilename(e.target.value)}
						className={inputClass}
						autoFocus
					/>
					{allowedFileTypes && allowedFileTypes.length > 0 && (
						<p className="mt-1.5 text-xs text-muted">
							Allowed types: {allowedFileTypes.join(", ")}
						</p>
					)}
				</div>
				<ModalFooter>
					<button className={cancelBtnClass} onClick={handleClose} disabled={isLoading}>
						Cancel
					</button>
					<button className={primaryBtnClass} onClick={handleCreate} disabled={isLoading}>
						Create File
					</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}

export default CreateFileModal;
