import React, { createContext, useContext, useState, useCallback } from "react";
import Modal from "./Modal";

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

	return (
		<ConfirmContext.Provider value={{ confirm }}>
			{children}
			<Modal
				isOpen={isOpen}
				onClose={handleClose}
				title={options.title}
				maxWidth="sm"
			>
				<div className="space-y-6">
					<p className="text-gray-300 text-sm leading-relaxed">
						{options.message}
					</p>
					<div className="flex justify-end gap-3 mt-8">
						<button
							onClick={handleClose}
							className="px-4 py-2 rounded-xl text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200"
						>
							{options.cancelText || "Cancel"}
						</button>
						<button
							onClick={handleConfirm}
							className={`px-6 py-2 rounded-xl text-sm font-bold transition-all duration-200 shadow-lg ${
								options.variant === "delete"
									? "bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 shadow-red-500/10"
									: "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-blue-500/20"
							}`}
						>
							{options.confirmText || "Confirm"}
						</button>
					</div>
				</div>
			</Modal>
		</ConfirmContext.Provider>
	);
};
