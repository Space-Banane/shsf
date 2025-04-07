import { useEffect, useState } from "react";
import Modal from "./Modal";
import { Trigger } from "../../types/Prisma";
import { cronPresets as ImportedcronPresets } from "./CreateTriggerModal";

interface EditTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (name: string, description: string, cron: string, data: string, enabled: boolean) => Promise<boolean>;
  trigger: Trigger | null;
}

function EditTriggerModal({ isOpen, onClose, onUpdate, trigger }: EditTriggerModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cron, setCron] = useState("0 * * * *");
  const [data, setData] = useState("{}");
  const [enabled, setEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cronPresets = ImportedcronPresets;

  useEffect(() => {
    if (trigger) {
      setName(trigger.name);
      setDescription(trigger.description || "");
      setCron(trigger.cron);
      setData(trigger.data || "{}");
      setEnabled(trigger.enabled ?? true);
    }
  }, [trigger]);

  const handleSubmit = async () => {
    if (!name.trim() || !cron.trim()) {
      alert("Name and cron expression are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onUpdate(name, description, cron, data, enabled);
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error("Error updating trigger:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Trigger">
      <div className="space-y-4">
        <div>
          <label className="block text-base text-white mb-1">Name:</label>
          <input
            className="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter trigger name"
          />
        </div>
        
        <div>
          <label className="block text-base text-white mb-1">Description:</label>
          <textarea
            className="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter trigger description"
            rows={2}
          />
        </div>
        
        <div>
          <label className="block text-base text-white mb-1">Cron Expression:</label>
          <input
            className="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            placeholder="*/5 * * * *"
          />
          <div className="mt-2">
            <label className="block text-base text-white mb-1">Presets:</label>
            <div className="flex flex-wrap gap-2">
              {cronPresets.map((preset) => (
                <button
                  key={preset.value}
                  className="bg-gray-600 hover:bg-gray-500 text-white text-xs py-1 px-2 rounded"
                  onClick={() => setCron(preset.value)}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-base text-white mb-1">Data (JSON):</label>
          <textarea
            className="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            value={data}
            onChange={(e) => setData(e.target.value)}
            placeholder="{}"
            rows={4}
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
          />
          <label htmlFor="enabled" className="ml-2 text-white">
            Enabled
          </label>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button
            className="bg-grayed hover:bg-grayed/70 text-white px-4 py-2 rounded"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="bg-primary hover:bg-primary/70 text-white px-4 py-2 rounded"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Updating..." : "Update Trigger"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default EditTriggerModal;
