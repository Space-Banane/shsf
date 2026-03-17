import React, { useState, useRef } from "react";
import { FunctionFile, Image, ImagesAsArray } from "../../types/Prisma";
import { generateWithAI, generateConfigWithAI, type AIMode } from "../../services/backend.ai";
import { createFunction } from "../../services/backend.functions";

interface AIGenerateModalProps {
	isOpen: boolean;
	onClose: () => void;
	functionId?: number; // Optional for creation flow
	namespaceId?: number; // Required for creation flow
	existingFiles?: FunctionFile[];
	onSuccess?: () => void; // called after files are written — triggers a file list refresh
}

function AIGenerateModal({
	isOpen,
	onClose,
	functionId,
	namespaceId,
	existingFiles = [],
	onSuccess,
}: AIGenerateModalProps) {
	const [mode, setMode] = useState<AIMode>(functionId ? "revision" : "kickoff");
	const [stage, setStage] = useState<"intake" | "review" | "generating">(
		functionId ? "generating" : "intake",
	);

	const [prompt, setPrompt] = useState("");
	const [image, setImage] = useState<Image>("python:3.11");
	const [cacheEnabled, setCacheEnabled] = useState(false);
	const [dockerMount, setDockerMount] = useState(false);
	const [allowHttp, setAllowHttp] = useState(true);

	// Stage 2 (Review) suggested config
	const [suggestedConfig, setSuggestedConfig] = useState<{
		name: string;
		description: string;
		startup_file: string;
	} | null>(null);

	const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<{
		writtenFiles: string[];
		model: string;
	} | null>(null);

	const abortControllerRef = useRef<AbortController | null>(null);

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

	const handleNextToReview = async () => {
		if (!prompt.trim()) {
			setError("Please enter a description of what you want to build");
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			const res = await generateConfigWithAI(prompt, image) as any;
			if (res.status === "OK") {
				setSuggestedConfig(res.data);
				setStage("review");
			} else {
				setError(res.message || "Failed to generate suggested configuration");
			}
		} catch (err) {
			setError("Failed to get AI suggestions");
		} finally {
			setIsLoading(false);
		}
	};

	const handleConfirmKickoff = async () => {
		if (!suggestedConfig || !namespaceId) return;

		setIsLoading(true);
		setError(null);

		try {
			// 1. Create the function
			const createRes = await createFunction({
				name: suggestedConfig.name,
				description: suggestedConfig.description,
				image: image,
				namespaceId: namespaceId,
				startup_file: suggestedConfig.startup_file,
				docker_mount: dockerMount,
				settings: {
					allow_http: allowHttp,
				},
			});

			if (createRes.status !== "OK") {
				setError(createRes.message);
				setIsLoading(false);
				return;
			}

			const newFunctionId = (createRes as any).data.id;

			// 2. Start file generation
			setStage("generating");
			const genRes = await generateWithAI(newFunctionId, {
				mode: "kickoff",
				prompt: prompt,
			});

			if (genRes.status === "OK" && "data" in genRes) {
				setResult(genRes.data);
				if (onSuccess) onSuccess();
			} else {
				setError((genRes as any).message || "Generation failed (function created)");
			}
		} catch (err) {
			setError("An error occurred during kickoff process");
		} finally {
			setIsLoading(false);
		}
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

		const controller = new AbortController();
		abortControllerRef.current = controller;

		try {
			const response = await generateWithAI(
				functionId!,
				{
					mode,
					prompt: prompt.trim(),
					files: mode === "revision" ? selectedFiles : undefined,
				},
				controller.signal,
			);

			if (response.status === "OK" && "data" in response) {
				setResult(response.data);
				if (onSuccess) onSuccess();
			} else {
				setError(
					(response as any).message || "Unknown error occurred",
				);
			}
		} catch (err: any) {
			if (err.name === "AbortError") {
				console.log("AI generation request aborted");
				return;
			}
			setError("Network error — please try again");
		} finally {
			setIsLoading(false);
			abortControllerRef.current = null;
		}
	};

	const handleCancel = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		setIsLoading(false);
		abortControllerRef.current = null;
	};

	const handleClose = () => {
		if (isLoading) {
			handleCancel();
		}
		setPrompt("");
		setSelectedFiles([]);
		setError(null);
		setResult(null);
		setMode(functionId ? "revision" : "kickoff");
		setStage(functionId ? "generating" : "intake");
		setSuggestedConfig(null);
		onClose();
		if (result) {
			window.location.reload();
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
								{functionId ? "AI ASSISTANT" : "AI KICKOFF"}
							</h2>
							<p className="text-xs text-gray-500 tracking-wider mt-0.5 uppercase">
								{stage === "intake" ? "Configure your function" : stage === "review" ? "Review configuration" : "Generating files..."}
							</p>
						</div>
					</div>

					<button
						onClick={handleClose}
						className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-200 transition-colors"
						style={{ background: "rgba(255,255,255,0.04)" }}
					>
						<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>

				{/* Scrollable body */}
				<div className="overflow-y-auto flex-1 px-6 py-5 space-y-5" style={{ scrollbarWidth: "thin" }}>
					
					{stage === "intake" && !functionId && (
						<>
							{/* Kickoff warning notice */}
							<div
								className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
								style={{
									background: "rgba(234,179,8,0.07)",
									border: "1px solid rgba(234,179,8,0.2)",
									color: "#fde68a",
								}}
							>
								<svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
									<line x1="12" y1="9" x2="12" y2="13" />
									<line x1="12" y1="17" x2="12.01" y2="17" />
								</svg>
								<span className="text-yellow-200/70">
									<span className="font-bold text-yellow-300">Kickoff</span> generates files from scratch and may produce incorrect or incomplete code. Always review the output before running.
								</span>
							</div>

							{/* Prompt */}
							<div>
								<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
									What should this function do?
								</p>
								<textarea
									disabled={isLoading}
									value={prompt}
									onChange={(e) => {
										setPrompt(e.target.value);
										setError(null);
									}}
									placeholder="Describe your function in detail (e.g. A Python function that fetches weather data from an API)..."
									className="w-full h-32 px-4 py-3 rounded-xl text-sm transition-all duration-200 outline-none font-mono"
									style={{
										background: "rgba(255,255,255,0.04)",
										border: "1px solid rgba(99,102,241,0.2)",
										color: "#e5e7eb",
										boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)",
										lineHeight: "1.6",
									}}
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								{/* Image Selection */}
								<div>
									<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
										Runtime
									</p>
									<select
										value={image}
										onChange={(e) => setImage(e.target.value as Image)}
										className="w-full px-4 py-2 rounded-xl text-sm transition-all duration-200 outline-none"
										style={{
											background: "rgba(255,255,255,0.03)",
											border: "1px solid rgba(255,255,255,0.08)",
											color: "#e5e7eb",
										}}
									>
										{ImagesAsArray.map((img) => (
											<option key={img} value={img} className="bg-[#0a0a0f]">
												{img}
											</option>
										))}
									</select>
								</div>

								{/* Toggles */}
								<div className="space-y-3">
									<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
										Options
									</p>
									<label className="flex items-center gap-3 cursor-pointer group">
										<input
											type="checkbox"
											checked={cacheEnabled}
											onChange={(e) => setCacheEnabled(e.target.checked)}
											className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-indigo-500 focus:ring-indigo-600 focus:ring-offset-gray-900"
										/>
										<span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">Enable Caching</span>
									</label>
									<label className="flex items-center gap-3 cursor-pointer group">
										<input
											type="checkbox"
											checked={dockerMount}
											onChange={(e) => setDockerMount(e.target.checked)}
											className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-indigo-500 focus:ring-indigo-600 focus:ring-offset-gray-900"
										/>
										<span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">Docker Mount</span>
									</label>
									<label className="flex items-center gap-3 cursor-pointer group">
										<input
											type="checkbox"
											checked={allowHttp}
											onChange={(e) => setAllowHttp(e.target.checked)}
											className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-indigo-500 focus:ring-indigo-600 focus:ring-offset-gray-900"
										/>
										<span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">Allow HTTP</span>
									</label>
								</div>
							</div>
						</>
					)}

					{stage === "review" && suggestedConfig && (
						<div className="space-y-4">
							<div
								className="p-4 rounded-xl space-y-3"
								style={{
									background: "rgba(99,102,241,0.05)",
									border: "1px solid rgba(99,102,241,0.15)",
								}}
							>
								<div>
									<p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">Function Name</p>
									<input
										type="text"
										value={suggestedConfig.name}
										onChange={(e) => setSuggestedConfig({ ...suggestedConfig, name: e.target.value })}
										className="w-full bg-transparent text-sm font-bold text-white outline-none"
									/>
								</div>
								<div>
									<p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">Description</p>
									<textarea
										value={suggestedConfig.description}
										onChange={(e) => setSuggestedConfig({ ...suggestedConfig, description: e.target.value })}
										className="w-full bg-transparent text-xs text-gray-300 outline-none h-16 resize-none"
									/>
								</div>
								<div className="flex gap-4">
									<div className="flex-1">
										<p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">Startup File</p>
										<input
											type="text"
											value={suggestedConfig.startup_file}
											onChange={(e) => setSuggestedConfig({ ...suggestedConfig, startup_file: e.target.value })}
											className="w-full bg-transparent text-xs font-mono text-gray-400 outline-none"
										/>
									</div>
									<div className="flex-1 text-right">
										<p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">Runtime</p>
										<p className="text-xs text-gray-400">{image}</p>
									</div>
								</div>
							</div>
							<p className="text-[10px] text-gray-500 italic">
								Note: You can configure RAM, Timeout, and Environment variables in the function settings later.
							</p>
						</div>
					)}

					{stage === "generating" && (
						<div className="space-y-6">
							{/* Existing generation UI pieces can go here */}
							{/* Mode selector (only in revision/old kickoff) */}
							{functionId && (
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
							)}

							{/* Files to revise (only in revision) */}
							{mode === "revision" && functionId && (
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

							{/* Prompt (only in generating mode for existing function) */}
							{functionId && (
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
												? "Explain what the function should do..."
												: "What changes should be made to the selected files?"
										}
										className="w-full h-32 px-4 py-3 rounded-xl text-sm transition-all duration-200 outline-none"
										style={{
											background: "rgba(255,255,255,0.03)",
											border: "1px solid rgba(255,255,255,0.08)",
											color: "#e5e7eb",
											boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)",
										}}
									/>
								</div>
							)}

							{/* Progress / Status */}
							{isLoading && (
								<div className="flex flex-col items-center justify-center py-8 space-y-4">
									<div className="relative w-12 h-12">
										<div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full" />
										<div
											className="absolute inset-0 border-2 border-indigo-500 rounded-full animate-spin"
											style={{ borderTopColor: "transparent", borderRightColor: "transparent" }}
										/>
									</div>
									<p className="text-xs font-bold tracking-[0.2em] text-indigo-400 uppercase animate-pulse">
										AI is processing
									</p>
								</div>
							)}

							{result && (
								<div
									className="p-4 rounded-xl space-y-3"
									style={{
										background: "rgba(34,197,94,0.05)",
										border: "1px solid rgba(34,197,94,0.15)",
									}}
								>
									<div className="flex items-center gap-2 text-green-400">
										<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
											<path d="M20 6L9 17l-5-5" />
										</svg>
										<span className="text-xs font-bold uppercase tracking-widest">Success</span>
									</div>
									<p className="text-xs text-gray-400">
										Successfully wrote {result.writtenFiles.length} files using {result.model}.
									</p>
									<div className="flex flex-wrap gap-2 mt-2">
										{result.writtenFiles.map((file) => (
											<span
												key={file}
												className="px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-[10px] font-mono text-green-400"
											>
												{file}
											</span>
										))}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Error display */}
					{error && (
						<div
							className="flex items-start gap-3 p-4 rounded-xl text-xs mt-2"
							style={{
								background: "rgba(239,68,68,0.07)",
								border: "1px solid rgba(239,68,68,0.2)",
								color: "#fca5a5",
							}}
						>
							<svg className="w-4 h-4 mt-0.5 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<circle cx="12" cy="12" r="10" />
								<line x1="12" y1="8" x2="12" y2="12" />
								<line x1="12" y1="16" x2="12.01" y2="16" />
							</svg>
							<span>{error}</span>
						</div>
					)}
				</div>

				{/* Footer */}
				<div
					className="px-6 py-4 shrink-0 flex items-center justify-between"
					style={{ borderTop: "1px solid rgba(99,102,241,0.12)", background: "rgba(255,255,255,0.01)" }}
				>
					<div className="flex items-center gap-4">
						{isLoading ? (
							<button
								onClick={handleCancel}
								className="text-xs font-bold text-gray-500 hover:text-red-400 transition-colors uppercase tracking-widest"
							>
								Cancel
							</button>
						) : stage === "review" ? (
							<button
								onClick={() => setStage("intake")}
								className="text-xs font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-widest"
							>
								Back
							</button>
						) : null}
					</div>

					<div className="flex gap-3">
						{!result && (
							<button
								disabled={isLoading}
								onClick={
									functionId
										? handleSubmit
										: stage === "intake"
										? handleNextToReview
										: handleConfirmKickoff
								}
								className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-[0.14em] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg"
								style={{
									background: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)",
									boxShadow: "0 4px 15px rgba(99,102,241,0.3)",
								}}
							>
								{isLoading
									? "Processing..."
									: functionId
									? "Run Generation"
									: stage === "intake"
									? "Next Step"
									: "Confirm & Kickoff"}
							</button>
						)}
						{result && (
							<button
								onClick={handleClose}
								className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-[0.14em] transition-all duration-300 text-white"
								style={{
									background: "rgba(255,255,255,0.05)",
									border: "1px solid rgba(255,255,255,0.1)",
								}}
							>
								Close
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export default AIGenerateModal;
