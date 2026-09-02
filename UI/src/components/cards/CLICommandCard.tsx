import React, { useState } from "react";
import { useShiftEnterSubmit } from "../../hooks/useShiftEnterSubmit";

interface CLICommandCardProps {
	command: string;
	label?: string;
	description?: string;
	customText?: string;
}

const CLICommandCard: React.FC<CLICommandCardProps> = ({
	command,
	label = "CLI Command",
	description,
}) => {
	const [modalOpen, setModalOpen] = useState(false);
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(command);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	useShiftEnterSubmit(handleCopy, modalOpen);

	return (
		<>
			<button
				className="group mt-2 inline-flex self-start items-center gap-3 rounded-lg border border-primary/20 bg-background/50 px-4 py-2.5 text-left transition-all duration-300 hover:scale-[1.02] hover:border-primary/40 hover:bg-primary/5"
				onClick={(e) => {
					e.stopPropagation();
					setModalOpen(true);
				}}
			>
				<span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
					⌘
				</span>
				<span className="flex flex-col">
					<span className="text-sm font-semibold text-primary">
						{label ? label : "Command Available"}
					</span>
					<span className="max-w-[18rem] truncate text-xs text-text/60">
						Click to view and copy command
					</span>
				</span>
			</button>

			{modalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadein">
					<div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-gray-900/95 to-gray-800/95 shadow-2xl">
						<button
							className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-background/40 text-text/70 transition-colors duration-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
							onClick={() => setModalOpen(false)}
							aria-label="Close"
							style={{ zIndex: 2 }}
						>
							×
						</button>
						<div className="border-b border-primary/10 px-6 py-5">
							<h2 className="text-2xl font-bold text-primary">{label}</h2>
							{description && (
								<div className="mt-2 max-w-lg text-sm leading-6 text-text/75">
									{description}
								</div>
							)}
						</div>
						<div className="p-6">
							<div className="rounded-lg border border-primary/10 bg-background/40 p-4">
								<div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-text/40">
									Command
								</div>
								<code className="block whitespace-pre-wrap break-all font-mono text-sm leading-7 text-primary">
									{command}
								</code>
							</div>
							<div className="mt-5 flex items-center justify-between gap-4">
								<div className="text-xs text-text/50">Ready to copy into your terminal.</div>
								<button
									className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white border border-blue-700 transition-all duration-300 hover:scale-105 hover:bg-blue-700 hover:border-blue-800"
									onClick={handleCopy}
									title="Copy CLI command"
								>
									<span>{copied ? "Copied" : "Copy Command"}</span>
									<span className="text-base">{copied ? "✓" : "📋"}</span>
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
