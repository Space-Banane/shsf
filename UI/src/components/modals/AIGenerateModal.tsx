import React, { useState } from "react";
import { FunctionFile } from "../../types/Prisma";
import { generateWithAI, type AIMode } from "../../services/backend.ai";

interface AIGenerateModalProps {
	isOpen: boolean;
	onClose: () => void;
	functionId: number;
	existingFiles: FunctionFile[];
	onSuccess: () => void; // called after files are written — triggers a file list refresh
}

function AIGenerateModal({
	isOpen,
	onClose,
	functionId,
	existingFiles,
	onSuccess,
}: AIGenerateModalProps) {
	const [mode, setMode] = useState<AIMode>("kickoff");
	const [prompt, setPrompt] = useState("");
	const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<{
		writtenFiles: string[];
		model: string;
	} | null>(null);

	const MAX_REVISION_FILES = 3;

	const toggleFileSelection = (filename: string) => {
		setSelectedFiles((prev) => {
			if (prev.includes(filename)) {
				return prev.filter((f) => f !== filename);
			}
			if (prev.length >= MAX_REVISION_FILES) return prev;
			return [...prev, filename];
		});
	};

	const handleSubmit = async () => {
		if (!prompt.trim()) {
			setError("Please enter a prompt");
			return;
		}
		if (mode === "revision" && selectedFiles.length === 0) {
			setError("Please select at least one file to revise");
			return;
		}

		setIsLoading(true);
		setError(null);
		setResult(null);

		try {
			const response = await generateWithAI(functionId, {
				mode,
				prompt: prompt.trim(),
				files: mode === "revision" ? selectedFiles : undefined,
			});

			if (response.status === "OK" && "data" in response) {
				setResult(response.data);
				onSuccess();
			} else {
				setError(
					(response as any).message || "Unknown error occurred",
				);
			}
		} catch (err) {
			setError("Network error — please try again");
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		if (isLoading) return;
		setPrompt("");
		setSelectedFiles([]);
		setError(null);
		setResult(null);
		setMode("kickoff");
		onClose();
		if (result) { // Only reload if we actually did something — avoids unnecessary refreshes when just closing the modal
			window.location.reload(); // Files updated, refresh to just be safe
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/80 backdrop-blur-md"
				onClick={handleClose}
			/>

			{/* Modal panel */}
			<div
				className="relative w-full max-w-2xl flex flex-col max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
				style={{
					background:
						"linear-gradient(160deg, #0a0a0f 0%, #0d0d18 50%, #0a0f1a 100%)",
					border: "1px solid rgba(99,102,241,0.25)",
					boxShadow:
						"0 0 0 1px rgba(99,102,241,0.1), 0 25px 60px rgba(0,0,0,0.85), 0 0 80px rgba(99,102,241,0.08)",
				}}
			>
				{/* Scanline accent at top */}
				<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/70 to-transparent" />

				{/* Header */}
				<div
					className="flex items-center justify-between px-6 py-4 shrink-0"
					style={{
						borderBottom: "1px solid rgba(99,102,241,0.12)",
						background:
							"linear-gradient(90deg,rgba(99,102,241,0.06) 0%,rgba(16,16,32,0) 100%)",
					}}
				>
					<div className="flex items-center gap-3">
						{/* KICKOFF icon */}
						<div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
							style={{
								background: "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(139,92,246,0.15))",
								border: "1px solid rgba(99,102,241,0.3)",
							}}
						>
							<svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
							</svg>
						</div>
						<div>
							<h2
								className="text-base font-bold tracking-widest uppercase"
								style={{
									background:
										"linear-gradient(90deg,#818cf8,#a78bfa)",
									WebkitBackgroundClip: "text",
									WebkitTextFillColor: "transparent",
									letterSpacing: "0.14em",
								}}
							>
								AI Generation
							</h2>
							<p className="text-xs text-gray-500 tracking-wider mt-0.5 uppercase">
								{mode === "kickoff"
									? "create up to 5 files"
									: "revise up to 3 files"}
							</p>
						</div>
					</div>

					{!isLoading && (
						<button
							onClick={handleClose}
							className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-200 transition-colors"
							style={{ background: "rgba(255,255,255,0.04)" }}
						>
							<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</button>
					)}
				</div>

				{/* Scrollable body */}
				<div className="overflow-y-auto flex-1 px-6 py-5 space-y-5" style={{ scrollbarWidth: "thin" }}>
					{/* Mode selector */}
					<div>
						<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
							Mode
						</p>
						<div
							className="flex rounded-xl p-1 gap-1"
							style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
						>
							{(["kickoff", "revision"] as AIMode[]).map((m) => (
								<button
									key={m}
									disabled={isLoading}
									onClick={() => {
										setMode(m);
										setError(null);
										setResult(null);
										setSelectedFiles([]);
									}}
									className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-200"
									style={
										mode === m
											? {
												background:
													"linear-gradient(135deg,rgba(99,102,241,0.35),rgba(139,92,246,0.25))",
												border: "1px solid rgba(99,102,241,0.4)",
												color: "#a5b4fc",
												boxShadow: "0 0 16px rgba(99,102,241,0.2)",
											}
											: {
												background: "transparent",
												border: "1px solid transparent",
												color: "#6b7280",
											}
									}
								>
									{m === "kickoff" ? "⚡ KICKOFF" : "✏️ REVISION"}
								</button>
							))}
						</div>
					</div>

					{/* Revision: file selector */}
					{mode === "revision" && (
						<div>
							<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
								Files to revise{" "}
								<span className="text-gray-600 normal-case tracking-normal font-normal">
									(select up to {MAX_REVISION_FILES})
								</span>
							</p>
							{existingFiles.length === 0 ? (
								<p className="text-xs text-gray-600 italic">
									No files found for this function
								</p>
							) : (
								<div className="flex flex-wrap gap-2">
									{existingFiles.map((file) => {
										const selected = selectedFiles.includes(file.name);
										const disabled =
											!selected &&
											selectedFiles.length >= MAX_REVISION_FILES;
										return (
											<button
												key={file.id}
												disabled={disabled || isLoading}
												onClick={() => toggleFileSelection(file.name)}
												className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-150"
												style={
													selected
														? {
															background:
																"rgba(99,102,241,0.2)",
															border: "1px solid rgba(99,102,241,0.5)",
															color: "#a5b4fc",
														}
														: disabled
														? {
															background:
																"rgba(255,255,255,0.02)",
															border: "1px solid rgba(255,255,255,0.06)",
															color: "#374151",
															cursor: "not-allowed",
														}
														: {
															background:
																"rgba(255,255,255,0.04)",
															border: "1px solid rgba(255,255,255,0.1)",
															color: "#9ca3af",
														}
												}
											>
												{selected && (
													<span className="mr-1">✓</span>
												)}
												{file.name}
											</button>
										);
									})}
								</div>
							)}
						</div>
					)}

					{/* Prompt */}
					<div>
						<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
							{mode === "kickoff" ? "Describe your function" : "Revision instructions"}
						</p>
						<textarea
							disabled={isLoading}
							value={prompt}
							onChange={(e) => {
								setPrompt(e.target.value);
								setError(null);
							}}
							placeholder={
								mode === "kickoff"
									? "e.g. A Python function that fetches weather data from an API and returns a formatted summary…"
									: "e.g. Add error handling to all API calls and improve type hints…"
							}
							rows={5}
							className="w-full resize-none rounded-xl text-sm text-gray-200 placeholder-gray-600 outline-none transition-all duration-200 font-mono"
							style={{
								background: "rgba(255,255,255,0.04)",
								border: "1px solid rgba(99,102,241,0.2)",
								padding: "12px 14px",
								lineHeight: "1.6",
							}}
							onFocus={(e) => {
								e.target.style.border = "1px solid rgba(99,102,241,0.5)";
								e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.08)";
							}}
							onBlur={(e) => {
								e.target.style.border = "1px solid rgba(99,102,241,0.2)";
								e.target.style.boxShadow = "none";
							}}
						/>
					</div>

					{/* Error */}
					{error && (
						<div
							className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
							style={{
								background: "rgba(239,68,68,0.08)",
								border: "1px solid rgba(239,68,68,0.25)",
								color: "#fca5a5",
							}}
						>
							<svg className="w-4 h-4 mt-0.5 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<circle cx="12" cy="12" r="10" />
								<path d="M12 8v4M12 16h.01" />
							</svg>
							<span>{error}</span>
						</div>
					)}

					{/* Success result */}
					{result && (
						<div
							className="rounded-xl px-4 py-3 space-y-2"
							style={{
								background: "rgba(16,185,129,0.07)",
								border: "1px solid rgba(16,185,129,0.25)",
							}}
						>
							<div className="flex items-center gap-2">
								<svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M20 6L9 17l-5-5" />
								</svg>
								<p className="text-sm font-semibold text-emerald-400">
									{result.writtenFiles.length} file
									{result.writtenFiles.length !== 1 && "s"} written
								</p>
							</div>
							<div className="flex flex-wrap gap-1.5 mt-1">
								{result.writtenFiles.map((f) => (
									<span
										key={f}
										className="px-2 py-0.5 rounded text-xs font-mono"
										style={{
											background: "rgba(16,185,129,0.12)",
											border: "1px solid rgba(16,185,129,0.2)",
											color: "#6ee7b7",
										}}
									>
										{f}
									</span>
								))}
							</div>
							<p className="text-xs text-gray-600 mt-1">
								Model: {result.model}
							</p>
						</div>
					)}

					{/* Loading state overlay text */}
					{isLoading && (
						<div className="flex items-center gap-3 py-1">
							<div
								className="w-4 h-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin shrink-0"
							/>
							<p
								className="text-sm tracking-wide"
								style={{ color: "#818cf8" }}
							>
								AI is generating code…
							</p>
						</div>
					)}
				</div>

				{/* Footer */}
				<div
					className="flex items-center justify-between gap-3 px-6 py-4 shrink-0"
					style={{
						borderTop: "1px solid rgba(99,102,241,0.1)",
						background:
							"linear-gradient(90deg,rgba(99,102,241,0.04) 0%,rgba(16,16,32,0) 100%)",
					}}
				>
					<button
						onClick={handleClose}
						disabled={isLoading}
						className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors duration-150"
						style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
					>
						{result ? "Close" : "Cancel"}
					</button>

					{!result && (
						<button
							onClick={handleSubmit}
							disabled={isLoading || !prompt.trim()}
							className="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-200 relative overflow-hidden"
							style={
								isLoading || !prompt.trim()
									? {
											background: "rgba(99,102,241,0.1)",
											border: "1px solid rgba(99,102,241,0.15)",
											color: "#4b5563",
											cursor: isLoading ? "wait" : "not-allowed",
									  }
									: {
											background:
												"linear-gradient(135deg,#4f46e5,#7c3aed)",
											border: "1px solid rgba(139,92,246,0.5)",
											color: "#e0e7ff",
											boxShadow:
												"0 0 20px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.1)",
									  }
							}
						>
							{/* Glare */}
							{!isLoading && prompt.trim() && (
								<span className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
							)}
							<span className="relative">
								{isLoading
									? "Generating…"
									: mode === "kickoff"
									? "⚡ Kick Off"
									: "✏️ Revise"}
							</span>
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

export default AIGenerateModal;
