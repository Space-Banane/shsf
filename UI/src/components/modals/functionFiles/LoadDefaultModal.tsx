import React, { useState, useEffect, useCallback } from "react";
import Modal from "../Modal";
import { cancelBtnClass, ModalError } from "../Modal";
import { Icon } from "../../ui/Icon";
import { loadPossibleDefaults, DefaultTemplate } from "../../../services/backend.files";

function groupDefaultsByLanguage(
	defaultsList: DefaultTemplate[],
): Record<string, DefaultTemplate[]> {
	const grouped: Record<string, DefaultTemplate[]> = {};
	for (const template of defaultsList) {
		const language = template.language || "other";
		if (!grouped[language]) grouped[language] = [];
		grouped[language].push(template);
	}
	return grouped;
}

interface LoadDefaultModalProps {
	isOpen: boolean;
	onClose: () => void;
	onLoadDefault: (defaultToLoad: string) => Promise<boolean>;
	functionLanguage?: string;
}

function LoadDefaultModal({
	isOpen,
	onClose,
	onLoadDefault,
	functionLanguage,
}: LoadDefaultModalProps) {
	const [defaults, setDefaults] = useState<DefaultTemplate[]>([]);
	const [groupedDefaults, setGroupedDefaults] = useState<Record<string, DefaultTemplate[]>>({});
	const [isLoading, setIsLoading] = useState(false);
	const [isFetchingDefaults, setIsFetchingDefaults] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchDefaults = useCallback(async () => {
		setIsFetchingDefaults(true);
		setError(null);
		try {
			const response = await loadPossibleDefaults();
			if (response.status === "OK") {
				let filteredDefaults = response.defaults;
				if (typeof functionLanguage === "string") {
					const trimmedLanguage = functionLanguage.trim();
					if (trimmedLanguage !== "") {
						const lowerLanguage = trimmedLanguage.toLowerCase();
						const normalizedLanguage = lowerLanguage.split(":")[0];
						if (normalizedLanguage) {
							filteredDefaults = response.defaults.filter(
								(template) => template.language.toLowerCase() === normalizedLanguage,
							);
						}
					}
				}
				setDefaults(filteredDefaults);
				setGroupedDefaults(groupDefaultsByLanguage(filteredDefaults));
			} else {
				setError("Failed to load available defaults");
			}
		} catch {
			setError("An error occurred while fetching defaults");
		} finally {
			setIsFetchingDefaults(false);
		}
	}, [functionLanguage]);

	useEffect(() => {
		if (isOpen) fetchDefaults();
	}, [isOpen, fetchDefaults]);

	const handleSelectDefault = async (defaultToLoad: string) => {
		setError(null);
		setIsLoading(true);
		try {
			const success = await onLoadDefault(defaultToLoad);
			if (success) onClose();
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		if (!isLoading && !isFetchingDefaults) { setError(null); onClose(); }
	};

	const getLanguageDisplayName = (language: string): string => {
		return language.charAt(0).toUpperCase() + language.slice(1);
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Load Default Template"
			maxWidth="lg"
			isLoading={isLoading || isFetchingDefaults}
		>
			<div className="space-y-5">
				<ModalError message={error} />

				{defaults.length === 0 && !isFetchingDefaults ? (
					<div className="text-center py-8">
						<p className="text-sm text-text/60">
							{functionLanguage
								? `No ${functionLanguage.split(":")[0]} templates available`
								: "No default templates available"}
						</p>
					</div>
				) : (
					<>
						<p className="text-xs text-muted">
							Select a template to load. This will replace the current file content.
						</p>

						<div className="space-y-5">
							{Object.entries(groupedDefaults).map(([language, languageDefaults]) => (
								<div key={language} className="space-y-2">
									<div className="flex items-center gap-2">
										<h3 className="text-xs font-medium text-muted uppercase tracking-wider">
											{getLanguageDisplayName(language)}
										</h3>
										<span className="text-xs text-muted/60">({languageDefaults.length})</span>
									</div>
									<div className="space-y-1.5">
										{languageDefaults.map((template) => (
											<button
												key={template.id}
												onClick={() => handleSelectDefault(template.id)}
												disabled={isLoading}
												className="w-full flex items-start gap-3 px-4 py-3 bg-surface border border-white/[0.07] rounded-lg text-left hover:border-primary/30 hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
											>
												<div className="flex-1 min-w-0">
													<p className="text-sm font-medium text-text">{template.name}</p>
													{template.description && (
														<p className="text-xs text-muted mt-0.5 line-clamp-2">
															{template.description}
														</p>
													)}
												</div>
												<Icon name="chevron-right" className="w-4 h-4 text-muted shrink-0 mt-0.5" />
											</button>
										))}
									</div>
								</div>
							))}
						</div>
					</>
				)}

				<div className="flex justify-end pt-2">
					<button onClick={handleClose} className={cancelBtnClass}>
						Close
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default LoadDefaultModal;
