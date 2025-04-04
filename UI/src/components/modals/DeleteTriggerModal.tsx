import Modal from "./Modal";

interface DeleteTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => Promise<boolean>;
  triggerName: string;
}

function DeleteTriggerModal({ isOpen, onClose, onDelete, triggerName }: DeleteTriggerModalProps) {
  const handleDelete = async () => {
    try {
      const success = await onDelete();
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error("Error deleting trigger:", error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Trigger">
      <div>
        <p className="text-white mb-4">
          Are you sure you want to delete the trigger "{triggerName}"?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default DeleteTriggerModal;
