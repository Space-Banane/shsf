import React, { useState } from "react";

interface ImageResultModalProps {
	isOpen: boolean;
	onClose: () => void;
	content: {
		code: number;
		contentType: string;
		headers: Record<string, string>;
		src: string;
	};
}

const ImageResultModal: React.FC<ImageResultModalProps> = ({
	isOpen,
	onClose,
	content,
}) => {
	const [showAllHeaders, setShowAllHeaders] = useState(false);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto">
			<div className="min-h-full w-full flex items-center justify-center p-3 sm:p-4 animate-fadein">
				<div className="relative w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] rounded-2xl overflow-hidden shadow-2xl border border-primary/30 bg-gradient-to-br from-white/80 to-blue-100/80 backdrop-blur-lg">
					<button
						className="absolute top-4 right-4 text-2xl text-blue-700 hover:text-blue-900 bg-white/60 rounded-full px-2 py-1 shadow transition-all duration-200 border border-blue-200"
						onClick={onClose}
						aria-label="Close"
						style={{ zIndex: 2 }}
					>
						×
					</button>
					<div className="h-full flex flex-col">
						<div className="px-5 pt-5 pb-3 border-b border-blue-200/70 pr-14">
							<h2 className="text-xl font-bold text-blue-800 text-center drop-shadow">
								Image Result
							</h2>
							<div className="mt-3 flex flex-wrap gap-2 items-center justify-center">
								<span className="font-mono text-xs bg-blue-100 px-3 py-1 rounded-full text-blue-700 border border-blue-200 shadow">
									HTTP {content.code}
								</span>
								<span className="font-mono text-xs bg-blue-100 px-3 py-1 rounded-full text-blue-700 border border-blue-200 shadow">
									{content.contentType}
								</span>
							</div>
						</div>

						<div className="p-4 sm:p-5 overflow-auto min-h-0 space-y-3">
							<div>
								<div className="flex items-center justify-between gap-2 mb-2">
									<h3 className="text-sm font-semibold text-blue-700">Headers</h3>
									<button
										className="text-xs px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 transition"
										onClick={() => setShowAllHeaders((prev) => !prev)}
									>
										{showAllHeaders ? "Show Less" : "Show All"}
									</button>
								</div>
								<div className="bg-white/60 border border-blue-200 rounded-lg p-3 text-xs font-mono text-blue-900 shadow-inner max-h-36 overflow-auto">
									{Object.entries(content.headers)
										.filter(([k]) =>
											showAllHeaders
												? true
												: [
														"content-type",
														"content-length",
														"etag",
														"last-modified",
														"cache-control",
												  ].includes(k.toLowerCase()),
										)
										.map(([k, v]) => (
											<div key={k} className="flex gap-2 py-0.5">
												<span className="font-bold text-blue-700">{k}:</span>
												<span className="text-blue-900">{v}</span>
											</div>
										))}
								</div>
							</div>
							<div className="border-2 border-blue-200 rounded-xl bg-white/70 shadow-lg overflow-auto p-2">
								<img
									src={content.src}
									alt="Function result"
									className="max-h-[45dvh] w-auto max-w-full mx-auto rounded"
								/>
							</div>
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

export default ImageResultModal;
