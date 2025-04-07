import React from "react";
import Modal from "./Modal";

interface DeleteFunctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: (functionId: number) => Promise<boolean>;
  functionId: number | null;
  functionName: string;
}

function DeleteFunctionModal({
  isOpen,
  onClose,
  onDelete,
  functionId,
  functionName,
}: DeleteFunctionModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!functionId) return;
    
    setIsDeleting(true);
    try {
      const success = await onDelete(functionId);
      if (success) {
        onClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Function">
      <div className="p-4">
        <p className="mb-4">
          Are you sure you want to delete function <strong>{functionName}</strong>?
          This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-2">
          <button
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteFunctionModal;
