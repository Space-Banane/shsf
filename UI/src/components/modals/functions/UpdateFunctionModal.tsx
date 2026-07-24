import React, { useState, useEffect, useRef } from "react";
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
import { useConfirm } from "../ConfirmModal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import {
	updateFunction,
	reinstallFfmpeg,
	reinstallOpencv,
	isFunctionImageDeprecated,
	getDeprecatedImages,
} from "../../../services/backend.functions";
import { getNamespaces } from "../../../services/backend.namespaces";
import {
	getImageDisplayName,
	getImageFamily,
	Image,
	ImagesAsArray,
	TriggerLog,
	XFunction,
	Namespace,
} from "../../../types/Prisma";
import { InlineCode } from "../../InlineCode";

interface UpdateFunctionModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	functionData: XFunction | null;
	lastLogs: TriggerLog[];
}

function UpdateFunctionModal({
	isOpen,
	onClose,
	onSuccess,
	functionData,
	lastLogs,
}: UpdateFunctionModalProps) {
	const confirm = useConfirm();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [image, setImage] = useState<Image>("python:3.9");
	const [maxRam, setMaxRam] = useState<number | undefined>();
	const [timeout, setTimeout] = useState<number | undefined>();
	const [allowHttp, setAllowHttp] = useState<boolean>(false);
	const [startupFile, setStartupFile] = useState<string | undefined>();
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [secureHeader, setSecureHeader] = useState<string | undefined>();
	const [dockerMount, setDockerMount] = useState<boolean>(false);
	const [networkRestricted, setNetworkRestricted] = useState<boolean>(false);
	const [ffmpegInstall, setFfmpegInstall] = useState<boolean>(false);
	const [opencv_install, setOpencvInstall] = useState<boolean>(false);
	const [corsOrigins, setCorsOrigins] = useState<string>("");
	const [corsOriginInput, setCorsOriginInput] = useState<string>("");
	const [executionAlias, setExecutionAlias] = useState<string>("");
	const [cacheEnabled, setCacheEnabled] = useState<boolean>(false);
	const [cacheTtl, setCacheTtl] = useState<number>(60);
	const [isReinstallingFfmpeg, setIsReinstallingFfmpeg] = useState(false);
	const [isReinstallingOpencv, setIsReinstallingOpencv] = useState(false);
	const [isClearingSourceFlags, setIsClearingSourceFlags] = useState(false);
	const [isDeprecated, setIsDeprecated] = useState<boolean>(false);
	const [deprecatedImages, setDeprecatedImages] = useState<string[]>([]);
	const [namespaces, setNamespaces] = useState<Namespace[]>([]);
	const [selectedNamespaceId, setSelectedNamespaceId] = useState<number>();
	const [sourceFlags, setSourceFlags] = useState<{ imported: boolean; ai_kicked_off: boolean }>({
		imported: false, ai_kicked_off: false,
	});
	const initializedFunctionIdRef = useRef<number | null>(null);

	useEffect(() => {
		if (functionData) {
			isFunctionImageDeprecated(functionData.id).then(setIsDeprecated).catch(() => {});
		}
	}, [functionData]);

	useEffect(() => {
		getDeprecatedImages().then(setDeprecatedImages).catch(() => {});
	}, []);

	useEffect(() => {
		if (!isOpen) return;
		getNamespaces().then((data) => {
			if (data.status === "OK") setNamespaces(data.data);
		}).catch(() => {});
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) { initializedFunctionIdRef.current = null; return; }
		if (functionData && initializedFunctionIdRef.current !== functionData.id) {
			setName(functionData.name);
			setDescription(functionData.description || "");
			setImage(functionData.image as Image);
			setMaxRam(functionData.max_ram);
			setTimeout(functionData.timeout);
			setAllowHttp(functionData.allow_http || false);
			setStartupFile(functionData.startup_file || "");
			setSecureHeader(functionData.secure_header || undefined);
			setDockerMount(functionData.docker_mount ?? false);
			setNetworkRestricted(functionData.network_restricted ?? false);
			setFfmpegInstall(functionData.ffmpeg_install ?? false);
			setOpencvInstall(functionData.opencv_install ?? false);
			setCorsOrigins(functionData.cors_origins || "");
			setExecutionAlias(functionData.executionAlias || "");
			setCacheEnabled(functionData.cache_enabled ?? false);
			setCacheTtl(functionData.cache_ttl ?? 60);
			setSelectedNamespaceId(functionData.namespaceId);
			setSourceFlags({
				imported: functionData.imported ?? false,
				ai_kicked_off: functionData.ai_kicked_off ?? false,
			});
			initializedFunctionIdRef.current = functionData.id;
		}
	}, [functionData, isOpen]);

	const isHtmlFunction =
		!!functionData?.startup_file &&
		functionData.startup_file.trim().toLowerCase().endsWith(".html");

	const corsOriginsArray = corsOrigins.split(",").map((o) => o.trim()).filter((o) => o.length > 0);
	const namespaceSelectValue = namespaces.length > 0 ? (selectedNamespaceId ?? "") : "";
	const hasSourceFlags = sourceFlags.imported || sourceFlags.ai_kicked_off;

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
		if (!functionData) { setError("No function data available"); return; }
		if (!name.trim()) { setError("Please enter a function name"); return; }

		const executionAliasValid = /^[a-zA-Z0-9-_]+$/.test(executionAlias);
		if (executionAlias && (!executionAliasValid || executionAlias.length < 8 || executionAlias.length > 128)) {
			setError("Execution alias must be 8-128 characters and can only contain alphanumeric characters, hyphens, and underscores.");
			return;
		}

		setError(""); setIsLoading(true);

		try {
			const namespacePayload =
				selectedNamespaceId != null && selectedNamespaceId !== functionData.namespaceId
					? selectedNamespaceId
					: undefined;

			const response = await updateFunction(functionData.id, {
				name: name.trim() || undefined,
				description: description.trim() || undefined,
				image,
				startup_file: startupFile?.trim() || undefined,
				docker_mount: dockerMount,
				network_restricted: networkRestricted,
				ffmpeg_install: ffmpegInstall,
				opencv_install: opencv_install,
				executionAlias: executionAlias.trim() === "" ? undefined : executionAlias,
				settings: {
					max_ram: maxRam,
					timeout,
					allow_http: allowHttp,
					secure_header: secureHeader?.length === 0 ? null : secureHeader,
					cache_enabled: cacheEnabled,
					cache_ttl: cacheTtl,
				},
				cors_origins: corsOrigins,
				...(namespacePayload !== undefined && { namespaceId: namespacePayload }),
			});

			if (response.status === "OK") { onSuccess(); onClose(); }
			else setError("Error updating function: " + response.message);
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const handleReinstallFfmpeg = async () => {
		if (!functionData) return;
		setIsReinstallingFfmpeg(true);
		try {
			const res = await reinstallFfmpeg(functionData.id);
			if (typeof res === "string") setError(res);
		} catch {
			setError("Failed to trigger FFmpeg reinstall");
		} finally {
			setIsReinstallingFfmpeg(false);
		}
	};

	const handleReinstallOpencv = async () => {
		if (!functionData) return;
		setIsReinstallingOpencv(true);
		try {
			const res = await reinstallOpencv(functionData.id);
			if (typeof res === "string") setError(res);
		} catch {
			setError("Failed to trigger OpenCV reinstall");
		} finally {
			setIsReinstallingOpencv(false);
		}
	};

	const handleClose = () => {
		if (!isLoading) { onClose(); setError(""); }
	};

	const handleDockerMountChange = async (checked: boolean) => {
		if (!checked) { setDockerMount(false); return; }
		if (dockerMount) return;
		const confirmed = await confirm({
			title: "Enable Docker Mount?",
			message: "Mounting the Docker socket gives this function elevated access to the host. Only enable this if you trust the function code and explicitly need Docker control from inside the container.",
			confirmText: "Enable Docker Mount",
			cancelText: "Cancel",
		});
		if (confirmed) setDockerMount(true);
	};

	const handleClearSourceFlags = async () => {
		if (!functionData || !hasSourceFlags) return;
		const confirmed = await confirm({
			title: "Clear Source Flags?",
			message: "This will remove the Imported and AI Kicked-Off labels from this function. It will not change the code, files, or runtime settings.",
			confirmText: "Clear Flags",
			cancelText: "Cancel",
			variant: "delete",
		});
		if (!confirmed) return;

		setIsClearingSourceFlags(true); setError("");
		try {
			const response = await updateFunction(functionData.id, { imported: false, ai_kicked_off: false });
			if (response.status === "OK") {
				setSourceFlags({ imported: false, ai_kicked_off: false });
				onSuccess();
			} else {
				setError("Error clearing source flags: " + response.message);
			}
		} catch {
			setError("An unexpected error occurred while clearing source flags");
		} finally {
			setIsClearingSourceFlags(false);
		}
	};

	const [loggedUrls, setLoggedUrls] = useState<string[]>([]);
	useEffect(() => {
		if (!lastLogs || lastLogs.length === 0) { setLoggedUrls([]); return; }
		const currentCorsOriginsArray = corsOrigins.split(",").map((o) => o.trim()).filter((o) => o.length > 0);
		const urls = lastLogs
			.flatMap((log) => {
				try {
					const payload = JSON.parse(JSON.parse(log.result!).payload);
					return payload?.headers?.host ? [payload.headers.host] : [];
				} catch { return []; }
			})
			.filter((url, index, self) => self.indexOf(url) === index)
			.filter((url) => !currentCorsOriginsArray.includes(`https://${url}`) && !currentCorsOriginsArray.includes(`http://${url}`))
			.slice(0, 5);
		setLoggedUrls(urls);
	}, [lastLogs, corsOrigins]);

	useShiftEnterSubmit(() => handleSubmit(), isOpen && !isLoading);

	const reinstallBtnClass = "text-xs px-3 py-1.5 border border-white/[0.07] text-muted hover:text-text hover:bg-white/[0.04] rounded-lg transition-colors disabled:opacity-50";

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Update Function" maxWidth="lg" isLoading={isLoading}>
			<div className="space-y-6">
				<ModalError message={error} />

				{hasSourceFlags && (
					<div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
						<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
							<div className="space-y-2">
								<h3 className="text-cyan-200 text-sm font-semibold">Source flags enabled</h3>
								<p className="text-cyan-100/80 text-xs leading-relaxed">
									This function is marked as imported or AI generated. You can clear those labels without changing the function itself.
								</p>
								<div className="flex flex-wrap gap-2">
									{sourceFlags.imported && (
										<span className="rounded-full border border-blue-400/40 bg-blue-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-100">
											Imported
										</span>
									)}
									{sourceFlags.ai_kicked_off && (
										<span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100">
											AI Kicked-Off
										</span>
									)}
								</div>
							</div>
							<button
								type="button"
								onClick={() => { void handleClearSourceFlags(); }}
								disabled={isLoading || isClearingSourceFlags}
								className="shrink-0 rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25 hover:border-cyan-300/50 transition-colors disabled:opacity-50"
							>
								{isClearingSourceFlags ? "Clearing..." : "Clear Flags"}
							</button>
						</div>
					</div>
				)}

				<div className="bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded-r-lg flex items-start gap-4">
					<div>
						<h3 className="text-yellow-300 text-sm font-semibold mb-1">Data Deletion Warning</h3>
						<p className="text-yellow-200/80 text-xs leading-relaxed">
							<strong>Updating this function may cause temporary downtime and could{" "}
							<span className="underline decoration-yellow-400">delete all files in</span>{" "}
							<InlineCode color="yellow">/app</InlineCode>.</strong>
							<br />
							Back up any important data before updating fields that trigger a redeploy like{" "}
							{["Image", "Docker Mount", "Network Restriction", "FFMPEG Install", "OpenCV Install"].map(
								(field, index) => (
									<React.Fragment key={field}>
										<InlineCode color="yellow">{field}</InlineCode>
										{index < 4 && ", "}
									</React.Fragment>
								),
							)}.
						</p>
					</div>
				</div>

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
						<label className={labelClass}>Namespace</label>
						<select
							value={namespaceSelectValue}
							onChange={(e) => setSelectedNamespaceId(e.target.value ? Number(e.target.value) : undefined)}
							className={selectClass}
							disabled={isLoading || namespaces.length === 0}
						>
							{namespaces.length === 0 && <option value="">Loading namespaces...</option>}
							{namespaces.map((ns) => (
								<option key={ns.id} value={ns.id}>{ns.name}</option>
							))}
						</select>
					</div>
					<div>
						<label className={labelClass}>Execution Alias</label>
						<input
							type="text"
							placeholder="Optional: alias for execution (e.g. big-test-1)"
							pattern="^[a-zA-Z0-9-_]+$"
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
						{isDeprecated && functionData && (
							<div className="bg-red-500/10 border-l-4 border-red-500 p-3 rounded-r-lg mb-3 flex items-start gap-3">
								<div>
									<h3 className="text-sm font-bold text-red-400 mb-1">Deprecated Runtime Image</h3>
									<p className="text-xs text-red-300/80 leading-relaxed">
										The current image <InlineCode color="red">{functionData.image}</InlineCode> is no longer maintained. Please switch to a newer version.
									</p>
								</div>
							</div>
						)}
						<select
							value={image}
							onChange={(e) => setImage(e.target.value as Image)}
							className={selectClass}
							disabled={isLoading || isHtmlFunction}
						>
							{ImagesAsArray.map((img) => {
								const isCrossFamily = getImageFamily(img) !== getImageFamily(image);
								const isDeprecatedImg = deprecatedImages.includes(img);
								return (
									<option key={img} value={img} disabled={isCrossFamily || isDeprecatedImg}>
										{getImageDisplayName(img)}
										{isCrossFamily ? " (changing language/runtime is not allowed)" : ""}
										{isDeprecatedImg ? " (deprecated)" : ""}
									</option>
								);
							})}
						</select>
						{isHtmlFunction && (
							<p className="text-xs text-yellow-400 mt-1">Disabled for HTML startup files</p>
						)}
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

				<ModalSection title="Security & Advanced">
					<ToggleRow
						id="allow-http-update"
						checked={allowHttp}
						onChange={setAllowHttp}
						disabled={isLoading}
						label="Allow HTTP"
						description="Enable inbound HTTP/HTTPS requests"
					/>

					<div className={isHtmlFunction ? "opacity-50 pointer-events-none" : ""}>
						<ToggleRow
							id="docker-mount-update"
							checked={dockerMount}
							onChange={(checked) => { void handleDockerMountChange(checked); }}
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
							id="network-restricted-update"
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
							id="ffmpeg-install-update"
							checked={ffmpegInstall}
							onChange={setFfmpegInstall}
							disabled={isLoading || isHtmlFunction}
							label="Install FFmpeg"
							description="Installs ffmpeg for media processing"
						/>
						{ffmpegInstall && (
							<div className="mt-2 flex justify-end">
								<button type="button" onClick={handleReinstallFfmpeg} disabled={isReinstallingFfmpeg || isLoading} className={reinstallBtnClass}>
									{isReinstallingFfmpeg ? "Reinstalling..." : "Trigger Reinstall"}
								</button>
							</div>
						)}
						{isHtmlFunction && (
							<p className="text-xs text-muted mt-1">FFmpeg install is disabled for HTML startup files</p>
						)}
					</div>

					<div className={isHtmlFunction ? "opacity-50 pointer-events-none" : ""}>
						<ToggleRow
							id="opencv-install-update"
							checked={opencv_install}
							onChange={setOpencvInstall}
							disabled={isLoading || isHtmlFunction}
							label="Install OpenCV"
							description="Installs python3-opencv for computer vision"
						/>
						{opencv_install && (
							<div className="mt-2 flex justify-end">
								<button type="button" onClick={handleReinstallOpencv} disabled={isReinstallingOpencv || isLoading} className={reinstallBtnClass}>
									{isReinstallingOpencv ? "Reinstalling..." : "Trigger Reinstall"}
								</button>
							</div>
						)}
						{isHtmlFunction && (
							<p className="text-xs text-muted mt-1">OpenCV install is disabled for HTML startup files</p>
						)}
					</div>

					<div>
						<ToggleRow
							id="cache-enabled-update"
							checked={cacheEnabled}
							onChange={setCacheEnabled}
							disabled={isLoading}
							label="Response Caching"
							description="Cache function responses to improve performance"
						/>
						{cacheEnabled && (
							<div className="mt-3 bg-background/40 border border-white/[0.07] rounded-lg p-3">
								<label className={labelClass}>Cache TTL (seconds)</label>
								<input
									type="number"
									min="1"
									max="86400"
									value={cacheTtl}
									onChange={(e) => setCacheTtl(parseInt(e.target.value) || 60)}
									className={inputClass}
									placeholder="60"
									disabled={isLoading}
								/>
								<p className="text-xs text-muted mt-1">How long to store the result (1 to 86400 seconds)</p>
							</div>
						)}
					</div>

					<div>
						<label className={labelClass}>Secure Header</label>
						<input
							type="text"
							placeholder="Optional secure header for authentication"
							value={secureHeader || ""}
							onChange={(e) => setSecureHeader(e.target.value)}
							className={inputClass}
							disabled={isLoading}
						/>
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

						{loggedUrls.length > 0 && (
							<div className="mt-3 space-y-2">
								<p className="text-xs text-muted">Possible origins from recent logs:</p>
								<div className="flex flex-wrap gap-2">
									{loggedUrls.map((url) => (
										<div key={url} className="bg-background/40 border border-white/[0.07] rounded-lg px-3 py-2 flex items-center gap-2">
											<span className="text-xs text-muted/80 break-all font-mono">{url}</span>
											{["https://", "http://"].map((protocol) => {
												const origin = `${protocol}${url}`;
												const alreadyAdded = corsOriginsArray.includes(origin);
												return (
													<button
														key={protocol}
														type="button"
														className="text-xs px-2 py-0.5 border border-white/[0.07] text-muted hover:text-text hover:bg-white/[0.04] rounded transition-colors disabled:opacity-50"
														onClick={() => {
															if (!alreadyAdded) setCorsOrigins([...corsOriginsArray, origin].join(", "));
														}}
														disabled={isLoading || alreadyAdded}
													>
														{protocol.replace("://", "")}
													</button>
												);
											})}
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</ModalSection>

				<ModalFooter>
					<button onClick={handleClose} className={cancelBtnClass} disabled={isLoading}>
						Cancel
					</button>
					<button onClick={handleSubmit} className={primaryBtnClass} disabled={isLoading}>
						Update Function
					</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}

export default UpdateFunctionModal;
