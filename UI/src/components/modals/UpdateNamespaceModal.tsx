import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { NamespaceData } from "../../services/backend.service";

interface UpdateNamespaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    namespaceData: NamespaceData | null;
    onUpdateNamespace: (updatedData: Partial<NamespaceData>) => void;
}

function UpdateNamespaceModal({ 
    isOpen, 
    onClose, 
    namespaceData, 
    onUpdateNamespace 
}: UpdateNamespaceModalProps) {
    const [name, setName] = useState<string>("");

    useEffect(() => {
        if (namespaceData) {
            setName(namespaceData.name || "");
        }
    }, [namespaceData, isOpen]);

    const handleSubmit = () => {
        if (!name.trim()) {
            alert("Namespace name cannot be empty");
            return;
        }
        onUpdateNamespace({
            name
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Update Namespace">
            <div className="mb-4">
                <label className="block text-gray-300 mb-2">Namespace Name</label>
                <input
                    type="text"
                    className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Namespace name"
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
                    disabled={!name.trim()}
                >
                    Update Namespace
                </button>
            </div>
        </Modal>
    );
}

export default UpdateNamespaceModal;
