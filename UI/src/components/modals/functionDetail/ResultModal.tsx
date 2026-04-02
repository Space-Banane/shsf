import React from "react";
import { toast } from "react-toastify";

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
	if (!isOpen) return null;

	if (content.type === "object" && content.value === null) {
		toast.warning("Function returned null, skipping modal");
		onClose();
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto">
			<div className="min-h-full w-full flex items-center justify-center p-3 sm:p-4">
				<div className="bg-background/80 rounded-xl shadow-2xl border border-primary/30 w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-hidden animate-fadein">
					<div className="flex flex-col h-full">
						<div className="px-5 pt-5 pb-3 border-b border-primary/15 flex items-center justify-between gap-3">
							<div className="flex items-center gap-2 min-w-0">
								<div className="text-2xl text-blue-500">📦</div>
								<h2 className="text-lg font-bold text-primary truncate">
									{content.title}
								</h2>
							</div>
							<button
								className="px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm"
								onClick={onClose}
							>
								Close
							</button>
						</div>

						<div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-primary/10">
							<span className="font-mono text-xs bg-blue-100 px-2 py-1 rounded text-blue-700 border border-blue-200">
								Type: {content.type}
							</span>
							{cacheEnabled && (
								<span className="text-xs text-text/70">
									Caching is ignored here.
								</span>
							)}
						</div>

						<div className="p-4 sm:p-5 overflow-auto min-h-0">
							<pre className="w-full bg-background/70 border border-primary/10 rounded-lg p-3 text-xs font-mono text-text/90 shadow-inner text-left overflow-auto max-h-[calc(100dvh-14rem)] sm:max-h-[calc(100dvh-16rem)]">
								{typeof content.value === "string"
									? content.value
									: JSON.stringify(content.value, null, 2)}
							</pre>
						</div>
					</div>
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

export default ResultModal;
