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
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Function" isLoading={isDeleting}>
      <div className="space-y-6">
        {/* Warning Message */}
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-red-400 text-lg">⚠️</span>
            <div>
              <p className="text-red-300 text-sm font-medium mb-2">Permanent Deletion Warning</p>
              <p className="text-red-200/80 text-xs leading-relaxed">
                This action cannot be undone. All function data, configurations, and associated files will be permanently removed.
              </p>
            </div>
          </div>
        </div>

        {/* Function Details */}
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-lg flex items-center justify-center">
              <span className="text-lg">🚀</span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Function to Delete</p>
              <p className="text-primary font-semibold">{functionName}</p>
            </div>
          </div>
        </div>

        {/* Confirmation Text */}
        <div className="text-center">
          <p className="text-gray-300 text-sm">
            Are you absolutely sure you want to delete{" "}
            <span className="font-semibold text-white">{functionName}</span>?
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
            Delete Function
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteFunctionModal;
