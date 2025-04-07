import { useState } from "react";
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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl text-white font-bold mb-4">Delete Namespace</h2>
        
        <div className="mb-6">
          <p className="text-red-400 mb-2">⚠️ Warning: This action cannot be undone!</p>
          <p className="text-white">
            Are you sure you want to delete the namespace <span className="font-bold">{namespaceName}</span> and all its functions?
          </p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-900 text-white rounded-lg">
            {error}
          </div>
        )}
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-grayed hover:bg-grayed/70 text-white rounded-lg"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Namespace"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteNamespaceModal;
