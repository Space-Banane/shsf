import React from "react";

interface DependencyModalProps {
	isOpen: boolean;
	onClose: () => void;
	content: {
		success: boolean;
		title: string;
		message: string;
	};
}

const DependencyModal: React.FC<DependencyModalProps> = ({
	isOpen,
	onClose,
	content,
}) => {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="bg-background/50 rounded-xl shadow-2xl border border-primary/30 max-w-sm w-full p-6 animate-fadein">
				<div className="flex flex-col items-center">
					<div
						className={`text-4xl mb-2 ${
							content.success ? "text-green-500" : "text-red-500"
						}`}
					>
						{content.success ? "✅" : "❌"}
					</div>
					<h2 className="text-xl font-bold mb-2 text-primary text-center">
						{content.title}
					</h2>
					<p className="text-center text-text/80 mb-4">{content.message}</p>
					<button
						className="mt-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
						onClick={onClose}
					>
						Close
					</button>
				</div>
			</div>
			<style>{`
				.animate-fadein {
					animation: fadein 0.2s cubic-bezier(.4,0,.2,1);
				}
				@keyframes fadein {
					from { opacity: 0; transform: scale(0.98);}
					to { opacity: 1; transform: scale(1);}
				}
			`}</style>
		</div>
	);
};

export default DependencyModal;
