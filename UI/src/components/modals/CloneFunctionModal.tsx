import React, { useState } from "react";
import Modal from "./Modal";
import { cloneFunction } from "../../services/backend.functions";
import { NamespaceResponseWithFunctions } from "../../services/backend.namespaces";

interface CloneFunctionModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	namespaces: NamespaceResponseWithFunctions["data"][];
	functionId: number | null;
}

function CloneFunctionModal({
	isOpen,
	onClose,
	onSuccess,
	namespaces,
	functionId,
}: CloneFunctionModalProps) {
	const [name, setName] = useState("");
	const [namespaceId, setNamespaceId] = useState<number | null>(
		namespaces.length > 0 ? namespaces[0].id : null,
	);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async () => {
		if (!functionId) return;
		if (!namespaceId) {
			setError("Please select a namespace");
			return;
		}
		setError("");
		setIsLoading(true);
		try {
			const res = await cloneFunction(functionId, {
				name: name.trim() === "" ? undefined : name.trim(),
				namespaceId,
			});
			if (res?.status === "OK") {
				onSuccess();
				onClose();
			} else {
				setError(res?.message || "Failed to clone function");
			}
		} catch (e) {
			console.error(e);
			setError("An unexpected error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		if (!isLoading) {
			onClose();
			setError("");
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Clone Function" maxWidth="md" isLoading={isLoading}>
			<div className="space-y-4">
				{error && (
					<div className="bg-red-500/10 border border-red-500/30 p-3 rounded">
						<p className="text-red-300 text-sm">{error}</p>
					</div>
				)}

				<div>
					<label className="text-sm font-medium text-gray-300">New Name (optional)</label>
					<input
						type="text"
						placeholder="optional: new-function-name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg"
						disabled={isLoading}
					/>
					<p className="text-xs text-gray-400 mt-1">Leave empty to use original name with a -copy suffix.</p>
				</div>

				<div>
					<label className="text-sm font-medium text-gray-300">Target Namespace</label>
					<select
						value={namespaceId || ""}
						onChange={(e) => setNamespaceId(Number(e.target.value))}
						className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg"
						disabled={isLoading}
					>
						<option value="" disabled>
							Select Namespace
						</option>
						{namespaces.map((ns) => (
							<option key={ns.id} value={ns.id}>
								{ns.name}
							</option>
						))}
					</select>
				</div>

				<div className="flex justify-end gap-3 pt-4 border-t border-gray-700/50">
					<button onClick={handleClose} className="px-4 py-2 bg-gray-700/50 rounded" disabled={isLoading}>
						Cancel
					</button>
					<button onClick={handleSubmit} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded" disabled={isLoading}>
						Clone
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default CloneFunctionModal;
