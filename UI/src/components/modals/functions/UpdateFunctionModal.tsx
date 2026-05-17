import React, { useState, useEffect } from "react";
import Modal from "../Modal";
import { useConfirm } from "../ConfirmModal";
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
	isDotnetImage,
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
	lastLogs: TriggerLog[]; // Pass recent logs for context in the update modal
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
	const [isDeprecated, setIsDeprecated] = useState<boolean>(false);
	const [deprecatedImages, setDeprecatedImages] = useState<string[]>([]);
	const [namespaces, setNamespaces] = useState<Namespace[]>([]);
	const [selectedNamespaceId, setSelectedNamespaceId] = useState<number>();

	useEffect(() => {
		const checkDeprecation = async () => {
			if (functionData) {
				try {
					setIsDeprecated(await isFunctionImageDeprecated(functionData.id));
				} catch (err) {
					console.error("Failed to check image deprecation:", err);
				}
			}
		};
		checkDeprecation();
	}, [functionData]);

	useEffect(() => {
		const fetchDeprecatedImages = async () => {
			try {
				const deprecated = await getDeprecatedImages();
				setDeprecatedImages(deprecated);
			} catch (err) {
				console.error("Failed to fetch deprecated images:", err);
			}
		};
		fetchDeprecatedImages();
	}, []);

	useEffect(() => {
		if (!isOpen) return;

		const fetchNamespacesList = async () => {
			try {
				const data = await getNamespaces();
				if (data.status === "OK") {
					setNamespaces(data.data);
				} else {
					console.error("Failed to fetch namespaces:", data);
				}
			} catch (err) {
				console.error("Failed to fetch namespaces:", err);
			}
		};

		fetchNamespacesList();
	}, [isOpen]);

	// Initialize form with existing function data
	useEffect(() => {
		if (functionData && isOpen) {
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
		}
	}, [functionData, isOpen]);

	// Add computed variable to check if startup_file ends with .html
	const isHtmlFunction =
		!!functionData?.startup_file &&
		functionData.startup_file.trim().toLowerCase().endsWith(".html");

	// Helper: get array from comma-separated string
	const corsOriginsArray = corsOrigins
		.split(",")
		.map((o) => o.trim())
		.filter((o) => o.length > 0);

	const namespaceSelectValue =
		namespaces.length > 0 ? (selectedNamespaceId ?? "") : "";
	const isDotnetRuntime = isDotnetImage(image);

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
		if (!functionData) {
			setError("No function data available");
			setIsLoading(false);
			return;
		}

		if (!name.trim()) {
			setError("Please enter a function name");
			setIsLoading(false);
			return;
		}

		setError("");
		setIsLoading(true);

		try {
			// Ensure Regex and length
			const executionAliasValid = /^[a-zA-Z0-9-_]+$/.test(executionAlias);
			if (
				executionAlias &&
				(!executionAliasValid ||
					executionAlias.length < 8 ||
					executionAlias.length > 128)
			) {
				setError(
					"Execution alias must be 8-128 characters and can only contain alphanumeric characters, hyphens, and underscores.",
				);
				setIsLoading(false);
				return;
			}
			const namespacePayload =
				selectedNamespaceId != null &&
				selectedNamespaceId !== functionData.namespaceId
					? selectedNamespaceId
					: undefined;
			const response = await updateFunction(functionData.id, {
				name: name.trim() || undefined,
				description: description.trim() || undefined,
				image,
				startup_file: isDotnetRuntime ? "" : startupFile?.trim() || undefined,
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

			if (response.status === "OK") {
				onSuccess();
				onClose();
			} else {
				setError("Error updating function: " + response.message);
			}
		} catch (err) {
			setError("An unexpected error occurred");
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	};

	const handleReinstallFfmpeg = async () => {
		if (!functionData) return;
		setIsReinstallingFfmpeg(true);
		try {
			const res = await reinstallFfmpeg(functionData.id);
			if (typeof res === "string") {
				setError(res);
			}
		} catch (err) {
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
			if (typeof res === "string") {
				setError(res);
			}
		} catch (err) {
			setError("Failed to trigger OpenCV reinstall");
		} finally {
			setIsReinstallingOpencv(false);
		}
	};

	const handleClose = () => {
		if (!isLoading) {
			onClose();
			setError("");
		}
	};

	// extract urls from logs
	const [loggedUrls, setLoggedUrls] = useState<string[]>([]);
	useEffect(() => {
		if (!lastLogs || lastLogs.length === 0) {
			setLoggedUrls([]);
			return;
		}

		const urls = lastLogs
			.flatMap((log) => {
				try {
					const payload = JSON.parse(JSON.parse(log.result!).payload);
					if (payload) {
						const url = payload.headers?.host;
						if (url) {
							return url;
						} else {
							return [];
						}
					} else {
						return [];
					}
				} catch {
					return [];
				}
			})
			.filter((url, index, self) => self.indexOf(url) === index); // unique

		// Make sure we don't have the same urls in loggedUrls and corsOriginsArray
		const filteredUrls = urls
			.filter(
				(url) =>
					!corsOriginsArray.includes(`https://${url}`) &&
					!corsOriginsArray.includes(`http://${url}`),
			)
			.slice(0, 5); // limit to 5 URLs

		setLoggedUrls(filteredUrls);
	}, [lastLogs, corsOrigins]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleSubmit();
		}
	};

	const handleDockerMountChange = async (checked: boolean) => {
		if (!checked) {
			setDockerMount(false);
			return;
		}

		if (dockerMount) return;

		const confirmed = await confirm({
			title: "Enable Docker Mount?",
			message:
				"Mounting the Docker socket gives this function elevated access to the host. Only enable this if you trust the function code and explicitly need Docker control from inside the container.",
			confirmText: "Enable Docker Mount",
			cancelText: "Cancel",
		});

		if (confirmed) {
			setDockerMount(true);
		}
	};

	// console.log("Last logs passed to UpdateFunctionModal:", lastLogs); // Debug log
	// console.log("Logged URLs for CORS suggestions:", loggedUrls); // Debug log

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Update Function"
			maxWidth="lg"
			isLoading={isLoading}
		>
			<div className="space-y-6" onKeyDown={handleKeyDown}>
				{/* Error Message */}
				{error && (
					<div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
						<div className="flex items-center gap-3">
							<span className="text-red-400 text-lg">⚠️</span>
							<p className="text-red-300 text-sm font-medium">{error}</p>
						</div>
					</div>
				)}
				<div className="bg-yellow-900/30 border-l-4 border-yellow-500 p-4 rounded-lg flex items-start gap-4 mb-2">
					<span className="text-yellow-400 text-2xl mt-0.5">⚠️</span>
					<div>
						<h3 className="text-yellow-300 text-base font-semibold mb-1">
							Data Deletion Warning
						</h3>
						<p className="text-yellow-200 text-xs leading-relaxed">
							<strong>
								Updating this function may cause temporary downtime and could{" "}
								<span className="underline decoration-yellow-400">
									delete all files in
								</span>{" "}
								<InlineCode color="yellow">/app</InlineCode>.
							</strong>
							<br />
							Back up any important data before updating fields that trigger a redeploy
							like{" "}
							{[
								"Image",
								"Docker Mount",
								"Network Restriction",
								"FFMPEG Install",
								"OpenCV Install",
							].map(
								(field, index) => (
									<React.Fragment key={field}>
										<InlineCode color="yellow">{field}</InlineCode>
										{index < 4 && ", "}
									</React.Fragment>
								),
							)}
							.
						</p>
					</div>
				</div>

				{/* Basic Information */}
				<div className="space-y-4">
					<h3 className="text-sm font-semibold text-primary flex items-center gap-2">
						<span>✏️</span> Basic Information
					</h3>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<label className="text-sm font-medium text-gray-300">
								Function Name
							</label>
							<input
								type="text"
								placeholder="my-awesome-function"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
								disabled={isLoading}
							/>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium text-gray-300">Startup File</label>
							<input
								type="text"
								placeholder={
									isDotnetRuntime
										? ".NET functions auto-detect the runnable project"
										: "main.py, index.js, etc."
								}
								value={startupFile || ""}
								onChange={(e) => setStartupFile(e.target.value)}
								className={`w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 ${
									isLoading || isDotnetRuntime
										? "opacity-50 cursor-not-allowed"
										: ""
								}`}
								disabled={isLoading || isDotnetRuntime}
							/>
							{isDotnetRuntime && (
								<p className="text-xs text-cyan-300">
									.NET functions keep this empty and resolve the runnable
									project from your `.csproj` and `.sln` files.
								</p>
							)}
						</div>
					</div>

					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-300">Description</label>
						<textarea
							placeholder="Brief description of what this function does..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300 resize-none"
							rows={3}
							disabled={isLoading}
						/>
					</div>

					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-300">Namespace</label>
						<select
							value={namespaceSelectValue}
							onChange={(e) => {
								const val = e.target.value;
								setSelectedNamespaceId(val ? Number(val) : undefined);
							}}
							className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
							disabled={isLoading || namespaces.length === 0}
						>
							{namespaces.length === 0 && (
								<option value="">Loading namespaces...</option>
							)}
							{namespaces.length > 0 &&
								namespaces.map((ns) => (
									<option key={ns.id} value={ns.id}>
										{ns.name}
									</option>
								))}
						</select>
					</div>

					{/* Execution Alias input */}
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-300">
							Execution Alias
						</label>
						<input
							type="text"
							placeholder="Optional: alias for execution (e.g. big-test-1)"
							pattern="^[a-zA-Z0-9-_]+$"
							value={executionAlias}
							onChange={(e) => setExecutionAlias(e.target.value)}
							className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
							disabled={isLoading}
						/>
					</div>
				</div>

				{/* Runtime Configuration */}
				<div className="space-y-4">
					<h3 className="text-sm font-semibold text-primary flex items-center gap-2">
						<span>⚙️</span> Runtime Configuration
					</h3>
					<div className={isHtmlFunction ? "opacity-50 pointer-events-none" : ""}>
						<label className="text-sm font-medium text-gray-300">Runtime Image</label>
						{isDeprecated && functionData && (
							<div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-lg mb-4 flex items-start gap-3">
								<span className="text-red-400 text-xl mt-0.5">🚫</span>
								<div>
									<h3 className="text-sm font-bold text-red-400 mb-1">
										Deprecated Runtime Image
									</h3>
									<p className="text-xs text-red-300/80 leading-relaxed">
										The current image{" "}
										<InlineCode color="red">{functionData.image}</InlineCode> is no longer
										maintained. Please switch to a newer version to ensure security and
										performance.
									</p>
								</div>
							</div>
						)}
						<select
							value={image}
							onChange={(e) => setImage(e.target.value as Image)}
							className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
							disabled={isLoading || isHtmlFunction}
						>
							{ImagesAsArray.map((img) => {
								let isDisabled: { state?: boolean; message?: string } = {};
								if (getImageFamily(img) !== getImageFamily(image)) {
									isDisabled = {
										state: true,
										message: "Changing language/runtime is not allowed",
									};
								}
								if (deprecatedImages.includes(img)) {
									isDisabled = {
										state: true,
										message: "This image is deprecated and cannot be selected",
									};
								}

								return (
									<option key={img} value={img} disabled={isDisabled.state}>
										{getImageDisplayName(img)}{" "}
										{isDisabled.message && `(${isDisabled.message})`}
									</option>
								);
							})}
						</select>
						{isHtmlFunction && (
							<p className="text-xs text-yellow-400 mt-1">
								Disabled for HTML startup files
							</p>
						)}
					</div>
				</div>

				{/* Resource Settings */}
				<div className="space-y-4">
					<h3 className="text-sm font-semibold text-primary flex items-center gap-2">
						<span>📊</span> Resource Settings
					</h3>
					<div className={isHtmlFunction ? "opacity-50 pointer-events-none" : ""}>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div className="space-y-2">
								<label className="text-sm font-medium text-gray-300">
									Max RAM (MB)
								</label>
								<input
									type="number"
									placeholder="512"
									value={maxRam || ""}
									onChange={(e) => setMaxRam(Number(e.target.value))}
									className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
									disabled={isLoading || isHtmlFunction}
								/>
							</div>
							<div className="space-y-2">
								<label className="text-sm font-medium text-gray-300">
									Timeout (sec)
								</label>
								<input
									type="number"
									placeholder="30"
									value={timeout || ""}
									max={300}
									onChange={(e) => setTimeout(Number(e.target.value))}
									className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
									disabled={isLoading || isHtmlFunction}
								/>
							</div>
						</div>
						{isHtmlFunction && (
							<p className="text-xs text-yellow-400 mt-1">
								Resource settings are disabled for HTML startup files
							</p>
						)}
					</div>
				</div>

				{/* Security & Advanced Settings */}
				<div className="space-y-4">
					<h3 className="text-sm font-semibold text-primary flex items-center gap-2">
						<span>🔧</span> Security & Advanced
					</h3>
					<div className="space-y-4">
						{/* HTTP Toggle */}
						<div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<span className="text-lg">🌐</span>
									<div>
										<p className="text-white font-medium text-sm">Allow HTTP</p>
										<p className="text-gray-400 text-xs">
											Enable inbound HTTP/HTTPS requests
										</p>
									</div>
								</div>
								<div className="relative">
									<input
										type="checkbox"
										checked={allowHttp}
										onChange={(e) => setAllowHttp(e.target.checked)}
										className="sr-only peer"
										disabled={isLoading}
										id="allow-http-update"
									/>
									<label
										htmlFor="allow-http-update"
										className="w-12 h-6 bg-gray-600 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-purple-500 transition-all duration-300 cursor-pointer flex items-center relative"
									>
										<div
											className={`absolute w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
												allowHttp ? "translate-x-6" : "translate-x-0.5"
											}`}
										></div>
									</label>
								</div>
							</div>
						</div>

						{/* Docker Mount Toggle */}
						<div
							className={`bg-gray-800/30 border border-yellow-600/50 rounded-lg p-4 ${
								isHtmlFunction ? "opacity-50 pointer-events-none" : ""
							}`}
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<span className="text-lg">🐳</span>
									<div>
										<p className="text-yellow-300 font-medium text-sm">
											Mount Docker Socket
										</p>
										<p className="text-yellow-400 text-xs">
											Mounts /var/run/docker.sock (Security risk!)
										</p>
									</div>
								</div>
								<div className="relative">
									<input
										type="checkbox"
										checked={dockerMount}
										onChange={(e) => {
											void handleDockerMountChange(e.target.checked);
										}}
										className="sr-only peer"
										disabled={isLoading || isHtmlFunction}
										id="docker-mount-update"
									/>
									<label
										htmlFor="docker-mount-update"
										className="w-12 h-6 bg-gray-600 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-yellow-500 peer-checked:to-red-500 transition-all duration-300 cursor-pointer flex items-center relative"
									>
										<div
											className={`absolute w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
												dockerMount ? "translate-x-6" : "translate-x-0.5"
											}`}
										></div>
									</label>
								</div>
							</div>
							{isHtmlFunction && (
								<p className="text-xs text-yellow-400 mt-1">
									Docker mount is disabled for HTML startup files
								</p>
							)}
						</div>

						{/* FFmpeg Install Toggle */}
						<div
							className={`bg-gray-800/30 border border-purple-600/50 rounded-lg p-4 ${
								isHtmlFunction ? "opacity-50 pointer-events-none" : ""
							}`}
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<span className="text-lg">🎬</span>
									<div>
										<p className="text-purple-300 font-medium text-sm">Install FFmpeg</p>
										<p className="text-purple-400 text-xs">
											Installs ffmpeg for media processing
										</p>
									</div>
								</div>
								<div className="relative">
									<input
										type="checkbox"
										checked={ffmpegInstall}
										onChange={(e) => setFfmpegInstall(e.target.checked)}
										className="sr-only peer"
										disabled={isLoading || isHtmlFunction}
										id="ffmpeg-install-update"
									/>
									<label
										htmlFor="ffmpeg-install-update"
										className="w-12 h-6 bg-gray-600 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-pink-500 transition-all duration-300 cursor-pointer flex items-center relative"
									>
										<div
											className={`absolute w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
												ffmpegInstall ? "translate-x-6" : "translate-x-0.5"
											}`}
										></div>
									</label>
								</div>
							</div>
							{ffmpegInstall && (
								<div className="mt-3 pt-3 border-t border-purple-600/20 flex justify-end">
									<button
										type="button"
										onClick={handleReinstallFfmpeg}
										disabled={isReinstallingFfmpeg || isLoading}
										className="text-xs px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded border border-purple-600/30 transition-all duration-300 disabled:opacity-50"
									>
										{isReinstallingFfmpeg ? "🔄 Reinstalling..." : "🔄 Trigger Reinstall"}
									</button>
								</div>
							)}
							{isHtmlFunction && (
								<p className="text-xs text-purple-400 mt-1">
									FFmpeg install is disabled for HTML startup files
								</p>
							)}
						</div>

						{/* OpenCV Install Toggle */}
						<div
							className={`bg-gray-800/30 border border-teal-600/50 rounded-lg p-4 ${
								isHtmlFunction ? "opacity-50 pointer-events-none" : ""
							}`}
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<span className="text-lg">👁️</span>
									<div>
										<p className="text-teal-300 font-medium text-sm">Install OpenCV</p>
										<p className="text-teal-400 text-xs">
											Installs python3-opencv for computer vision
										</p>
									</div>
								</div>
								<div className="relative">
									<input
										type="checkbox"
										checked={opencv_install}
										onChange={(e) => setOpencvInstall(e.target.checked)}
										className="sr-only peer"
										disabled={isLoading || isHtmlFunction}
										id="opencv-install-update"
									/>
									<label
										htmlFor="opencv-install-update"
										className="w-12 h-6 bg-gray-600 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-teal-500 peer-checked:to-emerald-500 transition-all duration-300 cursor-pointer flex items-center relative"
									>
										<div
											className={`absolute w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
												opencv_install ? "translate-x-6" : "translate-x-0.5"
											}`}
										></div>
									</label>
								</div>
							</div>
							{opencv_install && (
								<div className="mt-3 pt-3 border-t border-teal-600/20 flex justify-end">
									<button
										type="button"
										onClick={handleReinstallOpencv}
										disabled={isReinstallingOpencv || isLoading}
										className="text-xs px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/40 text-teal-300 rounded border border-teal-600/30 transition-all duration-300 disabled:opacity-50"
									>
										{isReinstallingOpencv ? "🔄 Reinstalling..." : "🔄 Trigger Reinstall"}
									</button>
								</div>
							)}
							{isHtmlFunction && (
								<p className="text-xs text-teal-400 mt-1">
									OpenCV install is disabled for HTML startup files
								</p>
							)}
						</div>

						{/* Caching Toggle & TTL */}
						<div className="bg-gray-800/30 border border-blue-600/50 rounded-lg p-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<span className="text-lg">⚡</span>
									<div>
										<p className="text-blue-300 font-medium text-sm">Response Caching</p>
										<p className="text-blue-400 text-xs">
											Cache function responses to improve performance
										</p>
									</div>
								</div>
								<div className="relative">
									<input
										type="checkbox"
										checked={cacheEnabled}
										onChange={(e) => setCacheEnabled(e.target.checked)}
										className="sr-only peer"
										id="cache-enabled-update"
									/>
									<label
										htmlFor="cache-enabled-update"
										className="w-12 h-6 bg-gray-600 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-cyan-500 transition-all duration-300 cursor-pointer flex items-center relative"
									>
										<div
											className={`absolute w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
												cacheEnabled ? "translate-x-6" : "translate-x-0.5"
											}`}
										></div>
									</label>
								</div>
							</div>

							{cacheEnabled && (
								<div className="mt-4 pt-4 border-t border-gray-700/50 flex flex-col gap-2">
									<label className="text-xs font-medium text-gray-400">
										Cache TTL (seconds)
									</label>
									<input
										type="number"
										min="1"
										max="86400"
										value={cacheTtl}
										onChange={(e) => setCacheTtl(parseInt(e.target.value) || 60)}
										className="w-full p-2 bg-gray-900/50 border border-gray-600/50 text-white rounded focus:border-blue-500/50 focus:outline-none text-sm"
										placeholder="60"
										disabled={isLoading}
									/>
									<p className="text-[10px] text-gray-500">
										How long to store the result (1 to 86400 seconds)
									</p>
								</div>
							)}
						</div>

						{/* Secure Header */}
						<div className="space-y-2">
							<label className="text-sm font-medium text-gray-300">
								Secure Header
							</label>
							<input
								type="text"
								placeholder="Optional secure header for authentication"
								value={secureHeader || ""}
								onChange={(e) => setSecureHeader(e.target.value)}
								className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
								disabled={isLoading}
							/>
						</div>

						{/* CORS Origins */}
						<div className="space-y-2">
							<label className="text-sm font-medium text-gray-300">CORS Origins</label>
							<div className="flex flex-wrap gap-2 mb-2">
								{corsOriginsArray.map((origin) => (
									<span
										key={origin}
										className="flex items-center bg-gray-700 text-white px-3 py-1 rounded-full text-xs"
									>
										{origin}
										<button
											type="button"
											className="ml-2 text-red-400 hover:text-red-600"
											onClick={() => removeCorsOrigin(origin)}
											disabled={isLoading}
											aria-label={`Remove ${origin}`}
										>
											×
										</button>
									</span>
								))}
							</div>
							<div className="flex gap-2">
								<input
									type="text"
									placeholder="Add origin (e.g. https://example.com)"
									value={corsOriginInput}
									onChange={(e) => setCorsOriginInput(e.target.value)}
									className="flex-1 p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
									disabled={isLoading}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											addCorsOrigin();
										}
									}}
								/>
								<button
									type="button"
									onClick={addCorsOrigin}
									className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-300 disabled:opacity-50"
									disabled={isLoading || !corsOriginInput.trim()}
								>
									Add
								</button>
							</div>
							<p className="text-xs text-gray-400">
								Leave empty to allow only default origins. Each origin will be sent
								comma separated.
							</p>
							{loggedUrls.length > 0 && (
								<div className="mt-4">
									<p className="text-xs text-blue-300 mb-2">
										We found these URLs to be possible origins you might want to add:
									</p>
									<div className="flex flex-wrap gap-3">
										{loggedUrls.map((url) => (
											<div
												key={url}
												className="bg-gray-800 border border-blue-600/40 rounded-lg px-4 py-2 flex items-center gap-2 shadow-sm"
											>
												<span className="text-blue-400 text-xs break-all">{url}</span>
												{["https://", "http://"].map((protocol) => {
													const origin = `${protocol}${url}`;
													const alreadyAdded = corsOriginsArray.includes(origin);
													return (
														<button
															key={protocol}
															type="button"
															className={`ml-2 px-2 py-0.5 ${
																protocol === "https://"
																	? "bg-blue-600 hover:bg-blue-700"
																	: "bg-gray-600 hover:bg-gray-700"
															} text-white rounded text-xs font-medium transition`}
															onClick={() => {
																if (!alreadyAdded) {
																	setCorsOrigins([...corsOriginsArray, origin].join(", "));
																}
															}}
															disabled={isLoading || alreadyAdded}
														>
															Add {protocol.replace("://", "")}
														</button>
													);
												})}
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-700/50">
					<button
						onClick={handleClose}
						className="px-6 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg font-medium transition-all duration-300 border border-gray-600/50 hover:border-gray-500"
						disabled={isLoading}
					>
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
						disabled={isLoading}
					>
						<span className="text-sm">💾</span>
						Update Function
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default UpdateFunctionModal;
