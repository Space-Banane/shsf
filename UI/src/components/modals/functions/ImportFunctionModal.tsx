import React, { useState, useRef, useEffect } from "react";
import Modal from "../Modal";
import { cancelBtnClass, primaryBtnClass, inputClass, selectClass, labelClass, ModalError } from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import { createFunction } from "../../../services/backend.functions";
import { createOrUpdateFile } from "../../../services/backend.files";
import { createTrigger } from "../../../services/backend.triggers";
import { getNamespaces } from "../../../services/backend.namespaces";
import { Namespace } from "../../../types/Prisma";
import { useNavigate } from "react-router-dom";

export interface SHSFExport {
	shsf_version: string;
	name: string;
	description: string;
	image: string;
	startup_file: string;
	docker_mount: boolean;
	network_restricted?: boolean;
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
	defaultNamespaceId?: number;
}

function ImportFunctionModal({ isOpen, onClose, defaultNamespaceId }: ImportFunctionModalProps) {
	const navigate = useNavigate();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [parsed, setParsed] = useState<SHSFExport | null>(null);
	const [parseError, setParseError] = useState<string>("");
	const [namespaces, setNamespaces] = useState<Namespace[]>([]);
	const [selectedNamespaceId, setSelectedNamespaceId] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [step, setStep] = useState<"upload" | "confirm">("upload");
	const [importName, setImportName] = useState("");
	const [importDescription, setImportDescription] = useState("");

	useShiftEnterSubmit(
		() => { if (step === "confirm") handleImport(); },
		isOpen && !isLoading && step === "confirm",
	);

	useEffect(() => {
		if (!isOpen) return;
		getNamespaces(false).then((res) => {
			if (res.status === "OK" && "data" in res) {
				const list = res.data as Namespace[];
				setNamespaces(list);
				const defaultId = defaultNamespaceId ?? (list.length > 0 ? list[0].id : null);
				setSelectedNamespaceId(defaultId);
			}
		});
	}, [isOpen, defaultNamespaceId]);

	const handleClose = () => {
		if (isLoading) return;
		setParsed(null); setParseError(""); setError("");
		setStep("upload"); setImportName(""); setImportDescription("");
		onClose();
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (!file.name.endsWith(".shsf")) { setParseError("Please select a valid .shsf file."); setParsed(null); return; }
		const reader = new FileReader();
		reader.onload = (evt) => {
			try {
				const content = evt.target?.result as string;
				const data = JSON.parse(content) as SHSFExport;
				if (!data.shsf_version) { setParseError("Invalid .shsf file: missing shsf_version field."); setParsed(null); return; }
				if (!data.name) { setParseError("Invalid .shsf file: missing name field."); setParsed(null); return; }
				if (!data.image) { setParseError("Invalid .shsf file: missing image field."); setParsed(null); return; }
				if (!data.files) { setParseError("Invalid .shsf file: missing files field."); setParsed(null); return; }
				setParseError(""); setParsed(data);
				setImportName(data.name); setImportDescription(data.description);
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
		setIsLoading(true); setError("");
		try {
			const createRes = await createFunction({
				name: importName.trim() || parsed.name,
				description: importDescription.trim() || parsed.description,
				image: parsed.image as any,
				startup_file: parsed.startup_file,
				docker_mount: parsed.docker_mount ?? false,
				network_restricted: parsed.network_restricted ?? false,
				ffmpeg_install: parsed.ffmpeg_install ?? false,
				settings: parsed.settings,
				namespaceId: selectedNamespaceId,
				cors_origins: parsed.cors_origins,
				imported: true,
			});
			if (createRes.status !== "OK") { setError((createRes as any).message || "Failed to create function."); return; }
			const newFunctionId = (createRes as any).data.id as number;
			for (const file of parsed.files) {
				await createOrUpdateFile(newFunctionId, { filename: file.name, code: file.content });
			}
			for (const trigger of parsed.triggers ?? []) {
				await createTrigger(newFunctionId, { name: trigger.name, description: trigger.description, cron: trigger.cron, data: trigger.data, enabled: trigger.enabled ?? false });
			}
			handleClose();
			navigate("/functions");
		} catch {
			setError("An unexpected error occurred during import.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Import Function" maxWidth="md" isLoading={isLoading}>
			<div className="space-y-4">
				<ModalError message={error} />

				{step === "upload" && (
					<div className="space-y-4">
						<p className="text-xs text-muted">
							Select a <span className="font-mono text-primary">.shsf</span> file exported from this
							platform to import the function and all its files.
						</p>
						<div
							className="border border-dashed border-white/[0.14] rounded-lg p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
							onClick={() => fileInputRef.current?.click()}
						>
							<p className="text-sm text-muted">Click to select a <span className="font-mono">.shsf</span> file</p>
							<input ref={fileInputRef} type="file" accept=".shsf" className="hidden" onChange={handleFileChange} />
						</div>
						{parseError && <ModalError message={parseError} />}
					</div>
				)}

				{step === "confirm" && parsed && (
					<div className="space-y-4">
						<div className="bg-background/40 border border-white/[0.07] rounded-lg p-4 space-y-3">
							<div>
								<label className={labelClass}>Name</label>
								<input type="text" value={importName} onChange={(e) => setImportName(e.target.value)} className={inputClass} disabled={isLoading} />
							</div>
							<div>
								<label className={labelClass}>Description</label>
								<input type="text" value={importDescription} onChange={(e) => setImportDescription(e.target.value)} className={inputClass} disabled={isLoading} />
							</div>
							<div className="grid grid-cols-2 gap-2 text-xs">
								{[
									["Runtime", parsed.image],
									["Startup File", parsed.startup_file],
									["Files", String(parsed.files?.length ?? 0)],
									["Triggers", String(parsed.triggers?.length ?? 0)],
								].map(([label, value]) => (
									<div key={label} className="bg-background/60 border border-white/[0.07] rounded-lg p-2">
										<span className="text-muted">{label}</span>
										<p className="font-mono text-text/80 truncate">{value}</p>
									</div>
								))}
							</div>
							{(parsed.env_keys?.length ?? 0) > 0 && (
								<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
									<p className="text-yellow-300 text-xs font-semibold mb-1">Environment Variables Stripped</p>
									<p className="text-yellow-200/70 text-xs">Values were not exported. Re-add them after importing:</p>
									<div className="flex flex-wrap gap-1 mt-2">
										{parsed.env_keys!.map((key) => (
											<span key={key} className="font-mono text-xs bg-yellow-900/30 border border-yellow-500/20 px-2 py-0.5 rounded text-yellow-200">{key}</span>
										))}
									</div>
								</div>
							)}
						</div>

						<div>
							<label className={labelClass}>Target namespace</label>
							<select value={selectedNamespaceId ?? ""} onChange={(e) => setSelectedNamespaceId(Number(e.target.value))} className={selectClass} disabled={isLoading}>
								{namespaces.length === 0 && <option value="" disabled>No namespaces available</option>}
								{namespaces.map((ns) => <option key={ns.id} value={ns.id}>{ns.name}</option>)}
							</select>
						</div>

						<div className="flex gap-3">
							<button className={cancelBtnClass} onClick={() => { setStep("upload"); setParsed(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} disabled={isLoading}>
								Back
							</button>
							<button className={`${primaryBtnClass} flex-1`} onClick={handleImport} disabled={isLoading || !selectedNamespaceId}>
								Import Function
							</button>
						</div>
					</div>
				)}
			</div>
		</Modal>
	);
}

export default ImportFunctionModal;
