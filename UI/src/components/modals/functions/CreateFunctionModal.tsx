import React, { useState, useEffect } from "react";
import Modal from "../Modal";
import {
	createFunction,
	getDeprecatedImages,
} from "../../../services/backend.functions";
import {
	getImageDisplayName,
	Image,
	ImagesAsArray,
	isDotnetImage,
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
	const [image, setImage] = useState<Image>("python:3.11"); // Default to Python 3.11 (3.9 is deprecated)
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
	const isDotnetRuntime = isDotnetImage(image);

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

	const resetForm = () => {
		setName("");
		setDescription("");
		setNamespaceId(null);
		setMaxRam(undefined);
		setTimeout(undefined);
		setAllowHttp(false);
		setStartupFile(undefined);
		setExecutionAlias("");
		setDockerMount(false);
		setNetworkRestricted(false);
		setFfmpegInstall(false);
		setOpencvInstall(false);
		setCorsOrigins("");
		setError("");
	};

	const handleSubmit = async () => {
		if (!namespaceId) {
			setError("Please select a namespace");
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

			const response = await createFunction({
				name,
				description,
				image,
				namespaceId,
				startup_file: isDotnetRuntime ? "" : startupFile,
				docker_mount: dockerMount,
				network_restricted: networkRestricted,
				ffmpeg_install: ffmpegInstall,
				opencv_install: opencvInstall,
				executionAlias: executionAlias.trim() === "" ? undefined : executionAlias,
				settings: {
					max_ram: maxRam,
					timeout,
					allow_http: allowHttp,
				},
				cors_origins: corsOrigins,
			});

			if (response.status === "OK") {
				const createdFunctionId = response.data.id;
				onSuccess();
				resetForm();
				onClose();
				navigate(`/functions/${createdFunctionId}`);
			} else {
				setError("Error creating function: " + response.message);
			}
		} catch (err) {
			setError("An unexpected error occurred");
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		if (!isLoading) {
			onClose();
			setError("");
		}
	};

	// Add computed variable to check if startupFile ends with .html
	const isHtmlFunction =
		!!startupFile && startupFile.trim().toLowerCase().endsWith(".html");

	// Helper: get array from comma-separated string
	const corsOriginsArray = corsOrigins
		.split(",")
		.map((o) => o.trim())
		.filter((o) => o.length > 0);

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

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleSubmit();
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Create Function"
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

				{/* Basic Information */}
				<div className="space-y-4">
					<h3 className="text-sm font-semibold text-primary flex items-center gap-2">
						<span>🚀</span> Basic Information
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
							<label className="text-sm font-medium text-gray-300">Namespace</label>
							<select
								value={namespaceId || ""}
								onChange={(e) => setNamespaceId(Number(e.target.value))}
								className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
								disabled={isLoading}
							>
								<option value="" disabled>
									Select Namespace
								</option>
								{namespaces.map((ns) => (
									<option key={ns.id} value={ns.id}>
										{ns.name}
									</option>
								))}
							</select>
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

					{/* Execution Alias input */}
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-300">
							Execution Alias
						</label>
						<input
							type="text"
							placeholder="Optional: alias for execution (e.g. very-important-function)"
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
						<div className="space-y-2">
							<label className="text-sm font-medium text-gray-300">
								Runtime Image
							</label>
							<select
								value={image}
								onChange={(e) => setImage(e.target.value as Image)}
								className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
								disabled={isLoading || isHtmlFunction}
							>
								{ImagesAsArray.map((img) => {
									let isDisabled: { state?: boolean; message?: string } = {};
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
								.NET functions resolve the runnable project from your
								`.csproj` and `.sln` files. This field stays empty on purpose.
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

				{/* Advanced Settings */}
				<div className="space-y-4">
					<h3 className="text-sm font-semibold text-primary flex items-center gap-2">
						<span>🔧</span> Advanced Settings
					</h3>

					{/* Guest User Section */}
					<div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4">
						<h4 className="text-sm font-semibold text-gray-200 mb-1 flex items-center gap-2">
							<span>👥</span> Guest Users
						</h4>
						<p className="text-xs text-gray-400">
							You can't add guest users yet. Please create the function first, then
							edit it to assign guests.
						</p>
					</div>

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
									id="allow-http-create"
								/>
								<label
									htmlFor="allow-http-create"
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

					<div
						className={`bg-gray-800/30 border border-cyan-600/50 rounded-lg p-4 ${
							isHtmlFunction ? "opacity-50 pointer-events-none" : ""
						}`}
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<span className="text-lg">🔒</span>
								<div>
									<p className="text-cyan-300 font-medium text-sm">
										Restrict Network
									</p>
									<p className="text-cyan-400 text-xs">
										Run the container with Docker network disabled
									</p>
								</div>
							</div>
							<div className="relative">
								<input
									type="checkbox"
									checked={networkRestricted}
									onChange={(e) => setNetworkRestricted(e.target.checked)}
									className="sr-only peer"
									disabled={isLoading || isHtmlFunction}
									id="network-restricted-create"
								/>
								<label
									htmlFor="network-restricted-create"
									className="w-12 h-6 bg-gray-600 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-cyan-500 peer-checked:to-blue-500 transition-all duration-300 cursor-pointer flex items-center relative"
								>
									<div
										className={`absolute w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
											networkRestricted ? "translate-x-6" : "translate-x-0.5"
										}`}
									></div>
								</label>
							</div>
						</div>
						{isHtmlFunction && (
							<p className="text-xs text-cyan-400 mt-1">
								Network restrictions are disabled for HTML startup files
							</p>
						)}
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
									onChange={(e) => setDockerMount(e.target.checked)}
									className="sr-only peer"
									disabled={isLoading || isHtmlFunction}
									id="docker-mount-create"
								/>
								<label
									htmlFor="docker-mount-create"
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
									id="ffmpeg-install-create"
								/>
								<label
									htmlFor="ffmpeg-install-create"
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
									checked={opencvInstall}
									onChange={(e) => setOpencvInstall(e.target.checked)}
									className="sr-only peer"
									disabled={isLoading || isHtmlFunction}
									id="opencv-install-create"
								/>
								<label
									htmlFor="opencv-install-create"
									className="w-12 h-6 bg-gray-600 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-teal-500 peer-checked:to-emerald-500 transition-all duration-300 cursor-pointer flex items-center relative"
								>
									<div
										className={`absolute w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
											opencvInstall ? "translate-x-6" : "translate-x-0.5"
										}`}
									></div>
								</label>
							</div>
						</div>
						{isHtmlFunction && (
							<p className="text-xs text-teal-400 mt-1">
								OpenCV install is disabled for HTML startup files
							</p>
						)}
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
							Leave empty to allow only default origins. Each origin will be sent comma
							separated.
						</p>
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
						<span className="text-sm">🚀</span>
						Create Function
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default CreateFunctionModal;
