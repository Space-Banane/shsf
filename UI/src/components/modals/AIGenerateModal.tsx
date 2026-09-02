import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
	FunctionFile,
	getImageDisplayName,
	Image,
	ImagesAsArray,
} from "../../types/Prisma";
import { generateWithAI, generateConfigWithAI, type AIMode } from "../../services/backend.ai";
import { createFunction } from "../../services/backend.functions";
import { useShiftEnterSubmit } from "../../hooks/useShiftEnterSubmit";
import Modal from "./Modal";
import { cancelBtnClass, primaryBtnClass, selectClass, textareaClass, labelClass } from "./Modal";

interface AIGenerateModalProps {
	isOpen: boolean;
	onClose: () => void;
	functionId?: number;
	namespaceId?: number;
	existingFiles?: FunctionFile[];
	onSuccess?: () => void;
	disabled?: boolean;
	disabledReason?: string;
}

function AIGenerateModal({
	isOpen,
	onClose,
	functionId,
	namespaceId,
	existingFiles = [],
	onSuccess,
	disabled = false,
	disabledReason,
}: AIGenerateModalProps) {
	const navigate = useNavigate();
	const [mode, setMode] = useState<AIMode>(functionId ? "revision" : "kickoff");
	const [stage, setStage] = useState<"intake" | "review" | "generating">(
		functionId ? "generating" : "intake",
	);

	const [prompt, setPrompt] = useState("");
	const [image, setImage] = useState<Image>("python:3.11");
	const [cacheEnabled, setCacheEnabled] = useState(false);
	const [dockerMount, setDockerMount] = useState(false);
	const [allowHttp, setAllowHttp] = useState(true);

	const [suggestedConfig, setSuggestedConfig] = useState<{
		name: string;
		description: string;
		startup_file: string;
	} | null>(null);

	const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<{ writtenFiles: string[]; model: string } | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const MAX_REVISION_FILES = 3;

	const toggleFileSelection = (filename: string) => {
		setSelectedFiles((prev) => {
			if (prev.includes(filename)) return prev.filter((f) => f !== filename);
			if (prev.length >= MAX_REVISION_FILES) return prev;
			return [...prev, filename];
		});
	};

	const handleNextToReview = async () => {
		if (!prompt.trim()) { setError("Please enter a description of what you want to build"); return; }
		setIsLoading(true); setError(null);
		try {
			const res = await generateConfigWithAI(prompt, image) as any;
			if (res.status === "OK") { setSuggestedConfig(res.data); setStage("review"); }
			else setError(res.message || "Failed to generate suggested configuration");
		} catch {
			setError("Failed to get AI suggestions");
		} finally {
			setIsLoading(false);
		}
	};

	const handleConfirmKickoff = async () => {
		if (!suggestedConfig || !namespaceId) return;
		setIsLoading(true); setError(null);
		try {
			const createRes = await createFunction({
				name: suggestedConfig.name,
				description: suggestedConfig.description,
				image,
				namespaceId,
				startup_file: suggestedConfig.startup_file,
				docker_mount: dockerMount,
				ai_kicked_off: true,
				settings: { allow_http: allowHttp },
			});
			if (createRes.status !== "OK") { setError(createRes.message); setIsLoading(false); return; }
			const newFunctionId = (createRes as any).data.id;
			setStage("generating");
			const genRes = await generateWithAI(newFunctionId, { mode: "kickoff", prompt });
			if (genRes.status === "OK" && "data" in genRes) {
				setResult(genRes.data);
				if (onSuccess) onSuccess();
				if (!functionId) { onClose(); navigate(`/functions/${newFunctionId}`); }
			} else {
				setError((genRes as any).message || "Generation failed (function created)");
			}
		} catch {
			setError("An error occurred during kickoff process");
		} finally {
			setIsLoading(false);
		}
	};

	const handleSubmit = async () => {
		if (!prompt.trim()) { setError("Please enter a prompt"); return; }
		if (mode === "revision" && selectedFiles.length === 0) { setError("Please select at least one file to revise"); return; }
		setIsLoading(true); setError(null); setResult(null);
		const controller = new AbortController();
		abortControllerRef.current = controller;
		try {
			const response = await generateWithAI(functionId!, {
				mode, prompt: prompt.trim(),
				files: mode === "revision" ? selectedFiles : undefined,
			}, controller.signal);
			if (response.status === "OK" && "data" in response) {
				setResult(response.data);
				if (onSuccess) onSuccess();
			} else {
				setError((response as any).message || "Unknown error occurred");
			}
		} catch (err: any) {
			if (err.name === "AbortError") return;
			setError("Network error — please try again");
		} finally {
			setIsLoading(false); abortControllerRef.current = null;
		}
	};

	const handleCancel = () => {
		if (abortControllerRef.current) abortControllerRef.current.abort();
		setIsLoading(false); abortControllerRef.current = null;
	};

	const handleClose = () => {
		if (isLoading) handleCancel();
		setPrompt(""); setSelectedFiles([]); setError(null); setResult(null);
		setMode(functionId ? "revision" : "kickoff");
		setStage(functionId ? "generating" : "intake");
		setSuggestedConfig(null);
		onClose();
		if (result) window.location.reload();
	};

	useShiftEnterSubmit(
		() => {
			if (functionId) {
				void handleSubmit();
			} else if (stage === "intake") {
				void handleNextToReview();
			} else if (stage === "review") {
				void handleConfirmKickoff();
			}
		},
		isOpen && !disabled && !isLoading && !result && (Boolean(functionId) || stage !== "generating"),
	);

	if (!isOpen) return null;

	if (disabled) {
		return (
			<Modal isOpen={isOpen} onClose={handleClose} title={functionId ? "Code Generation" : "AI Kickoff"} maxWidth="lg">
				<div className="space-y-4">
					<div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
						{disabledReason ?? "AI features are disabled until an OpenRouter API key is configured."}
					</div>
					<p className="text-sm text-muted">Open Account Settings to add a key, then reopen this dialog.</p>
				</div>
			</Modal>
		);
	}

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title={functionId ? "Code Generation" : "AI Kickoff"} maxWidth="lg" isLoading={isLoading}>
			<div className="space-y-5">
				<p className="text-xs text-muted uppercase tracking-wider">
					{stage === "intake" ? "Configure your function" : stage === "review" ? "Review configuration" : "Generate code"}
				</p>

				{stage === "intake" && !functionId && (
					<>
						<div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs bg-yellow-500/[0.07] border border-yellow-500/20 text-yellow-200/70">
							<svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
								<line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
							</svg>
							<span>
								<span className="font-bold text-yellow-300">Kickoff</span> generates files from scratch and may produce incorrect or incomplete code. Always review the output before running.
							</span>
						</div>

						<div>
							<label className={labelClass}>What should this function do?</label>
							<textarea
								disabled={isLoading}
								value={prompt}
								onChange={(e) => { setPrompt(e.target.value); setError(null); }}
								placeholder="Describe your function in detail (e.g. A Python function that fetches weather data from an API)..."
								className={`${textareaClass} font-mono`}
								rows={5}
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className={labelClass}>Runtime</label>
								<select value={image} onChange={(e) => setImage(e.target.value as Image)} className={selectClass}>
									{ImagesAsArray.map((img) => (
										<option key={img} value={img}>{getImageDisplayName(img)}</option>
									))}
								</select>
							</div>
							<div className="space-y-3">
								<label className={labelClass}>Options</label>
								{[
									{ id: "ai-cache", checked: cacheEnabled, onChange: setCacheEnabled, label: "Enable Caching" },
									{ id: "ai-docker", checked: dockerMount, onChange: setDockerMount, label: "Docker Mount" },
									{ id: "ai-http", checked: allowHttp, onChange: setAllowHttp, label: "Allow HTTP" },
								].map(({ id, checked, onChange, label }) => (
									<label key={id} className="flex items-center gap-3 cursor-pointer">
										<input
											type="checkbox"
											checked={checked}
											onChange={(e) => onChange(e.target.checked)}
											className="w-4 h-4 rounded border-white/[0.14] bg-background text-primary focus:ring-primary/30 focus:ring-offset-0"
										/>
										<span className="text-xs text-muted hover:text-text transition-colors">{label}</span>
									</label>
								))}
							</div>
						</div>
					</>
				)}

				{stage === "review" && suggestedConfig && (
					<div className="space-y-4">
						<div className="bg-primary/5 border border-primary/15 rounded-lg p-4 space-y-3">
							<div>
								<p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Function Name</p>
								<input
									type="text"
									value={suggestedConfig.name}
									onChange={(e) => setSuggestedConfig({ ...suggestedConfig, name: e.target.value })}
									className="w-full bg-transparent text-sm font-bold text-text outline-none border-b border-white/[0.07] pb-1 focus:border-primary/50"
								/>
							</div>
							<div>
								<p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Description</p>
								<textarea
									value={suggestedConfig.description}
									onChange={(e) => setSuggestedConfig({ ...suggestedConfig, description: e.target.value })}
									className="w-full bg-transparent text-xs text-text/80 outline-none h-12 resize-none"
								/>
							</div>
							<div className="flex gap-4">
								<div className="flex-1">
									<p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Startup File</p>
									<input
										type="text"
										value={suggestedConfig.startup_file}
										onChange={(e) => setSuggestedConfig({ ...suggestedConfig, startup_file: e.target.value })}
										className="w-full bg-transparent text-xs font-mono text-muted outline-none"
									/>
								</div>
								<div className="flex-1 text-right">
									<p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Runtime</p>
									<p className="text-xs text-muted">{image}</p>
								</div>
							</div>
						</div>
						<p className="text-[10px] text-muted italic">
							Note: You can configure RAM, Timeout, and Environment variables in the function settings later.
						</p>
					</div>
				)}

				{stage === "generating" && (
					<div className="space-y-5">
						{functionId && (
							<div>
								<label className={labelClass}>Mode</label>
								<div className="flex rounded-lg border border-white/[0.07] bg-background/40 p-1 gap-1">
									{(["kickoff", "revision"] as AIMode[]).map((m) => (
										<button
											key={m}
											disabled={isLoading}
											onClick={() => { setMode(m); setError(null); setResult(null); setSelectedFiles([]); }}
											className={`flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${
												mode === m
													? "bg-primary/20 border border-primary/40 text-primary"
													: "text-muted border border-transparent"
											}`}
										>
											{m === "kickoff" ? "Kickoff" : "Revision"}
										</button>
									))}
								</div>
							</div>
						)}

						{mode === "revision" && functionId && (
							<div>
								<label className={labelClass}>
									Files to revise{" "}
									<span className="text-muted normal-case tracking-normal font-normal">
										(select up to {MAX_REVISION_FILES})
									</span>
								</label>
								{existingFiles.length === 0 ? (
									<p className="text-xs text-muted italic">No files found for this function</p>
								) : (
									<div className="flex flex-wrap gap-2">
										{existingFiles.map((file) => {
											const selected = selectedFiles.includes(file.name);
											const isDisabled = !selected && selectedFiles.length >= MAX_REVISION_FILES;
											return (
												<button
													key={file.id}
													disabled={isDisabled || isLoading}
													onClick={() => toggleFileSelection(file.name)}
													className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
														selected
															? "bg-primary/20 border-primary/50 text-primary"
															: isDisabled
															? "bg-background/20 border-white/[0.07] text-muted/40 cursor-not-allowed"
															: "bg-background/40 border-white/[0.07] text-muted hover:text-text hover:border-white/[0.14]"
													}`}
												>
													{selected && <span className="mr-1 text-primary">✓</span>}
													{file.name}
												</button>
											);
										})}
									</div>
								)}
							</div>
						)}

						{functionId && (
							<div>
								<label className={labelClass}>
									{mode === "kickoff" ? "Describe your function" : "Revision instructions"}
								</label>
								<textarea
									disabled={isLoading}
									value={prompt}
									onChange={(e) => { setPrompt(e.target.value); setError(null); }}
									placeholder={
										mode === "kickoff"
											? "Explain what the function should do..."
											: "What changes should be made to the selected files?"
									}
									className={`${textareaClass} font-mono`}
									rows={5}
								/>
							</div>
						)}

						{isLoading && (
							<div className="flex flex-col items-center justify-center py-8 gap-4">
								<div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
								<p className="text-xs font-bold tracking-[0.2em] text-primary uppercase animate-pulse">
									AI is processing
								</p>
							</div>
						)}

						{result && (
							<div className="bg-green-500/5 border border-green-500/15 rounded-lg p-4 space-y-3">
								<div className="flex items-center gap-2 text-green-400">
									<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
										<path d="M20 6L9 17l-5-5" />
									</svg>
									<span className="text-xs font-bold uppercase tracking-widest">Success</span>
								</div>
								<p className="text-xs text-muted">
									Successfully wrote {result.writtenFiles.length} files using {result.model}.
								</p>
								<div className="flex flex-wrap gap-2">
									{result.writtenFiles.map((file) => (
										<span key={file} className="px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-[10px] font-mono text-green-400">
											{file}
										</span>
									))}
								</div>
							</div>
						)}
					</div>
				)}

				{error && (
					<div className="flex items-start gap-3 p-3 rounded-lg text-xs bg-red-500/[0.07] border border-red-500/20 text-red-300">
						<svg className="w-4 h-4 mt-0.5 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
						<span>{error}</span>
					</div>
				)}

				<div className="flex items-center justify-between pt-4 border-t border-white/[0.07]">
					<div>
						{isLoading ? (
							<button onClick={handleCancel} className="text-xs font-bold text-muted hover:text-red-400 transition-colors uppercase tracking-widest">
								Cancel
							</button>
						) : stage === "review" ? (
							<button onClick={() => setStage("intake")} className={cancelBtnClass}>
								Back
							</button>
						) : null}
					</div>
					<div className="flex gap-3">
						{!result && (
							<button
								disabled={isLoading}
								onClick={functionId ? handleSubmit : stage === "intake" ? handleNextToReview : handleConfirmKickoff}
								className={primaryBtnClass}
							>
								{isLoading ? "Processing..." :
									functionId ? "Generate" :
									stage === "intake" ? "Next Step" :
									"Confirm & Kickoff"}
							</button>
						)}
						{result && (
							<button onClick={handleClose} className={cancelBtnClass}>Close</button>
						)}
					</div>
				</div>
			</div>
		</Modal>
	);
}

export default AIGenerateModal;
