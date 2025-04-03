import React, { useState } from "react";
import Modal from "./Modal";

interface NewFileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateFile: (fileName: string) => void;
}

function NewFileModal({ isOpen, onClose, onCreateFile }: NewFileModalProps) {
    const [newFileName, setNewFileName] = useState<string>("");

    const handleSubmit = () => {
        if (newFileName.trim()) {
            onCreateFile(newFileName);
            setNewFileName("");
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New File">
            <div className="mb-4">
                <label className="block text-gray-300 mb-2">File Name</label>
                <input
                    type="text"
                    className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="example.py"
                />
            </div>
            <div className="flex justify-end space-x-3">
                <button
                    type="button"
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    onClick={onClose}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    onClick={handleSubmit}
                    disabled={!newFileName.trim()}
                >
                    Create File
                </button>
            </div>
        </Modal>
    );
}

export default NewFileModal;
