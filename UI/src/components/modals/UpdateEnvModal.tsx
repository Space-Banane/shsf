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
		value: string,
	) => {
		setVariables(
			variables.map((variable, i) =>
				i === index ? { ...variable, [field]: value } : variable,
			),
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
			title="Environment Variables"
			maxWidth="lg"
			isLoading={loading}
		>
			<div className="space-y-6">
				{/* Description */}
				<div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
					<div className="flex items-start gap-3">
						<span className="text-blue-400 text-lg">💡</span>
						<div>
							<p className="text-blue-300 text-sm font-medium mb-1">
								Environment Variables
							</p>
							<p className="text-blue-200/80 text-xs leading-relaxed">
								Configure environment variables that your function can access during
								runtime. These are useful for API keys, database URLs, and other
								configuration values.
							</p>
						</div>
					</div>
				</div>

				{/* Variables Section */}
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-semibold text-primary flex items-center gap-2">
							<span>⚙️</span> Variables ({variables.length})
						</h3>
						<button
							onClick={handleAddVariable}
							className="px-3 py-1.5 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white text-sm rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-green-500/25 flex items-center gap-2"
						>
							<span className="text-xs">➕</span>
							Add Variable
						</button>
					</div>

					{/* Variables List */}
					<div className="space-y-3 max-h-96 overflow-y-auto">
						{variables.length === 0 ? (
							<div className="text-center py-8">
								<div className="text-3xl mb-3">📝</div>
								<p className="text-gray-400 text-sm">No environment variables yet</p>
								<p className="text-gray-500 text-xs mt-1">
									Click "Add Variable" to get started
								</p>
							</div>
						) : (
							variables.map((variable, index) => (
								<div
									key={index}
									className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3"
								>
									<div className="flex items-center gap-3">
										<div className="w-6 h-6 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
											<span className="text-xs">🔑</span>
										</div>
										<div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
											<input
												type="text"
												placeholder="Variable name (e.g., API_KEY)"
												className="w-full p-2 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 text-sm"
												value={variable.name}
												onChange={(e) =>
													handleVariableChange(index, "name", e.target.value)
												}
											/>
											<input
												type="text"
												placeholder="Variable value"
												className="w-full p-2 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 text-sm"
												value={variable.value}
												onChange={(e) =>
													handleVariableChange(index, "value", e.target.value)
												}
											/>
										</div>
										<button
											onClick={() => handleRemoveVariable(index)}
											className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-300 hover:scale-110 flex-shrink-0"
											title="Remove variable"
										>
											🗑️
										</button>
									</div>
								</div>
							))
						)}
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700/50">
					<button
						onClick={onClose}
						className="px-6 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg font-medium transition-all duration-300 border border-gray-600/50 hover:border-gray-500"
						disabled={loading}
					>
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
						disabled={loading}
					>
						<span className="text-sm">💾</span>
						Update Variables
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default UpdateEnvModal;
