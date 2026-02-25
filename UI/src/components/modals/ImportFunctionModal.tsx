import React, { useState, useRef, useEffect } from "react";
import Modal from "./Modal";
import { createFunction } from "../../services/backend.functions";
import { createOrUpdateFile } from "../../services/backend.files";
import { createTrigger } from "../../services/backend.triggers";
import { getNamespaces } from "../../services/backend.namespaces";
import { Namespace } from "../../types/Prisma";
import { useNavigate } from "react-router-dom";

export interface SHSFExport {
	shsf_version: string;
	name: string;
	description: string;
	image: string;
	startup_file: string;
	docker_mount: boolean;
	ffmpeg_install: boolean;
	settings: {
		max_ram?: number;
		timeout?: number;
		allow_http?: boolean;
		tags?: string[];
		retry_on_failure?: boolean;
		retry_count?: number;
	};
	cors_origins?: string;
	/** Environment variable keys (values are redacted in exports) */
	env_keys?: string[];
	files: { name: string; content: string }[];
	triggers: {
		name: string;
		description: string;
		cron: string;
		data?: string;
		enabled?: boolean;
	}[];
}

interface ImportFunctionModalProps {
	isOpen: boolean;
	onClose: () => void;
	/** Pre-select this namespace in the dropdown */
	defaultNamespaceId?: number;
}

