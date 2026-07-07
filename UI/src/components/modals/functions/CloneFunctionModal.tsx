import React, { useState } from "react";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, selectClass, labelClass, ModalError, ModalFooter } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import { cloneFunction } from "../../../services/backend.functions";
import { Namespace } from "../../../types/Prisma";

interface CloneFunctionModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	namespaces: Namespace[];
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

	useShiftEnterSubmit(() => handleSubmit(), isOpen && !isLoading);

	const handleSubmit = async () => {
		if (!functionId) return;
		if (!namespaceId) { setError("Please select a namespace"); return; }
		setError("");
		setIsLoading(true);
		try {
			const res = await cloneFunction(functionId, {
				name: name.trim() === "" ? undefined : name.trim(),
				namespaceId,
			});
			if (res?.status === "OK") { onSuccess(); onClose(); }
			else setError(res?.message || "Failed to clone function");
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => { if (!isLoading) { onClose(); setError(""); } };

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Clone Function" maxWidth="md" isLoading={isLoading}>
			<div className="space-y-4">
				<ModalError message={error} />
				<div>
					<label className={labelClass}>New name (optional)</label>
					<input
						type="text"
						placeholder="Leave empty to use original name with -copy suffix"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className={inputClass}
						disabled={isLoading}
					/>
				</div>
				<div>
					<label className={labelClass}>Target namespace</label>
					<select
						value={namespaceId || ""}
						onChange={(e) => setNamespaceId(Number(e.target.value))}
						className={selectClass}
						disabled={isLoading}
					>
						<option value="" disabled>Select Namespace</option>
						{namespaces.map((ns) => (
							<option key={ns.id} value={ns.id}>{ns.name}</option>
						))}
					</select>
				</div>
				<ModalFooter>
					<button onClick={handleClose} className={cancelBtnClass} disabled={isLoading}>
						Cancel
					</button>
					<button onClick={handleSubmit} className={primaryBtnClass} disabled={isLoading}>
						Clone
					</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}

export default CloneFunctionModal;
