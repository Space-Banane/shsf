import React, { useEffect } from "react";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	maxWidth?: string;
	isLoading?: boolean;
}

function Modal({
	isOpen,
	onClose,
	title,
	children,
	maxWidth = "md",
	isLoading = false,
}: ModalProps) {
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isLoading) onClose();
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [onClose, isLoading]);

	if (!isOpen) return null;

	const maxWidthClass =
		{
			sm: "max-w-sm",
			md: "max-w-md",
			lg: "max-w-2xl",
			xl: "max-w-4xl",
		}[maxWidth] || "max-w-md";

	return (
		<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 animate-fadeIn p-4">
			<div
				className={`bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border border-primary/20 text-white rounded-2xl shadow-2xl ${maxWidthClass} w-full animate-slideIn flex flex-col max-h-[90vh] relative overflow-hidden`}
			>
				{/* Gradient overlay */}
				<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

				{/* Header */}
				<div className="flex justify-between items-center p-6 border-b border-primary/10 bg-gradient-to-r from-blue-900/10 to-purple-900/10">
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center">
							<div className="w-4 h-4 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full"></div>
						</div>
						<h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
							{title}
						</h2>
					</div>
					{!isLoading && (
						<button
							onClick={onClose}
							className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-all duration-300 hover:scale-110"
							title="Close"
						>
							<svg
								className="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					)}
				</div>

				{/* Content */}
				<div
					className="overflow-y-auto p-6 relative flex-1"
					style={{ scrollbarWidth: "thin" }}
				>
					{isLoading && (
						<div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl">
							<div className="flex flex-col items-center gap-4">
								<div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
								<p className="text-primary text-sm font-medium">Processing...</p>
							</div>
						</div>
					)}
					{children}
				</div>
			</div>
		</div>
	);
}

export default Modal;