function ImportFunctionModal({
	isOpen,
	onClose,
	defaultNamespaceId,
}: ImportFunctionModalProps) {
	const navigate = useNavigate();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [parsed, setParsed] = useState<SHSFExport | null>(null);
	const [parseError, setParseError] = useState<string>("");
	const [namespaces, setNamespaces] = useState<Namespace[]>([]);
	const [selectedNamespaceId, setSelectedNamespaceId] = useState<number | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [step, setStep] = useState<"upload" | "confirm">("upload");
	const [importName, setImportName] = useState("");
	const [importDescription, setImportDescription] = useState("");

	// Load namespaces on open
	useEffect(() => {
		if (!isOpen) return;
		getNamespaces(false).then((res) => {
			if (res.status === "OK" && "data" in res) {
				const list = res.data as Namespace[];
				setNamespaces(list);
				const defaultId =
					defaultNamespaceId ?? (list.length > 0 ? list[0].id : null);
				setSelectedNamespaceId(defaultId);
			}
		});
	}, [isOpen, defaultNamespaceId]);

	const handleClose = () => {
		if (isLoading) return;
		setParsed(null);
		setParseError("");
		setError("");
		setStep("upload");
		setImportName("");
		setImportDescription("");
		onClose();
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (!file.name.endsWith(".shsf")) {
			setParseError("Please select a valid .shsf file.");
			setParsed(null);
			return;
		}

		const reader = new FileReader();
		reader.onload = (evt) => {
			try {
				const content = evt.target?.result as string;
				const data = JSON.parse(content) as SHSFExport;

				// Basic validation
				if (!data.shsf_version || !data.name || !data.image || !data.files) {
					setParseError(
						"Invalid .shsf file: missing required fields (name, image, files).",
					);
					setParsed(null);
					return;
				}

				setParseError("");
				setParsed(data);
				setImportName(data.name);
				setImportDescription(data.description);
				setStep("confirm");
			} catch {
				setParseError("Failed to parse .shsf file. Make sure it is valid JSON.");
				setParsed(null);
			}
		};
		reader.readAsText(file);
	};

	const handleImport = async () => {
		if (!parsed || !selectedNamespaceId) return;

		setIsLoading(true);
		setError("");

		try {
			// 1. Create the function
			const createRes = await createFunction({
				name: importName.trim() || parsed.name,
				description: importDescription.trim() || parsed.description,
				image: parsed.image as any,
				startup_file: parsed.startup_file,
				docker_mount: parsed.docker_mount ?? false,
				ffmpeg_install: parsed.ffmpeg_install ?? false,
				settings: parsed.settings,
				namespaceId: selectedNamespaceId,
				cors_origins: parsed.cors_origins,
			});

			if (createRes.status !== "OK") {
				setError((createRes as any).message || "Failed to create function.");
				setIsLoading(false);
				return;
			}

			const newFunctionId = (createRes as any).data.id as number;

			// 2. Create / update all files (startup file was already seeded, upsert is fine)
			for (const file of parsed.files) {
				await createOrUpdateFile(newFunctionId, {
					filename: file.name,
					code: file.content,
				});
			}

			// 3. Create triggers
			for (const trigger of parsed.triggers ?? []) {
				await createTrigger(newFunctionId, {
					name: trigger.name,
					description: trigger.description,
					cron: trigger.cron,
					data: trigger.data,
					enabled: trigger.enabled ?? false,
				});
			}

			// Done — navigate to the functions list
			handleClose();
			navigate("/functions");
		} catch (err) {
			console.error("Import error:", err);
			setError("An unexpected error occurred during import.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Import Function"
			maxWidth="md"
			isLoading={isLoading}
		>
			<div className="space-y-4 p-6">
				{error && (
					<div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
						<p className="text-red-300 text-sm">{error}</p>
					</div>
				)}

				{step === "upload" && (
					<div className="space-y-4">
						<p className="text-text/70 text-sm">
							Select a <span className="font-mono text-primary">.shsf</span> file
							exported from this platform to import the function and all its files.
						</p>

						<div
							className="border-2 border-dashed border-primary/30 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/60 transition-all duration-200 bg-background/20"
							onClick={() => fileInputRef.current?.click()}
						>
							<div className="text-4xl">📥</div>
							<p className="text-text/60 text-sm text-center">
								Click to select a <span className="font-mono">.shsf</span> file
							</p>
							<input
								ref={fileInputRef}
								type="file"
								accept=".shsf"
								className="hidden"
								onChange={handleFileChange}
							/>
						</div>

						{parseError && (
							<div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
								<p className="text-red-300 text-sm">{parseError}</p>
							</div>
						)}
					</div>
				)}

				{step === "confirm" && parsed && (
					<div className="space-y-4">
						{/* Preview */}
						<div className="bg-background/30 border border-primary/20 rounded-xl p-4 space-y-3">
							<div>
								<label className="text-xs font-medium text-gray-400 block mb-1">
									Name
								</label>
								<input
									type="text"
									value={importName}
									onChange={(e) => setImportName(e.target.value)}
									className="w-full p-2 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg text-sm"
									disabled={isLoading}
								/>
							</div>

							<div>
								<label className="text-xs font-medium text-gray-400 block mb-1">
									Description
								</label>
								<input
									type="text"
									value={importDescription}
									onChange={(e) => setImportDescription(e.target.value)}
									className="w-full p-2 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg text-sm"
									disabled={isLoading}
								/>
							</div>

							<div className="grid grid-cols-2 gap-2 text-xs">
								<div className="bg-background/50 border border-primary/10 rounded-lg p-2">
									<span className="text-text/50">Runtime</span>
									<p className="font-mono text-text/90 truncate">{parsed.image}</p>
								</div>
								<div className="bg-background/50 border border-primary/10 rounded-lg p-2">
									<span className="text-text/50">Startup File</span>
									<p className="font-mono text-text/90 truncate">{parsed.startup_file}</p>
								</div>
								<div className="bg-background/50 border border-primary/10 rounded-lg p-2">
									<span className="text-text/50">Files</span>
									<p className="text-text/90">{parsed.files?.length ?? 0}</p>
								</div>
								<div className="bg-background/50 border border-primary/10 rounded-lg p-2">
									<span className="text-text/50">Triggers</span>
									<p className="text-text/90">{parsed.triggers?.length ?? 0}</p>
								</div>
							</div>

							{(parsed.env_keys?.length ?? 0) > 0 && (
								<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
									<p className="text-yellow-300 text-xs font-semibold mb-1">
										⚠️ Environment Variables Stripped
									</p>
									<p className="text-yellow-200/70 text-xs">
										This export had the following env keys (values were not
										exported):
									</p>
									<div className="flex flex-wrap gap-1 mt-1">
										{parsed.env_keys!.map((key) => (
											<span
												key={key}
												className="font-mono text-xs bg-yellow-900/30 border border-yellow-500/20 px-2 py-0.5 rounded text-yellow-200"
											>
												{key}
											</span>
										))}
									</div>
									<p className="text-yellow-200/50 text-xs mt-1">
										Remember to re-add them after importing.
									</p>
								</div>
							)}
						</div>

						{/* Namespace selector */}
						<div>
							<label className="text-sm font-medium text-gray-300 block mb-1">
								Target Namespace
							</label>
							<select
								value={selectedNamespaceId ?? ""}
								onChange={(e) => setSelectedNamespaceId(Number(e.target.value))}
								className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg"
								disabled={isLoading}
							>
								{namespaces.length === 0 && (
									<option value="" disabled>
										No namespaces available
									</option>
								)}
								{namespaces.map((ns) => (
									<option key={ns.id} value={ns.id}>
										{ns.name}
									</option>
								))}
							</select>
						</div>

						<div className="flex gap-3">
							<button
								className="flex-1 px-4 py-2 bg-background/50 border border-primary/20 text-primary rounded-lg hover:border-primary/40 transition text-sm"
								onClick={() => {
									setStep("upload");
									setParsed(null);
									if (fileInputRef.current) fileInputRef.current.value = "";
								}}
								disabled={isLoading}
							>
								← Back
							</button>
							<button
								className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-[0_0_20px_rgba(124,131,253,0.3)] transition text-sm disabled:opacity-50"
								onClick={handleImport}
								disabled={isLoading || !selectedNamespaceId}
							>
								{isLoading ? "Importing..." : "📥 Import Function"}
							</button>
						</div>
					</div>
				)}
			</div>
		</Modal>
	);
}

export default ImportFunctionModal;
