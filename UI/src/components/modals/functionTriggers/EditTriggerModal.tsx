import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, textareaClass, labelClass, ModalSection, ModalFooter, ToggleRow } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import { Trigger } from "../../../types/Prisma";
import { cronPresets as ImportedcronPresets } from "./CreateTriggerModal";
import TriggerPayloadEditor from "./TriggerPayloadEditor";
import { Icon } from "../../ui/Icon";

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
	onRun?: () => Promise<boolean>;
	trigger: Trigger | null;
}

function EditTriggerModal({ isOpen, onClose, onUpdate, onRun, trigger }: EditTriggerModalProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [cron, setCron] = useState("0 * * * *");
	const [data, setData] = useState("{}");
	const [enabled, setEnabled] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isPayloadValid, setIsPayloadValid] = useState(true);

	const cronPresets = ImportedcronPresets;

	useShiftEnterSubmit(() => handleSubmit(), isOpen && !isSubmitting);

	useEffect(() => {
		if (trigger) {
			setName(trigger.name);
			setDescription(trigger.description || "");
			setCron(trigger.cron);
			setData(trigger.data || "{}");
			setEnabled(trigger.enabled ?? true);
			setIsPayloadValid(true);
		}
	}, [trigger]);

	const handleSubmit = async () => {
		if (!name.trim() || !cron.trim()) { toast.error("Name and cron expression are required"); return; }
		if (!isPayloadValid) { toast.error("Fix the payload before updating the trigger"); return; }
		setIsSubmitting(true);
		try {
			const success = await onUpdate(name, description, cron, data, enabled);
			if (success) onClose();
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleRunNow = async () => {
		if (!trigger) { toast.error("No trigger selected"); return; }
		setIsSubmitting(true);
		try {
			await onRun?.();
		} finally {
			setIsSubmitting(false);
		}
	};

	const runNowBtnClass =
		"flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium rounded-lg hover:bg-green-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Edit Trigger" maxWidth="lg" isLoading={isSubmitting}>
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
								onClick={() => setCron(preset.value)}
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
						inputIdPrefix="edit-trigger-payload"
					/>
					<ToggleRow
						id="enabled-edit-trigger"
						checked={enabled}
						onChange={setEnabled}
						disabled={isSubmitting}
						label="Enable Trigger"
						description="Trigger will run automatically when enabled"
					/>
				</ModalSection>

				<ModalFooter>
					<button onClick={onClose} className={cancelBtnClass} disabled={isSubmitting}>
						Cancel
					</button>
					<button
						onClick={handleRunNow}
						className={runNowBtnClass}
						disabled={isSubmitting}
						aria-label="Run trigger now"
					>
						<Icon name="play" className="w-3.5 h-3.5" />
						Run Now
					</button>
					<button onClick={handleSubmit} className={primaryBtnClass} disabled={isSubmitting}>
						Update Trigger
					</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}

export default EditTriggerModal;
