import { useState, useEffect } from "react";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, ModalFooter } from "../Modal";
import { Icon } from "../../ui/Icon";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";

interface EnvironmentVariable {
	name: string;
	value: string;
}

interface UpdateEnvModalProps {
	isOpen: boolean;
	onClose: () => void;
	onUpdate: (env: EnvironmentVariable[]) => Promise<boolean>;
	envString: string;
}

function UpdateEnvModal({ isOpen, onClose, onUpdate, envString }: UpdateEnvModalProps) {
	const [variables, setVariables] = useState<EnvironmentVariable[]>([]);
	const [loading, setLoading] = useState(false);

	useShiftEnterSubmit(() => handleSubmit(), isOpen && !loading);

	useEffect(() => {
		if (envString) {
			try {
				setVariables(JSON.parse(envString));
			} catch {
				const vars: EnvironmentVariable[] = [];
				envString.split(", ").forEach((pair) => {
					if (pair.trim()) {
						const [name, value] = pair.split("=");
						if (name && value !== undefined) vars.push({ name, value });
					}
				});
				setVariables(vars);
			}
		} else {
			setVariables([]);
		}
	}, [envString, isOpen]);

	const handleAddVariable = () => setVariables([...variables, { name: "", value: "" }]);
	const handleRemoveVariable = (index: number) => setVariables(variables.filter((_, i) => i !== index));
	const handleVariableChange = (index: number, field: "name" | "value", value: string) => {
		setVariables(variables.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
	};

	const handleSubmit = async () => {
		setLoading(true);
		try {
			const success = await onUpdate(variables.filter((v) => v.name.trim() !== ""));
			if (success) onClose();
		} finally {
			setLoading(false);
		}
	};

	const inputCls =
		"flex-1 px-2.5 py-1.5 bg-background border border-white/[0.07] rounded-lg text-text text-sm focus:border-primary/50 focus:outline-none placeholder:text-muted/60 font-mono";

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Environment Variables"
			maxWidth="lg"
			isLoading={loading}
		>
			<div className="space-y-5">
				<p className="text-xs text-muted">
					Configure environment variables accessible during function runtime — useful for API keys,
					database URLs, and other configuration values.
				</p>
				<p className="text-xs text-muted/70">
					Account-wide variables from the Account page are also available automatically. If the same key exists in both places, this function's value overrides the account-wide one.
				</p>

				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-muted uppercase tracking-wider">
							Variables ({variables.length})
						</span>
						<button
							onClick={handleAddVariable}
							className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary text-xs font-medium rounded-lg hover:bg-primary/20 transition-colors"
						>
							<Icon name="plus" className="w-3 h-3" />
							Add Variable
						</button>
					</div>

					<div className="space-y-2 max-h-96 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
						{variables.length === 0 ? (
							<div className="text-center py-8">
								<p className="text-sm text-muted">No environment variables yet.</p>
								<p className="text-xs text-muted/60 mt-1">Click "Add Variable" to get started.</p>
							</div>
						) : (
							variables.map((variable, index) => (
								<div
									key={index}
									className="flex items-center gap-2 bg-background/40 border border-white/[0.07] rounded-lg p-2.5"
								>
									<input
										type="text"
										placeholder="KEY"
										className={inputCls}
										value={variable.name}
										onChange={(e) => handleVariableChange(index, "name", e.target.value)}
									/>
									<span className="text-muted text-sm shrink-0">=</span>
									<input
										type="text"
										placeholder="value"
										className={inputCls}
										value={variable.value}
										onChange={(e) => handleVariableChange(index, "value", e.target.value)}
									/>
									<button
										onClick={() => handleRemoveVariable(index)}
										className="p-1.5 text-muted hover:text-red-400 hover:bg-red-400/10 rounded transition-colors shrink-0"
									>
										<Icon name="trash" className="w-3.5 h-3.5" />
									</button>
								</div>
							))
						)}
					</div>
				</div>

				<ModalFooter>
					<button onClick={onClose} className={cancelBtnClass} disabled={loading}>
						Cancel
					</button>
					<button onClick={handleSubmit} className={primaryBtnClass} disabled={loading}>
						Update Variables
					</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}

export default UpdateEnvModal;
