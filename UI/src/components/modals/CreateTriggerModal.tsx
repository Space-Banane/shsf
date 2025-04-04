import { useState } from "react";
import Modal from "./Modal";

interface CreateTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, cron: string, data: string) => Promise<boolean>;
}

function CreateTriggerModal({ isOpen, onClose, onCreate }: CreateTriggerModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cron, setCron] = useState("0 * * * *");
  const [data, setData] = useState("{}");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cronPresets = [
    { label: "Every minute", value: "* * * * *" },
    { label: "Every hour", value: "0 * * * *" },
    { label: "Every day at midnight", value: "0 0 * * *" },
    { label: "Every Monday at 9 AM", value: "0 9 * * 1" },
    { label: "Every month on the 1st", value: "0 0 1 * *" },
  ];

  const handleSubmit = async () => {
    if (!name.trim() || !cron.trim()) {
      alert("Name and cron expression are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onCreate(name, description, cron, data);
      if (success) {
        setName("");
        setDescription("");
        setCron("0 * * * *");
        setData("{}");
        onClose();
      }
    } catch (error) {
      console.error("Error creating trigger:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Trigger">
      <div className="space-y-4">
        <div>
          <label className="block text-white mb-1">Name:</label>
          <input
            className="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter trigger name"
          />
        </div>
        
        <div>
          <label className="block text-white mb-1">Description:</label>
          <textarea
            className="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter trigger description"
            rows={2}
          />
        </div>
        
        <div>
          <label className="block text-white mb-1">Cron Expression:</label>
          <input
            className="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            placeholder="*/5 * * * *"
          />
          <div className="mt-2">
            <label className="block text-white mb-1 text-sm">Presets:</label>
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
          <label className="block text-white mb-1">Data (JSON):</label>
          <textarea
            className="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            value={data}
            onChange={(e) => setData(e.target.value)}
            placeholder="{}"
            rows={4}
          />
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Trigger"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default CreateTriggerModal;
