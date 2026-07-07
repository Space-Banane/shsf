import { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, textareaClass, labelClass, ModalSection, ModalFooter, ToggleRow } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import { XFunction } from "../../../types/Prisma";
import { Link } from "react-router-dom";
import TriggerPayloadEditor from "./TriggerPayloadEditor";

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
	functions?: XFunction[];
	initialFunctionId?: number;
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
	const [isPayloadValid, setIsPayloadValid] = useState(true);

	useShiftEnterSubmit(() => {
		if (step === 1) handleNext();
		else handleSubmit();
	}, isOpen && !isSubmitting);

	const handleSubmit = async () => {
		if (!selectedFunctionId) { toast.error("Please select a function first"); return; }
		if (!name.trim() || !cron.trim()) { toast.error("Name and cron expression are required"); return; }
		if (!isPayloadValid) { toast.error("Fix the payload before creating the trigger"); return; }

		setIsSubmitting(true);
		try {
			const success = await onCreate(selectedFunctionId, name, description, cron, data, enabled);
			if (success) {
				setName(""); setDescription(""); setCron("0 * * * *"); setData("{}");
				setEnabled(true); setIsPayloadValid(true);
				setStep(initialFunctionId ? 2 : 1);
				onClose();
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleNext = () => {
		if (!selectedFunctionId) { toast.error("Please select a function"); return; }
		setStep(2);
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={step === 1 ? "Select Function" : "Configure Trigger"}
			maxWidth="lg"
			isLoading={isSubmitting}
		>
			{step === 1 ? (
				<div className="space-y-4">
					<p className="text-xs text-muted">
						Select the function you want to create a trigger for.
					</p>
					<div className="space-y-1.5 max-h-80 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
						{functions.length === 0 ? (
							<div className="text-center py-10 border border-white/[0.07] rounded-lg border-dashed">
								<p className="text-sm text-text/60 font-medium">No functions found.</p>
								<p className="text-xs text-muted mt-1 mb-4">
									Create a serverless function before scheduling a trigger.
								</p>
								<Link
									to="/functions"
									className="px-4 py-2 bg-primary/10 border border-primary/20 text-primary text-sm rounded-lg hover:bg-primary/20 transition-colors"
									onClick={onClose}
								>
									Go create one
								</Link>
							</div>
						) : (
							functions.map((f) => (
								<button
									key={f.id}
									onClick={() => setSelectedFunctionId(f.id)}
									className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
										selectedFunctionId === f.id
											? "bg-primary/10 border-primary/30 text-primary"
											: "bg-background/40 border-white/[0.07] hover:border-white/[0.14] text-text/70 hover:text-text"
									}`}
								>
									<span className="text-text/40 font-mono text-lg shrink-0">ƒ</span>
									<div className="flex-1 min-w-0">
										<div className="text-sm font-medium">{f.name}</div>
										<div className="text-xs text-muted truncate">
											{f.description || "No description"}
										</div>
									</div>
								</button>
							))
						)}
					</div>
					<ModalFooter>
						<button onClick={onClose} className={cancelBtnClass}>Cancel</button>
						<button
							onClick={handleNext}
							disabled={!selectedFunctionId}
							className={primaryBtnClass}
						>
							Next
						</button>
					</ModalFooter>
				</div>
			) : (
				<div className="space-y-6">
					<ModalSection title="Basic Information">
						<div>
							<label className={labelClass}>Trigger name</label>
							<input
								type="text"
								placeholder="e.g., nightly-sync"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className={inputClass}
								disabled={isSubmitting}
							/>
						</div>
						<div>
							<label className={labelClass}>Description</label>
							<textarea
								placeholder="Brief description of what this trigger does…"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								className={textareaClass}
								rows={2}
								disabled={isSubmitting}
							/>
						</div>
					</ModalSection>

					<ModalSection title="Schedule">
						<div>
							<label className={labelClass}>Cron expression</label>
							<input
								type="text"
								placeholder="0 * * * *"
								value={cron}
								onChange={(e) => setCron(e.target.value)}
								className={`${inputClass} font-mono`}
								disabled={isSubmitting}
							/>
							<p className="mt-1.5 text-xs text-muted">
								Need help?{" "}
								<a href="https://crontab.guru/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
									crontab.guru
								</a>
							</p>
						</div>
						<div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
							{cronPresets.map((preset) => (
								<button
									key={`${preset.value}-${preset.label}`}
									type="button"
									className="px-2 py-1.5 text-xs border border-white/[0.07] text-muted hover:text-text hover:bg-white/[0.04] rounded-lg transition-colors text-left"
									onClick={() => { setCron(preset.value); setName(preset.label); }}
									disabled={isSubmitting}
								>
									{preset.label}
								</button>
							))}
						</div>
					</ModalSection>

					<ModalSection title="Data & Settings">
						<TriggerPayloadEditor
							value={data}
							onChange={setData}
							onValidityChange={setIsPayloadValid}
							disabled={isSubmitting}
							inputIdPrefix="create-trigger-payload"
						/>
						<ToggleRow
							id="enabled-trigger"
							checked={enabled}
							onChange={setEnabled}
							disabled={isSubmitting}
							label="Enable Trigger"
							description="Trigger will run automatically when enabled"
						/>
					</ModalSection>

					<ModalFooter>
						<button
							onClick={initialFunctionId ? onClose : () => setStep(1)}
							className={cancelBtnClass}
							disabled={isSubmitting}
						>
							{initialFunctionId ? "Cancel" : "Back"}
						</button>
						<button onClick={handleSubmit} className={primaryBtnClass} disabled={isSubmitting}>
							Create Trigger
						</button>
					</ModalFooter>
				</div>
			)}
		</Modal>
	);
}

export default CreateTriggerModal;
