import React, { useState } from "react";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, labelClass, ModalError } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import { massReplace, getMassReplaceFindings } from "../../../services/backend.functions";

interface MassReplaceModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: (message: string) => void;
}

interface Finding {
	fileId: number;
	fileName: string;
	functionName: string;
	matches: {
		lineNumber: number;
		oldLine: string;
		newLine: string;
	}[];
}

function MassReplaceModal({ isOpen, onClose, onSuccess }: MassReplaceModalProps) {
	const [find, setFind] = useState("");
	const [replace, setReplace] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [findings, setFindings] = useState<Finding[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [step, setStep] = useState<"search" | "preview">("search");

	useShiftEnterSubmit(
		() => { if (step === "search") handleSearch(); else handleReplace(); },
		isOpen && !isLoading,
	);

	const handleSearch = async () => {
		setError(null);
		if (!find) { setError("Please enter a string to find"); return; }
		setIsLoading(true);
		try {
			const result = await getMassReplaceFindings(find, replace);
			if (result.status === "OK") { setFindings(result.data); setStep("preview"); }
			else setError(result.message);
		} catch (err: any) {
			setError(err.message || "An error occurred during search");
		} finally {
			setIsLoading(false);
		}
	};

	const handleReplace = async () => {
		setError(null);
		setIsLoading(true);
		try {
			const result = await massReplace(find, replace);
			if (result.status === "OK") { onSuccess(result.message); resetAndClose(); }
			else setError(result.message);
		} catch (err: any) {
			setError(err.message || "An error occurred during replacement");
		} finally {
			setIsLoading(false);
		}
	};

	const resetAndClose = () => {
		setFind(""); setReplace(""); setFindings(null); setStep("search"); setError(null);
		onClose();
	};

	const handleClose = () => { if (!isLoading) resetAndClose(); };

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Mass Find & Replace"
			isLoading={isLoading}
		>
			<div className="space-y-5">
				{step === "search" ? (
					<>
						<p className="text-xs text-muted">
							Finds and replaces text across all function files you own. Functions with a Git URL
							are excluded.
						</p>
						<div>
							<label className={labelClass}>Find</label>
							<input
								type="text"
								placeholder="String to find"
								value={find}
								onChange={(e) => setFind(e.target.value)}
								className={inputClass}
								autoFocus
							/>
						</div>
						<div>
							<label className={labelClass}>Replace with</label>
							<input
								type="text"
								placeholder="Replacement string"
								value={replace}
								onChange={(e) => setReplace(e.target.value)}
								className={inputClass}
							/>
						</div>
					</>
				) : (
					<div className="space-y-3 max-h-[55vh] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
						<div className="flex justify-between items-center sticky top-0 bg-surface-raised py-2 z-10">
							<span className="text-xs font-medium text-muted uppercase tracking-wider">
								Preview Changes
							</span>
							<span className="text-xs text-muted">{findings?.length || 0} files affected</span>
						</div>

						{findings && findings.length > 0 ? (
							findings.map((finding) => (
								<div
									key={finding.fileId}
									className="bg-background/40 border border-white/[0.07] rounded-lg overflow-hidden"
								>
									<div className="px-3 py-2 bg-background/60 border-b border-white/[0.07]">
										<span className="text-xs font-medium text-primary">
											{finding.functionName} / {finding.fileName}
										</span>
									</div>
									<div className="text-[11px] font-mono leading-tight">
										{finding.matches.map((match, idx) => (
											<div key={idx} className="border-b border-white/[0.04] last:border-0">
												<div className="flex bg-red-900/20 px-2 py-1">
													<span className="w-8 text-red-500/50 shrink-0">{match.lineNumber}</span>
													<span className="text-red-300 break-all">- {match.oldLine}</span>
												</div>
												<div className="flex bg-green-900/20 px-2 py-1">
													<span className="w-8 text-green-500/50 shrink-0">{match.lineNumber}</span>
													<span className="text-green-300 break-all">+ {match.newLine}</span>
												</div>
											</div>
										))}
									</div>
								</div>
							))
						) : (
							<div className="text-center py-8 text-muted text-sm">No matches found.</div>
						)}
					</div>
				)}

				<ModalError message={error} />

				<div className="flex justify-end gap-3 pt-4 border-t border-white/[0.07]">
					<button onClick={handleClose} disabled={isLoading} className={cancelBtnClass}>
						Cancel
					</button>
					{step === "search" ? (
						<button onClick={handleSearch} disabled={isLoading} className={primaryBtnClass}>
							Preview Findings
						</button>
					) : (
						<>
							<button
								onClick={() => setStep("search")}
								disabled={isLoading}
								className={cancelBtnClass}
							>
								Back
							</button>
							<button
								onClick={handleReplace}
								disabled={isLoading || findings?.length === 0}
								className={primaryBtnClass}
							>
								Apply All
							</button>
						</>
					)}
				</div>
			</div>
		</Modal>
	);
}

export default MassReplaceModal;
