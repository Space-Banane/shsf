import React, { useState } from "react";
import Modal from "./Modal";

interface CreateFileModalProps {
	isOpen: boolean;
	onClose: () => void;
	onCreate: (filename: string, content: string) => Promise<boolean>;
	allowedFileTypes?: string[];
}

function CreateFileModal({ isOpen, onClose, onCreate, allowedFileTypes }: CreateFileModalProps) {
	const [filename, setFilename] = useState("");
	const [content, setContent] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const lowerCaseAllowedFileTypes = React.useMemo(
		() => allowedFileTypes?.map(e => e.toLowerCase()) ?? [],
		[allowedFileTypes]
	);

	const getFileExtension = (name: string) => {
		const idx = name.lastIndexOf(".");
		return idx !== -1 ? name.slice(idx + 1).toLowerCase() : "";
	};

	const handleCreate = async () => {
		setError(null);
		if (!filename.trim()) {
			setError("Please enter a filename");
			return;
		}
		if (
			allowedFileTypes &&
			allowedFileTypes.length > 0
		) {
			const ext = getFileExtension(filename);
			if (!lowerCaseAllowedFileTypes.includes(ext)) {
				setError(
					`File type .${ext || "(none)"} is not allowed. Allowed: ${allowedFileTypes.join(", ")}`
				);
				return;
			}
		}
		setIsLoading(true);
		try {
			const success = await onCreate(filename, content);
			if (success) {
				setFilename("");
				setContent("");
				onClose();
			}
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		if (!isLoading) {
			setError(null);
			onClose();
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Create File" isLoading={isLoading}>
			<div className="space-y-6">
				{/* Filename Input */}
				<div className="space-y-2">
					<label className="flex items-center gap-2 text-sm font-medium text-gray-300">
						<span className="text-lg">📄</span>
						Filename
					</label>
					<input
						type="text"
						placeholder={allowedFileTypes ? `Enter filename (e.g., ${allowedFileTypes.join(", ")})` : "Enter file name (eg. main.py)"}
						value={filename}
						onChange={(e) => setFilename(e.target.value)}
						className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
					/>
					{allowedFileTypes && allowedFileTypes.length > 0 && (
						<div className="text-xs text-gray-400">
							Allowed types: {allowedFileTypes.join(", ")}
						</div>
					)}
					{error && (
						<div className="text-xs text-red-400">{error}</div>
					)}
				</div>

				{/* Content Input (Hidden) */}
				<div className="space-y-2 hidden">
					<label className="flex items-center gap-2 text-sm font-medium text-gray-300">
						<span className="text-lg">📝</span>
						File Content
					</label>
					<textarea
						placeholder="Initial file content..."
						value={content}
						onChange={(e) => setContent(e.target.value)}
						className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 min-h-[120px] resize-none"
					/>
				</div>

				{/* Action Buttons */}
				<div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700/50">
					<button 
						className="px-6 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg font-medium transition-all duration-300 border border-gray-600/50 hover:border-gray-500" 
						onClick={handleClose}
						disabled={isLoading}
					>
						Cancel
					</button>
					<button 
						className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" 
						onClick={handleCreate}
						disabled={isLoading}
					>
						<span className="text-sm">📄</span>
						Create File
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default CreateFileModal;