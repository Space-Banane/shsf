import { useState, useEffect } from "react";
import Modal from "./Modal";

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

function UpdateEnvModal({
	isOpen,
	onClose,
	onUpdate,
	envString,
}: UpdateEnvModalProps) {
	const [variables, setVariables] = useState<EnvironmentVariable[]>([]);
	const [loading, setLoading] = useState(false);

	// Parse environment variables on component mount or when envString changes
	useEffect(() => {
		if (envString) {
			try {
				// Parse JSON string if it exists
				const parsedEnv = JSON.parse(envString);
				setVariables(parsedEnv);
			} catch (error) {
				// If string is in KEY=VALUE format separated by ", "
				const vars: EnvironmentVariable[] = [];
				const pairs = envString.split(", ");

				pairs.forEach((pair) => {
					if (pair.trim()) {
						const [name, value] = pair.split("=");
						if (name && value !== undefined) {
							vars.push({ name, value });
						}
					}
				});

				setVariables(vars);
			}
		} else {
			setVariables([]);
		}
	}, [envString, isOpen]);

	const handleAddVariable = () => {
		setVariables([...variables, { name: "", value: "" }]);
	};

	const handleRemoveVariable = (index: number) => {
		setVariables(variables.filter((_, i) => i !== index));
	};

	const handleVariableChange = (
		index: number,
		field: "name" | "value",
		value: string
	) => {
		setVariables(
			variables.map((variable, i) =>
				i === index ? { ...variable, [field]: value } : variable
			)
		);
	};

	const handleSubmit = async () => {
		// Filter out any variables with empty names
		const filteredVars = variables.filter((v) => v.name.trim() !== "");

		setLoading(true);
		try {
			const success = await onUpdate(filteredVars);
			if (success) {
				onClose();
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Update Environment Variables"
		>
			<div className="max-h-96 overflow-y-auto">
				{variables.map((variable, index) => (
					<div key={index} className="flex items-center mb-3">
						<div className="flex-grow flex space-x-2 mr-2">
							<input
								type="text"
								placeholder="Variable Name"
								className="w-1/2 px-3 py-2 bg-gray-700 text-white rounded"
								value={variable.name}
								onChange={(e) =>
									handleVariableChange(index, "name", e.target.value)
								}
							/>
							<input
								type="text"
								placeholder="Variable Value"
								className="w-1/2 px-3 py-2 bg-gray-700 text-white rounded"
								value={variable.value}
								onChange={(e) =>
									handleVariableChange(index, "value", e.target.value)
								}
							/>
						</div>
						<button
							className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
							onClick={() => handleRemoveVariable(index)}
						>
							X
						</button>
					</div>
				))}
			</div>

			<div className="mt-4 flex justify-between">
				<button
					className="bg-primary hover:bg-primary/70 text-white font-bold py-2 px-4 rounded"
					onClick={handleAddVariable}
				>
					Add Variable
				</button>

				<div>
					<button
						className="bg-grayed hover:bg-grayed/70 text-white font-bold py-2 px-4 rounded mr-2"
						onClick={onClose}
					>
						Cancel
					</button>
					<button
						className="bg-primary hover:bg-primary/70 text-white font-bold py-2 px-4 rounded"
						onClick={handleSubmit}
						disabled={loading}
					>
						{loading ? "Updating..." : "Update"}
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default UpdateEnvModal;
