import React, { createContext, useContext, useState, useCallback } from "react";
import Modal from "./Modal";
import { cancelBtnClass, deleteBtnClass, primaryBtnClass } from "./Modal";
import { useShiftEnterSubmit } from "../../hooks/useShiftEnterSubmit";

interface ConfirmOptions {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	variant?: "primary" | "delete";
}

interface ConfirmContextType {
	confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
	const context = useContext(ConfirmContext);
	if (!context) {
		throw new Error("useConfirm must be used within a ConfirmProvider");
	}
	return context.confirm;
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [options, setOptions] = useState<ConfirmOptions>({
		title: "Confirm",
		message: "",
	});
	const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

	const confirm = useCallback((newOptions: ConfirmOptions) => {
		setOptions(newOptions);
		setIsOpen(true);
		return new Promise<boolean>((resolve) => {
			setResolveRef(() => resolve);
		});
	}, []);

	const handleClose = useCallback(() => {
		setIsOpen(false);
		if (resolveRef) resolveRef(false);
	}, [resolveRef]);

	const handleConfirm = useCallback(() => {
		setIsOpen(false);
		if (resolveRef) resolveRef(true);
	}, [resolveRef]);

	useShiftEnterSubmit(() => isOpen && handleConfirm(), isOpen);

	return (
		<ConfirmContext.Provider value={{ confirm }}>
			{children}
			<Modal isOpen={isOpen} onClose={handleClose} title={options.title} maxWidth="sm">
				<div className="space-y-5">
					<p className="text-sm text-text/80 leading-relaxed">{options.message}</p>
					<div className="flex justify-end gap-3">
						<button onClick={handleClose} className={cancelBtnClass}>
							{options.cancelText || "Cancel"}
						</button>
						<button
							onClick={handleConfirm}
							className={options.variant === "delete" ? deleteBtnClass : primaryBtnClass}
						>
							{options.confirmText || "Confirm"}
						</button>
					</div>
				</div>
			</Modal>
		</ConfirmContext.Provider>
	);
};
