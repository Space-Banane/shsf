import React, { useState } from "react";
import Modal from "./Modal";

interface CreateFileModalProps {
	isOpen: boolean;
	onClose: () => void;
	onCreate: (filename: string, content: string) => Promise<boolean>;
}

function CreateFileModal({ isOpen, onClose, onCreate }: CreateFileModalProps) {
	const [filename, setFilename] = useState("");
	const [content, setContent] = useState("Hello World!");
	const [isLoading, setIsLoading] = useState(false);

	const handleCreate = async () => {
		if (!filename.trim()) {
			alert("Please enter a filename");
			return;
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
			onClose();
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Create File" isLoading={isLoading}>
			<div className="space-y-1 mb-4">
				<label className="text-sm text-gray-300" title="Name of the file to create">Filename</label>
				<input
					type="text"
					placeholder="Filename"
					value={filename}
					onChange={(e) => setFilename(e.target.value)}
					className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md"
				/>
			</div>
			<div className="space-y-1 mb-4 hidden">
				<label className="text-sm text-gray-300" title="Initial content of the file">File Content</label>
				<textarea
					placeholder="File content"
					value={content}
					onChange={(e) => setContent(e.target.value)}
					className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md min-h-[100px]"
				/>
			</div>
			<div className="flex justify-end mt-4">
				<button 
					className="bg-gray-500 text-white px-4 py-2 rounded-md mr-2" 
					onClick={handleClose}
					disabled={isLoading}
				>
					Cancel
				</button>
				<button 
					className="bg-green-500 text-white px-4 py-2 rounded-md" 
					onClick={handleCreate}
					disabled={isLoading}
				>
					Create
				</button>
			</div>
		</Modal>
	);
}

export default CreateFileModal;
