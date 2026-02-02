import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { loadPossibleDefaults } from "../../services/backend.files";

interface LoadDefaultModalProps {
	isOpen: boolean;
	onClose: () => void;
	onLoadDefault: (defaultToLoad: string) => Promise<boolean>;
}

function LoadDefaultModal({
	isOpen,
	onClose,
	onLoadDefault,
}: LoadDefaultModalProps) {
	const [defaults, setDefaults] = useState<string[]>([]);
	const [groupedDefaults, setGroupedDefaults] = useState<
		Record<string, string[]>
	>({});
	const [isLoading, setIsLoading] = useState(false);
	const [isFetchingDefaults, setIsFetchingDefaults] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Fetch defaults when modal opens
	useEffect(() => {
		if (isOpen) {
			fetchDefaults();
		}
	}, [isOpen]);

	const fetchDefaults = async () => {
		setIsFetchingDefaults(true);
		setError(null);
		try {
			const response = await loadPossibleDefaults();
			if (response.status === "OK") {
				setDefaults(response.defaults);
				// Group defaults by language prefix
				const grouped = groupDefaultsByLanguage(response.defaults);
				setGroupedDefaults(grouped);
			} else {
				setError("Failed to load available defaults");
			}
		} catch (err) {
			console.error("Error fetching defaults:", err);
			setError("An error occurred while fetching defaults");
		} finally {
			setIsFetchingDefaults(false);
		}
	};

	const groupDefaultsByLanguage = (
		defaultsList: string[],
	): Record<string, string[]> => {
		const grouped: Record<string, string[]> = {};

		for (const defaultName of defaultsList) {
			// Extract language prefix (e.g., "python_" from "python_default")
			const underscoreIndex = defaultName.indexOf("_");
			if (underscoreIndex > 0) {
				const language = defaultName.substring(0, underscoreIndex);
				const displayName = defaultName.substring(underscoreIndex + 1);

				if (!grouped[language]) {
					grouped[language] = [];
				}
				grouped[language].push(defaultName);
			} else {
				// No prefix found, add to "other" category
				if (!grouped["other"]) {
					grouped["other"] = [];
				}
				grouped["other"].push(defaultName);
			}
		}

		return grouped;
	};

	const handleSelectDefault = async (defaultToLoad: string) => {
		setError(null);
		setIsLoading(true);
		try {
			const success = await onLoadDefault(defaultToLoad);
			if (success) {
				onClose();
			}
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		if (!isLoading && !isFetchingDefaults) {
			setError(null);
			onClose();
		}
	};

	const getLanguageEmoji = (language: string): string => {
		const emojiMap: Record<string, string> = {
			python: "🐍",
			javascript: "📜",
			typescript: "📘",
			go: "🐹",
			rust: "🦀",
			lua: "🌙",
			other: "📄",
		};
		return emojiMap[language] || "📝";
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
			<div className="space-y-4">
				{error && (
					<div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
						<p className="text-red-400 text-sm">{error}</p>
					</div>
				)}

				{isFetchingDefaults ? (
					<div className="flex items-center justify-center py-8">
						<div className="text-center space-y-2">
							<div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
							<p className="text-text/70 text-sm">Loading available templates...</p>
						</div>
					</div>
				) : defaults.length === 0 ? (
					<div className="text-center py-8">
						<div className="text-4xl mb-2">📭</div>
						<p className="text-text/70">No default templates available</p>
					</div>
				) : (
					<div className="space-y-6">
						<p className="text-text/70 text-sm">
							Select a default template to load into the current file. This will
							replace the current content.
						</p>

						{Object.entries(groupedDefaults).map(([language, languageDefaults]) => (
							<div key={language} className="space-y-2">
								<h3 className="text-sm font-semibold text-primary flex items-center gap-2">
									<span>{getLanguageEmoji(language)}</span>
									<span>{getLanguageDisplayName(language)}</span>
								</h3>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									{languageDefaults.map((defaultName) => {
										// Extract display name (remove language prefix)
										const underscoreIndex = defaultName.indexOf("_");
										const displayName =
											underscoreIndex > 0
												? defaultName.substring(underscoreIndex + 1)
												: defaultName;

										return (
											<button
												key={defaultName}
												onClick={() => handleSelectDefault(defaultName)}
												disabled={isLoading}
												className="group relative bg-background/50 border border-primary/20 rounded-lg p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
											>
												<div className="flex items-center gap-3">
													<div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
														📄
													</div>
													<div className="flex-1 min-w-0">
														<h4 className="font-medium text-primary truncate">
															{displayName}
														</h4>
														<p className="text-xs text-text/60 truncate">
															{defaultName}
														</p>
													</div>
													<div className="text-primary/40 group-hover:text-primary transition-colors">
														→
													</div>
												</div>
											</button>
										);
									})}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</Modal>
	);
}

export default LoadDefaultModal;
