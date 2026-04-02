import { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../Modal";
import { XFunction } from "../../../types/Prisma";
import { Link } from "react-router-dom";

export const cronPresets: { label: string; value: string }[] = [
	{ label: "Every minute", value: "* * * * *" },
	{ label: "Every hour", value: "0 * * * *" },
	{ label: "Every day at midnight", value: "0 0 * * *" },
	{ label: "Every Monday at 9 AM", value: "0 9 * * 1" },
	{ label: "Every weekday at 5 PM", value: "0 17 * * 1-5" },
	{ label: "Every Sunday at noon", value: "0 12 * * 0" },
	{ label: "Every first day of the month", value: "0 0 1 * *" },
	{ label: "Every last day of the month", value: "0 0 L * *" },
	{ label: "Every year on January 1st", value: "0 0 1 1 *" },
	{ label: "Every month on the 1st", value: "0 0 1 * *" },
];

interface CreateTriggerModalProps {
	isOpen: boolean;
	onClose: () => void;
	onCreate: (
		functionId: number,
		name: string,
		description: string,
		cron: string,
		data: string,
		enabled: boolean,
	) => Promise<boolean>;
	functions?: XFunction[]; // Optional: if provided, stage 1 will be function selection
	initialFunctionId?: number; // Optional: if provided, skips stage 1
}

function CreateTriggerModal({
	isOpen,
	onClose,
	onCreate,
	functions = [],
	initialFunctionId,
}: CreateTriggerModalProps) {
	const [step, setStep] = useState(initialFunctionId ? 2 : 1);
	const [selectedFunctionId, setSelectedFunctionId] = useState<number | null>(
		initialFunctionId || null,
	);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [cron, setCron] = useState("0 * * * *");
	const [data, setData] = useState("{}");
	const [enabled, setEnabled] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async () => {
		if (!selectedFunctionId) {
			toast.error("Please select a function first");
			return;
		}
		if (!name.trim() || !cron.trim()) {
			toast.error("Name and cron expression are required");
			return;
		}

		setIsSubmitting(true);
		try {
			const success = await onCreate(
				selectedFunctionId,
				name,
				description,
				cron,
				data,
				enabled,
			);
			if (success) {
				setName("");
				setDescription("");
				setCron("0 * * * *");
				setData("{}");
				setEnabled(true);
				setStep(initialFunctionId ? 2 : 1);
				onClose();
			}
		} catch (error) {
			console.error("Error creating trigger:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleNext = () => {
		if (!selectedFunctionId) {
			toast.error("Please select a function");
			return;
		}
		setStep(2);
	};

	const handleBack = () => {
		setStep(1);
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={step === 1 ? "Select Function" : "Configure Trigger"}
			maxWidth="lg"
			isLoading={isSubmitting}
		>
			<div className="space-y-6">
				{step === 1 ? (
					<div className="space-y-4">
						<div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-blue-300 text-sm mb-4">
							Select the function you want to create a trigger for.
						</div>
						<div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
							{functions.length === 0 ? (
								<div className="text-center py-12 bg-background/30 rounded-2xl border border-dashed border-primary/20 flex flex-col items-center gap-4">
									<div className="text-5xl opacity-40">🌙</div>
									<div className="space-y-1">
										<p className="text-text/60 font-medium">No functions found.</p>
										<p className="text-text/40 text-xs px-6">
											You need to create a serverless function before you can schedule a cron trigger.
										</p>
									</div>
									<Link
										to="/functions"
										className="mt-2 px-6 py-2 bg-primary/20 text-primary border border-primary/30 rounded-xl text-sm font-bold hover:bg-primary/30 transition-all duration-300 flex items-center gap-2 group"
										onClick={onClose}
									>
										<span>✨</span>
										Go create one
									</Link>
								</div>
							) : (
								functions.map((f) => (
									<button
										key={f.id}
										onClick={() => setSelectedFunctionId(f.id)}
										className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${
											selectedFunctionId === f.id
												? "bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(124,131,253,0.1)]"
												: "bg-background/40 border-primary/10 hover:border-primary/30 text-text/70"
										}`}
									>
										<span className="text-2xl opacity-80">ƒ</span>
										<div className="flex-1 text-left">
											<div className="font-bold">{f.name}</div>
											<div className="text-xs opacity-60 line-clamp-1">
												{f.description || "No description"}
											</div>
										</div>
										{selectedFunctionId === f.id && (
											<span className="text-xl">✅</span>
										)}
									</button>
								))
							)}
						</div>

						<div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-700/50">
							<button
								onClick={onClose}
								className="px-6 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg font-medium transition-all duration-300 border border-gray-600/50 hover:border-gray-500"
							>
								Cancel
							</button>
							<button
								onClick={handleNext}
								disabled={!selectedFunctionId}
								className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
							>
								Next Step ➔
							</button>
						</div>
					</div>
				) : (
					<div className="space-y-6 animate-fadeIn">
						{/* Basic Information */}
						<div className="space-y-4">
							<h3 className="text-sm font-semibold text-primary flex items-center gap-2">
								<span>⏰</span> Basic Information
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
								<p className="text-xs text-gray-400">
									Need help? Check out{" "}
									<a
										href="https://crontab.guru/"
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary hover:underline"
									>
										crontab.guru
									</a>
								</p>
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
											onClick={() => {
												setCron(preset.value);
												setName(preset.label);
											}}
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
											id="enabled-trigger"
										/>
										<label
											htmlFor="enabled-trigger"
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
						<div className="flex items-center justify-between pt-6 border-t border-gray-700/50">
							<button
								onClick={initialFunctionId ? onClose : handleBack}
								className="px-6 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg font-medium transition-all duration-300 border border-gray-600/50 hover:border-gray-500 flex items-center gap-2"
								disabled={isSubmitting}
							>
								{initialFunctionId ? "Cancel" : "← Back"}
							</button>
							<button
								onClick={handleSubmit}
								className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
								disabled={isSubmitting}
							>
								<span className="text-sm">⏰</span>
								Create Trigger
							</button>
						</div>
					</div>
				)}
			</div>
		</Modal>
	);
}

export default CreateTriggerModal;
