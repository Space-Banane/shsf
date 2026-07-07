import { useEffect, useState } from "react";
import Modal from "./Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, textareaClass, labelClass, ModalError, ModalFooter } from "./Modal";
import { useShiftEnterSubmit } from "../../hooks/useShiftEnterSubmit";

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

	useShiftEnterSubmit(() => onSave(name, purpose), isOpen && !loading && name.trim().length >= 2);

	useEffect(() => {
		if (isOpen) { setName(initialName); setPurpose(initialPurpose); }
	}, [isOpen, initialName, initialPurpose]);

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Edit Access Token" isLoading={loading}>
			<div className="space-y-4">
				<ModalError message={error} />
				<div>
					<label className={labelClass}>Token name</label>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className={`${inputClass} font-mono`}
						maxLength={128}
						minLength={2}
						disabled={loading}
						autoFocus
					/>
				</div>
				<div>
					<label className={labelClass}>Purpose (optional)</label>
					<textarea
						value={purpose}
						onChange={(e) => setPurpose(e.target.value)}
						className={`${textareaClass} font-mono`}
						maxLength={512}
						rows={2}
						disabled={loading}
						placeholder="What is this token used for?"
					/>
				</div>
				<ModalFooter>
					<button onClick={onClose} className={cancelBtnClass} disabled={loading}>
						Cancel
					</button>
					<button
						onClick={() => onSave(name, purpose)}
						className={primaryBtnClass}
						disabled={loading || name.trim().length < 2}
					>
						Save
					</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}
