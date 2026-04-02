import React from "react";

interface HtmlResultModalProps {
	isOpen: boolean;
	onClose: () => void;
	content: {
		code: number;
		headers: Record<string, string>;
		html: string;
	};
}

const HtmlResultModal: React.FC<HtmlResultModalProps> = ({
	isOpen,
	onClose,
	content,
}) => {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadein">
			<div className="relative max-w-2xl w-full rounded-2xl p-0 overflow-hidden shadow-2xl border border-primary/30 bg-gradient-to-br from-white/80 to-violet-100/80 backdrop-blur-lg">
				<button
					className="absolute top-4 right-4 text-2xl text-violet-700 hover:text-violet-900 bg-white/60 rounded-full px-2 py-1 shadow transition-all duration-200 border border-violet-200"
					onClick={onClose}
					aria-label="Close"
					style={{ zIndex: 2 }}
				>
					×
				</button>
				<div className="p-6">
					<h2 className="text-2xl font-bold text-violet-800 mb-4 text-center drop-shadow">
						HTML Result
					</h2>
					<div className="mb-4 flex flex-wrap gap-2 items-center justify-center">
						<span className="font-mono text-xs bg-violet-100 px-3 py-1 rounded-full text-violet-700 border border-violet-200 shadow">
							HTTP {content.code}
						</span>
					</div>
					<div className="mb-4">
						<h3 className="text-sm font-semibold text-violet-700 mb-2">
							Headers
						</h3>
						<div className="bg-white/60 border border-violet-200 rounded-lg p-3 text-xs font-mono text-violet-900 shadow-inner">
							{Object.entries(content.headers).map(([k, v]) => (
								<div key={k} className="flex gap-2 py-0.5">
									<span className="font-bold text-violet-700">{k}:</span>
									<span className="text-violet-900">{v}</span>
								</div>
							))}
						</div>
					</div>
					<div>
						<h3 className="text-sm font-semibold text-violet-700 mb-2">
							HTML Content
						</h3>
						<div className="border-2 border-violet-200 rounded-xl bg-white/70 shadow-lg overflow-hidden">
							<iframe
								srcDoc={content.html}
								title="Popup HTML"
								className="w-full h-96 rounded-xl border-none"
								sandbox="allow-scripts allow-same-origin"
							/>
						</div>
					</div>
				</div>
			</div>
			<style>{`
				.animate-fadein {
					animation: fadein 0.25s cubic-bezier(.4,0,.2,1);
				}
				@keyframes fadein {
					from { opacity: 0; transform: scale(0.98);}
					to { opacity: 1; transform: scale(1);}
				}
			`}</style>
		</div>
	);
};

export default HtmlResultModal;
