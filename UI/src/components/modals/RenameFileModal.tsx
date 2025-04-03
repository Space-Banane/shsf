import React, { useRef } from "react";
import Modal from "./Modal";

interface RenameFileModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentFileName: string;
    onRenameFile: (oldName: string, newName: string) => void;
}

function RenameFileModal({ 
    isOpen, 
    onClose, 
    currentFileName, 
    onRenameFile 
}: RenameFileModalProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = () => {
        const newFileName = inputRef.current?.value.trim();
        if (newFileName && newFileName !== currentFileName) {
            onRenameFile(currentFileName, newFileName);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Rename File">
            <div className="mb-4">
                <p className="text-gray-300 mb-2">
                    Current name: <span className="font-bold">{currentFileName}</span>
                </p>
                <label className="block text-gray-300 mb-2">New File Name</label>
                <input
                    ref={inputRef}
                    type="text"
                    className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
                    placeholder="new-name.py"
                    defaultValue={currentFileName}
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
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    onClick={handleSubmit}
                >
                    Rename
                </button>
            </div>
        </Modal>
    );
}

export default RenameFileModal;
