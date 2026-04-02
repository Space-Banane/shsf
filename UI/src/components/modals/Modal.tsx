import React, { useEffect } from "react";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	maxWidth?: "sm" | "md" | "lg" | "xl";
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

		if (isOpen) {
			document.addEventListener("keydown", handleEscape);
		}

		return () => {
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isOpen, onClose, isLoading]);

	if (!isOpen) return null;

	const maxWidthClass = {
		sm: "max-w-sm",
		md: "max-w-md",
		lg: "max-w-2xl",
		xl: "max-w-4xl",
	}[maxWidth];

	return (
		/* Overlay: Added onClick to close */
		<div
			className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 animate-fadeIn p-4"
			onClick={() => !isLoading && onClose()}
		>
			{/* Modal Content: Added stopPropagation to prevent overlay click trigger */}
			<div
				onClick={(e) => e.stopPropagation()}
				className={`bg-gray-900/95 backdrop-blur-xl border border-white/5 text-white rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] ${maxWidthClass} w-full animate-slideIn flex flex-col max-h-[90vh] relative overflow-hidden`}
			>
				{/* Header */}
				<div className="flex justify-between items-center p-6 border-b border-white/5 bg-white/[0.02]">
					<div className="flex items-center gap-4">
						<div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center border border-white/10">
							<div className="w-2.5 h-2.5 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full shadow-[0_0_10px_rgba(96,165,250,0.5)]"></div>
						</div>
						<h2 className="text-xl font-bold tracking-tight text-gray-100">
							{title}
						</h2>
					</div>
					{!isLoading && (
						<button
							onClick={onClose}
							className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-200"
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

				{/* Content Area */}
				<div
					className="overflow-y-auto p-8 relative flex-1"
					style={{ scrollbarWidth: "thin" }}
				>
					{isLoading && (
						<div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-10 transition-all duration-300">
							<div className="flex flex-col items-center gap-5">
								<div className="relative">
									<div className="w-12 h-12 border-[3px] border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
									<div className="absolute inset-0 blur-sm w-12 h-12 border-[3px] border-transparent border-t-blue-400 rounded-full animate-spin opacity-50"></div>
								</div>
								<p className="text-gray-300 text-sm font-medium tracking-widest uppercase">Processing</p>
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
