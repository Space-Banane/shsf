import { useEffect, useState } from "react";
import Modal from "./Modal";

export function EditTokenModal({
  isOpen,
  onClose,
  onSave,
  initialName,
  initialPurpose,
  loading,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, purpose: string) => void;
  initialName: string;
  initialPurpose: string;
  loading: boolean;
  error: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [purpose, setPurpose] = useState(initialPurpose);

  // Reset fields when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setPurpose(initialPurpose);
    }
  }, [isOpen, initialName, initialPurpose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Access Token" isLoading={loading}>
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <span className="text-lg">🔑</span>
            Token Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 font-mono"
            maxLength={128}
            minLength={2}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <span className="text-lg">📝</span>
            Purpose
          </label>
          <textarea
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 font-mono"
            maxLength={512}
            rows={2}
            disabled={loading}
            placeholder="Purpose (optional)"
          />
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700/50">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg font-medium transition-all duration-300 border border-gray-600/50 hover:border-gray-500"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(name, purpose)}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={loading || name.trim().length < 2}
          >
            <span className="text-sm">💾</span>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}