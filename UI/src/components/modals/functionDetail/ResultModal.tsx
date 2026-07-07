import React, { useEffect } from "react";
import { toast } from "react-toastify";
import { Icon } from "../../ui/Icon";

interface ResultModalProps {
	isOpen: boolean;
	onClose: () => void;
	content: {
		title: string;
		type: string;
		value: any;
	};
	cacheEnabled?: boolean;
}

const ResultModal: React.FC<ResultModalProps> = ({
	isOpen,
	onClose,
	content,
	cacheEnabled = false,
}) => {
	useEffect(() => {
		if (!isOpen) return;
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	if (content.type === "object" && content.value === null) {
		toast.warning("Function returned null, skipping modal");
		onClose();
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto">
			<div className="min-h-full w-full flex items-center justify-center p-3 sm:p-4">
				<div className="bg-surface-raised rounded-xl shadow-2xl border border-white/[0.07] w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-hidden animate-fadein">
					<div className="flex flex-col h-full">
						<div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between gap-3">
							<h2 className="text-base font-semibold text-text truncate">
								{content.title}
							</h2>
							<button
								className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-white/[0.04] transition-colors"
								onClick={onClose}
								aria-label="Close"
							>
								<Icon name="x-mark" className="w-4 h-4" />
							</button>
						</div>

						<div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-white/[0.07]">
							<span className="font-mono text-xs bg-primary/10 border border-primary/20 text-primary px-2 py-1 rounded">
								{content.type}
							</span>
							{cacheEnabled && (
								<span className="text-xs text-muted">Caching is ignored here.</span>
							)}
						</div>

						<div className="p-4 sm:p-5 overflow-auto min-h-0">
							<pre className="w-full bg-background/40 border border-white/[0.07] rounded-lg p-3 text-xs font-mono text-text/90 text-left overflow-auto max-h-[calc(100dvh-14rem)] sm:max-h-[calc(100dvh-16rem)]">
								{typeof content.value === "string"
									? content.value
									: JSON.stringify(content.value, null, 2)}
							</pre>
						</div>
					</div>
				</div>
			</div>
			<style>{`
				.animate-fadein { animation: fadein 0.2s cubic-bezier(.4,0,.2,1); }
				@keyframes fadein { from { opacity: 0; transform: scale(0.98);} to { opacity: 1; transform: scale(1);} }
			`}</style>
		</div>
	);
};

export default ResultModal;
