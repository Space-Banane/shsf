import React, { useState } from "react";
import Modal from "./Modal";

interface CreateNamespaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    namespaceName: string;
    setNamespaceName: React.Dispatch<React.SetStateAction<string>>;
    handleCreateNamespace: () => Promise<void>;
}

const CreateNamespaceModal: React.FC<CreateNamespaceModalProps> = ({
    isOpen,
    onClose,
    handleCreateNamespace,
}) => {
    const [namespaceName, setNamespaceName] = useState<string>("");

    const handleSubmit = () => {
        if (namespaceName.trim()) {
            handleCreateNamespace();
            setNamespaceName("");
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Namespace">
            <div className="mb-4">
                <label className="block text-gray-300 mb-2">Namespace Name</label>
                <input
                    type="text"
                    className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
                    value={namespaceName}
                    onChange={(e) => setNamespaceName(e.target.value)}
                    placeholder="Enter namespace name"
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
                    disabled={!namespaceName.trim()}
                >
                    Create
                </button>
            </div>
        </Modal>
    );
};

export default CreateNamespaceModal;
