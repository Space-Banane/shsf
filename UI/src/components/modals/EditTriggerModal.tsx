import { useEffect, useState } from "react";
import Modal from "./Modal";
import { Trigger } from "../../types/Prisma";
import { cronPresets as ImportedcronPresets } from "./CreateTriggerModal";

interface EditTriggerModalProps {
	isOpen: boolean;
	onClose: () => void;
	onUpdate: (
		name: string,
		description: string,
		cron: string,
		data: string,
		enabled: boolean,
	) => Promise<boolean>;
	trigger: Trigger | null;
}

function EditTriggerModal({
	isOpen,
	onClose,
	onUpdate,
	trigger,
}: EditTriggerModalProps) {
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
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Edit Trigger"
			maxWidth="lg"
			isLoading={isSubmitting}
		>
			<div className="space-y-6">
				{/* Basic Information */}
				<div className="space-y-4">
					<h3 className="text-sm font-semibold text-primary flex items-center gap-2">
						<span>✏️</span> Basic Information
					</h3>

					<div className="grid grid-cols-1 gap-4">
						<div className="space-y-2">
							<label className="flex items-center gap-2 text-sm font-medium text-gray-300">
								<span className="text-lg">🏷️</span>
								Trigger Name
							</label>
							<input
								type="text"
								placeholder="Enter trigger name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
								disabled={isSubmitting}
							/>
						</div>

						<div className="space-y-2">
							<label className="flex items-center gap-2 text-sm font-medium text-gray-300">
								<span className="text-lg">📝</span>
								Description
							</label>
							<textarea
								placeholder="Brief description of what this trigger does..."
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 resize-none"
								rows={2}
								disabled={isSubmitting}
							/>
						</div>
					</div>
				</div>

				{/* Schedule Configuration */}
				<div className="space-y-4">
					<h3 className="text-sm font-semibold text-primary flex items-center gap-2">
						<span>⏱️</span> Schedule Configuration
					</h3>

					<div className="space-y-2">
						<label className="flex items-center gap-2 text-sm font-medium text-gray-300">
							<span className="text-lg">🔄</span>
							Cron Expression
						</label>
						<input
							type="text"
							placeholder="*/5 * * * *"
							value={cron}
							onChange={(e) => setCron(e.target.value)}
							className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 font-mono"
							disabled={isSubmitting}
						/>
					</div>

					{/* Preset Buttons */}
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-300">Quick Presets</label>
						<div className="grid grid-cols-2 md:grid-cols-3 gap-2">
							{cronPresets.map((preset) => (
								<button
									key={preset.value}
									type="button"
									className="p-2 text-xs bg-gray-700/50 hover:bg-gray-700 border border-gray-600/50 hover:border-primary/30 text-gray-300 hover:text-white rounded-lg transition-all duration-300"
									onClick={() => setCron(preset.value)}
									disabled={isSubmitting}
								>
									{preset.label}
								</button>
							))}
						</div>
					</div>
				</div>

				{/* Data & Settings */}
				<div className="space-y-4">
					<h3 className="text-sm font-semibold text-primary flex items-center gap-2">
						<span>⚙️</span> Data & Settings
					</h3>

					<div className="space-y-2">
						<label className="flex items-center gap-2 text-sm font-medium text-gray-300">
							<span className="text-lg">📊</span>
							Payload Data (JSON)
						</label>
						<textarea
							placeholder='{"key": "value"}'
							value={data}
							onChange={(e) => setData(e.target.value)}
							className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 font-mono resize-none"
							rows={4}
							disabled={isSubmitting}
						/>
					</div>

					{/* Enable Toggle */}
					<div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<span className="text-lg">🔛</span>
								<div>
									<p className="text-white font-medium text-sm">Enable Trigger</p>
									<p className="text-gray-400 text-xs">
										Trigger will run automatically when enabled
									</p>
								</div>
							</div>
							<div className="relative">
								<input
									type="checkbox"
									checked={enabled}
									onChange={(e) => setEnabled(e.target.checked)}
									className="sr-only peer"
									disabled={isSubmitting}
									id="enabled-edit-trigger"
								/>
								<label
									htmlFor="enabled-edit-trigger"
									className="w-12 h-6 bg-gray-600 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-green-500 peer-checked:to-blue-500 transition-all duration-300 cursor-pointer flex items-center relative"
								>
									<div
										className={`absolute w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${enabled ? "translate-x-6" : "translate-x-0.5"}`}
									></div>
								</label>
							</div>
						</div>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-700/50">
					<button
						onClick={onClose}
						className="px-6 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg font-medium transition-all duration-300 border border-gray-600/50 hover:border-gray-500"
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
						disabled={isSubmitting}
					>
						<span className="text-sm">✏️</span>
						Update Trigger
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default EditTriggerModal;
