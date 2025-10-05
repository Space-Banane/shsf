import { useState } from "react";
import Modal from "./Modal";
import { deleteNamespace } from "../../services/backend.namespaces";

interface DeleteNamespaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  namespaceId: number | null;
  namespaceName: string;
}

function DeleteNamespaceModal({ isOpen, onClose, onDelete, namespaceId, namespaceName }: DeleteNamespaceModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!namespaceId) return;
    
    setIsDeleting(true);
    setError(null);
    
    try {
      const response = await deleteNamespace(namespaceId);
      
      if (response.status === "OK") {
        onDelete();
        onClose();
      } else {
        setError(response.message || "Failed to delete namespace");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Namespace" isLoading={isDeleting}>
      <div className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-red-400 text-lg">⚠️</span>
              <p className="text-red-300 text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Warning Message */}
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-red-400 text-lg">⚠️</span>
            <div>
              <p className="text-red-300 text-sm font-medium mb-2">Critical Action Warning</p>
              <p className="text-red-200/80 text-xs leading-relaxed">
                This will permanently delete the namespace and ALL functions within it. This action cannot be undone.
              </p>
            </div>
          </div>
        </div>

        {/* Namespace Details */}
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-lg flex items-center justify-center">
              <span className="text-lg">📁</span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Namespace to Delete</p>
              <p className="text-primary font-semibold">{namespaceName}</p>
            </div>
          </div>
        </div>

        {/* Confirmation Text */}
        <div className="text-center">
          <p className="text-gray-300 text-sm">
            Are you absolutely sure you want to delete{" "}
            <span className="font-semibold text-white">{namespaceName}</span>{" "}
            and all its functions?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700/50">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg font-medium transition-all duration-300 border border-gray-600/50 hover:border-gray-500"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={isDeleting}
          >
            <span className="text-sm">🗑️</span>
            Delete Namespace
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default DeleteNamespaceModal;
