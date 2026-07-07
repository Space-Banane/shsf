import React from "react";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import { primaryBtnClass } from "../Modal";

interface DependencyModalProps {
	isOpen: boolean;
	onClose: () => void;
	content: {
		success: boolean;
		title: string;
		message: string;
	};
}

const DependencyModal: React.FC<DependencyModalProps> = ({ isOpen, onClose, content }) => {
	useShiftEnterSubmit(() => onClose(), isOpen);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="bg-surface-raised rounded-xl shadow-2xl border border-white/[0.07] max-w-sm w-full p-6 animate-fadein">
				<div className="flex flex-col items-center gap-3">
					<div
						className={`w-10 h-10 rounded-full flex items-center justify-center ${
							content.success ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"
						}`}
					>
						<div className={`w-3 h-3 rounded-full ${content.success ? "bg-green-400" : "bg-red-400"}`} />
					</div>
					<h2 className="text-base font-semibold text-text text-center">{content.title}</h2>
					<p className="text-sm text-center text-text/70">{content.message}</p>
					<button className={primaryBtnClass} onClick={onClose}>
						Close
					</button>
				</div>
			</div>
			<style>{`
				.animate-fadein { animation: fadein 0.2s cubic-bezier(.4,0,.2,1); }
				@keyframes fadein { from { opacity: 0; transform: scale(0.98);} to { opacity: 1; transform: scale(1);} }
			`}</style>
		</div>
	);
};

export default DependencyModal;
