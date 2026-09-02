import { useEffect, useState } from "react";
import Modal from "../Modal";
import {
	cancelBtnClass,
	inputClass,
	labelClass,
	ModalError,
	ModalFooter,
	primaryBtnClass,
} from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";

interface FolderModalProps {
	isOpen: boolean;
	mode: "create" | "rename";
	parentPath?: string;
	currentName?: string;
	onClose: () => void;
	onSubmit: (name: string) => Promise<boolean>;
}

function FolderModal({
	isOpen,
	mode,
	parentPath = "",
	currentName = "",
	onClose,
	onSubmit,
}: FolderModalProps) {
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setName(
				mode === "rename" ? (currentName.split("/").pop() ?? "") : "",
			);
			setError(null);
		}
	}, [currentName, isOpen, mode]);

	const handleSubmit = async () => {
		const trimmedName = name.trim();
		if (
			!trimmedName ||
			trimmedName.includes("/") ||
			trimmedName.includes("\\") ||
			trimmedName === "." ||
			trimmedName === ".."
		) {
			setError("Enter a single folder name without path separators.");
			return;
		}
		setIsLoading(true);
		try {
			if (await onSubmit(trimmedName)) onClose();
		} finally {
			setIsLoading(false);
		}
	};

	useShiftEnterSubmit(() => handleSubmit(), isOpen && !isLoading);

	return (
		<Modal
			isOpen={isOpen}
			onClose={() => !isLoading && onClose()}
			title={mode === "create" ? "Create Folder" : "Rename Folder"}
			isLoading={isLoading}
		>
			<div className="space-y-4">
				<ModalError message={error} />
				<div>
					<label className={labelClass}>Folder name</label>
					{mode === "create" && parentPath && (
						<p className="mb-1.5 font-mono text-xs text-muted">
							Inside {parentPath}
						</p>
					)}
					<input
						className={inputClass}
						autoFocus
						disabled={isLoading}
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="e.g., handlers"
					/>
				</div>
				<ModalFooter>
					<button
						className={cancelBtnClass}
						onClick={() => !isLoading && onClose()}
						disabled={isLoading}
					>
						Cancel
					</button>
					<button
						className={primaryBtnClass}
						onClick={handleSubmit}
						disabled={isLoading}
					>
						{mode === "create" ? "Create Folder" : "Rename Folder"}
					</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}

export default FolderModal;
