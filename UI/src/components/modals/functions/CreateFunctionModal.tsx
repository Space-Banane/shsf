import React, { useState, useEffect } from "react";
import Modal from "../Modal";
import {
	cancelBtnClass,
	primaryBtnClass,
	inputClass,
	selectClass,
	textareaClass,
	labelClass,
	ModalSection,
	ModalFooter,
	ModalError,
	ToggleRow,
} from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import { createFunction, getDeprecatedImages } from "../../../services/backend.functions";
import {
	getImageDisplayName,
	Image,
	ImagesAsArray,
	Namespace,
} from "../../../types/Prisma";
import { useNavigate } from "react-router-dom";

interface CreateFunctionModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	namespaces: Namespace[];
}

function CreateFunctionModal({
	isOpen,
	onClose,
	onSuccess,
	namespaces,
}: CreateFunctionModalProps) {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [namespaceId, setNamespaceId] = useState<number | null>(null);
	const [image, setImage] = useState<Image>("python:3.11");
	const [maxRam, setMaxRam] = useState<number | undefined>();
	const [timeout, setTimeout] = useState<number | undefined>();
	const [allowHttp, setAllowHttp] = useState<boolean>(false);
	const [startupFile, setStartupFile] = useState<string | undefined>();
	const [executionAlias, setExecutionAlias] = useState<string>("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [dockerMount, setDockerMount] = useState<boolean>(false);
	const [networkRestricted, setNetworkRestricted] = useState<boolean>(false);
	const [ffmpegInstall, setFfmpegInstall] = useState<boolean>(false);
	const [opencvInstall, setOpencvInstall] = useState<boolean>(false);
	const [corsOrigins, setCorsOrigins] = useState<string>("");
	const [corsOriginInput, setCorsOriginInput] = useState<string>("");
	const [deprecatedImages, setDeprecatedImages] = useState<string[]>([]);

	useEffect(() => {
		getDeprecatedImages().then(setDeprecatedImages).catch(() => {});
	}, []);

	const resetForm = () => {
		setName(""); setDescription(""); setNamespaceId(null);
		setMaxRam(undefined); setTimeout(undefined); setAllowHttp(false);
		setStartupFile(undefined); setExecutionAlias("");
		setDockerMount(false); setNetworkRestricted(false);
		setFfmpegInstall(false); setOpencvInstall(false);
		setCorsOrigins(""); setError("");
	};

	const isHtmlFunction = !!startupFile && startupFile.trim().toLowerCase().endsWith(".html");

	const corsOriginsArray = corsOrigins.split(",").map((o) => o.trim()).filter((o) => o.length > 0);

	const addCorsOrigin = () => {
		const val = corsOriginInput.trim();
		if (val && !corsOriginsArray.includes(val)) {
			setCorsOrigins([...corsOriginsArray, val].join(", "));
			setCorsOriginInput("");
		}
	};

	const removeCorsOrigin = (origin: string) => {
		setCorsOrigins(corsOriginsArray.filter((o) => o !== origin).join(", "));
	};

	const handleSubmit = async () => {
		if (!namespaceId) { setError("Please select a namespace"); return; }
		if (!name.trim()) { setError("Please enter a function name"); return; }

		const executionAliasValid = /^[a-zA-Z0-9-_]+$/.test(executionAlias);
		if (executionAlias && (!executionAliasValid || executionAlias.length < 8 || executionAlias.length > 128)) {
			setError("Execution alias must be 8-128 characters and can only contain alphanumeric characters, hyphens, and underscores.");
			return;
		}

		setError(""); setIsLoading(true);

		try {
			const response = await createFunction({
				name, description, image, namespaceId,
				startup_file: startupFile,
				docker_mount: dockerMount,
				network_restricted: networkRestricted,
				ffmpeg_install: ffmpegInstall,
				opencv_install: opencvInstall,
				executionAlias: executionAlias.trim() === "" ? undefined : executionAlias,
				settings: { max_ram: maxRam, timeout, allow_http: allowHttp },
				cors_origins: corsOrigins,
			});

			if (response.status === "OK") {
				const createdFunctionId = response.data.id;
				onSuccess(); resetForm(); onClose();
				navigate(`/functions/${createdFunctionId}`);
			} else {
				setError("Error creating function: " + response.message);
			}
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		if (!isLoading) { onClose(); setError(""); }
	};

	useShiftEnterSubmit(() => handleSubmit(), isOpen && !isLoading);

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Create Function" maxWidth="lg" isLoading={isLoading}>
			<div className="space-y-6">
				<ModalError message={error} />

				<ModalSection title="Basic Information">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className={labelClass}>Function Name</label>
							<input
								type="text"
								placeholder="my-awesome-function"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className={inputClass}
								disabled={isLoading}
							/>
						</div>
						<div>
							<label className={labelClass}>Namespace</label>
							<select
								value={namespaceId || ""}
								onChange={(e) => setNamespaceId(Number(e.target.value))}
								className={selectClass}
								disabled={isLoading}
							>
								<option value="" disabled>Select Namespace</option>
								{namespaces.map((ns) => (
									<option key={ns.id} value={ns.id}>{ns.name}</option>
								))}
							</select>
						</div>
					</div>
					<div>
						<label className={labelClass}>Description</label>
						<textarea
							placeholder="Brief description of what this function does..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className={textareaClass}
							rows={3}
							disabled={isLoading}
						/>
					</div>
					<div>
						<label className={labelClass}>Execution Alias</label>
						<input
							type="text"
							placeholder="Optional: alias for execution (e.g. very-important-function)"
							value={executionAlias}
							onChange={(e) => setExecutionAlias(e.target.value)}
							className={inputClass}
							disabled={isLoading}
						/>
					</div>
				</ModalSection>

				<ModalSection title="Runtime Configuration">
					<div className={isHtmlFunction ? "opacity-50 pointer-events-none" : ""}>
						<label className={labelClass}>Runtime Image</label>
						<select
							value={image}
							onChange={(e) => setImage(e.target.value as Image)}
							className={selectClass}
							disabled={isLoading || isHtmlFunction}
						>
							{ImagesAsArray.map((img) => {
								const isDeprecated = deprecatedImages.includes(img);
								return (
									<option key={img} value={img} disabled={isDeprecated}>
										{getImageDisplayName(img)}{isDeprecated ? " (deprecated)" : ""}
									</option>
								);
							})}
						</select>
						{isHtmlFunction && (
							<p className="text-xs text-yellow-400 mt-1">Disabled for HTML startup files</p>
						)}
					</div>
					<div>
						<label className={labelClass}>Startup File</label>
						<input
							type="text"
							placeholder="main.py, index.js, etc."
							value={startupFile || ""}
							onChange={(e) => setStartupFile(e.target.value)}
							className={`${inputClass} ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
							disabled={isLoading}
						/>
					</div>
				</ModalSection>

				<ModalSection title="Resource Settings">
					<div className={isHtmlFunction ? "opacity-50 pointer-events-none" : ""}>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className={labelClass}>Max RAM (MB)</label>
								<input
									type="number"
									placeholder="512"
									value={maxRam || ""}
									onChange={(e) => setMaxRam(Number(e.target.value))}
									className={inputClass}
									disabled={isLoading || isHtmlFunction}
								/>
							</div>
							<div>
								<label className={labelClass}>Timeout (sec)</label>
								<input
									type="number"
									placeholder="30"
									value={timeout || ""}
									max={300}
									onChange={(e) => setTimeout(Number(e.target.value))}
									className={inputClass}
									disabled={isLoading || isHtmlFunction}
								/>
							</div>
						</div>
						{isHtmlFunction && (
							<p className="text-xs text-yellow-400 mt-1">Resource settings are disabled for HTML startup files</p>
						)}
					</div>
				</ModalSection>

				<ModalSection title="Advanced Settings">
					<div className="bg-background/40 border border-white/[0.07] rounded-lg p-3">
						<p className="text-xs font-medium text-text/80 mb-1">Guest Users</p>
						<p className="text-xs text-muted">
							You can't add guest users yet. Please create the function first, then edit it to assign guests.
						</p>
					</div>

					<ToggleRow
						id="allow-http-create"
						checked={allowHttp}
						onChange={setAllowHttp}
						disabled={isLoading}
						label="Allow HTTP"
						description="Enable inbound HTTP/HTTPS requests"
					/>

					<div className={isHtmlFunction ? "opacity-50 pointer-events-none" : ""}>
						<ToggleRow
							id="network-restricted-create"
							checked={networkRestricted}
							onChange={setNetworkRestricted}
							disabled={isLoading || isHtmlFunction}
							label="Restrict Network"
							description="Run the container with Docker network disabled"
						/>
						{isHtmlFunction && (
							<p className="text-xs text-muted mt-1">Network restrictions are disabled for HTML startup files</p>
						)}
					</div>

					<div className={isHtmlFunction ? "opacity-50 pointer-events-none" : ""}>
						<ToggleRow
							id="docker-mount-create"
							checked={dockerMount}
							onChange={setDockerMount}
							disabled={isLoading || isHtmlFunction}
							label="Mount Docker Socket"
							description="Mounts /var/run/docker.sock (Security risk!)"
						/>
						{isHtmlFunction && (
							<p className="text-xs text-muted mt-1">Docker mount is disabled for HTML startup files</p>
						)}
					</div>

					<div className={isHtmlFunction ? "opacity-50 pointer-events-none" : ""}>
						<ToggleRow
							id="ffmpeg-install-create"
							checked={ffmpegInstall}
							onChange={setFfmpegInstall}
							disabled={isLoading || isHtmlFunction}
							label="Install FFmpeg"
							description="Installs ffmpeg for media processing"
						/>
						{isHtmlFunction && (
							<p className="text-xs text-muted mt-1">FFmpeg install is disabled for HTML startup files</p>
						)}
					</div>

					<div className={isHtmlFunction ? "opacity-50 pointer-events-none" : ""}>
						<ToggleRow
							id="opencv-install-create"
							checked={opencvInstall}
							onChange={setOpencvInstall}
							disabled={isLoading || isHtmlFunction}
							label="Install OpenCV"
							description="Installs python3-opencv for computer vision"
						/>
						{isHtmlFunction && (
							<p className="text-xs text-muted mt-1">OpenCV install is disabled for HTML startup files</p>
						)}
					</div>

					<div className="space-y-2">
						<label className={labelClass}>CORS Origins</label>
						{corsOriginsArray.length > 0 && (
							<div className="flex flex-wrap gap-2 mb-2">
								{corsOriginsArray.map((origin) => (
									<span key={origin} className="flex items-center gap-1.5 bg-background/60 border border-white/[0.07] text-text text-xs px-2.5 py-1 rounded-full">
										{origin}
										<button
											type="button"
											className="text-muted hover:text-red-400 transition-colors"
											onClick={() => removeCorsOrigin(origin)}
											disabled={isLoading}
											aria-label={`Remove ${origin}`}
										>
											×
										</button>
									</span>
								))}
							</div>
						)}
						<div className="flex gap-2">
							<input
								type="text"
								placeholder="Add origin (e.g. https://example.com)"
								value={corsOriginInput}
								onChange={(e) => setCorsOriginInput(e.target.value)}
								className={`${inputClass} flex-1`}
								disabled={isLoading}
								onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCorsOrigin(); } }}
							/>
							<button
								type="button"
								onClick={addCorsOrigin}
								className={primaryBtnClass}
								disabled={isLoading || !corsOriginInput.trim()}
							>
								Add
							</button>
						</div>
						<p className="text-xs text-muted">Leave empty to allow only default origins.</p>
					</div>
				</ModalSection>

				<ModalFooter>
					<button onClick={handleClose} className={cancelBtnClass} disabled={isLoading}>
						Cancel
					</button>
					<button onClick={handleSubmit} className={primaryBtnClass} disabled={isLoading}>
						Create Function
					</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}

export default CreateFunctionModal;
