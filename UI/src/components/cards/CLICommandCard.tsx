import React, { useState } from "react";

interface CLICommandCardProps {
	command: string;
	label?: string;
	description?: string;
    customText?: string;
}

const CLICommandCard: React.FC<CLICommandCardProps> = ({ command, label = "CLI Command", description }) => {
	const [modalOpen, setModalOpen] = useState(false);
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(command);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	return (
		<>
				<button
					className="mt-2 px-4 py-2 text-base rounded bg-background text-white hover:bg-primary transition self-start"
					onClick={e => { e.stopPropagation(); setModalOpen(true); }}
				>
					{label ? label : "Command Available"}📡
				</button>

			{modalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadein">
					<div className="relative max-w-md w-full rounded-2xl p-0 overflow-hidden shadow-2xl border border-primary/30 bg-gradient-to-br from-white/80 to-violet-100/80 backdrop-blur-lg">
						<button
							className="absolute top-4 right-4 text-2xl text-violet-700 hover:text-violet-900 bg-white/60 rounded-full px-2 py-1 shadow transition-all duration-200 border border-violet-200"
							onClick={() => setModalOpen(false)}
							aria-label="Close"
							style={{ zIndex: 2 }}
						>
							×
						</button>
						<div className="p-6">
							<h2 className="text-2xl font-bold text-violet-800 mb-4 text-center drop-shadow">
								{label}
							</h2>
							{description && (
								<div className="text-xs text-text/50 mb-4 text-center">{description}</div>
							)}
							<div className="flex items-center gap-2 justify-center mb-4">
								<code className="bg-background/70 border border-primary/20 rounded px-2 py-1 text-xs font-mono text-primary">
									{command}
								</code>
								<button
									className="ml-1 px-2 py-1 text-xs rounded bg-primary/80 text-white hover:bg-primary transition"
									onClick={handleCopy}
									title="Copy CLI command"
								>
									{copied ? "✅" : "📋"}
								</button>
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
			)}
		</>
	);
};

export default CLICommandCard;
