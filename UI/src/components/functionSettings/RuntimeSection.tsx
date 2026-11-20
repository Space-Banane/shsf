import { useEffect, useState } from "react";
import {
	getDeprecatedImages,
	isFunctionImageDeprecated,
	reinstallFfmpeg,
	reinstallOpencv,
} from "../../services/backend.functions";
import {
	getImageDisplayName,
	getImageFamily,
	ImagesAsArray,
	Image,
} from "../../types/Prisma";
import { useConfirm } from "../modals/ConfirmModal";
import { inputClass, selectClass, ToggleRow } from "../modals/Modal";
import { InlineCode } from "../InlineCode";
import { LoadError } from "../ui/LoadError";
import { SettingsField, SettingsSection } from "./FormPrimitives";
import type { FunctionSettingsDraft } from "./functionSettings";

const reinstallBtnClass =
	"text-xs px-3 py-1.5 border border-white/[0.07] text-muted hover:text-text hover:bg-white/[0.04] rounded-lg transition-colors disabled:opacity-50";

interface RuntimeSectionProps {
	functionId: number;
	currentImage: string;
	draft: FunctionSettingsDraft;
	onChange: (patch: Partial<FunctionSettingsDraft>) => void;
	disabled: boolean;
	isOwner: boolean;
	htmlOnly: boolean;
}

export function RuntimeSection({
	functionId,
	currentImage,
	draft,
	onChange,
	disabled,
	isOwner,
	htmlOnly,
}: RuntimeSectionProps) {
	const confirm = useConfirm();
	const [isDeprecated, setIsDeprecated] = useState(false);
	const [deprecatedImages, setDeprecatedImages] = useState<string[]>([]);
	const [metadataError, setMetadataError] = useState<string | null>(null);
	const [metadataReloadKey, setMetadataReloadKey] = useState(0);
	const [isReinstallingFfmpeg, setIsReinstallingFfmpeg] = useState(false);
	const [isReinstallingOpencv, setIsReinstallingOpencv] = useState(false);
	const [actionError, setActionError] = useState("");

	useEffect(() => {
		let active = true;
		setMetadataError(null);
		isFunctionImageDeprecated(functionId)
			.then((deprecated) => {
				if (active) setIsDeprecated(deprecated);
			})
			.catch(() => {
				if (active) setMetadataError("Could not load image metadata.");
			});
		getDeprecatedImages()
			.then((images) => {
				if (active) setDeprecatedImages(images);
			})
			.catch(() => {
				if (active) setMetadataError("Could not load image metadata.");
			});
		return () => {
			active = false;
		};
	}, [functionId, currentImage, metadataReloadKey]);

	const handleDockerMountChange = async (checked: boolean) => {
		if (!checked) {
			onChange({ dockerMount: false });
			return;
		}
		if (draft.dockerMount) return;
		const confirmed = await confirm({
			title: "Enable Docker Mount?",
			message:
				"Mounting the Docker socket gives this function elevated access to the host. Only enable this if you trust the function code and explicitly need Docker control from inside the container.",
			confirmText: "Enable Docker Mount",
			cancelText: "Cancel",
		});
		if (confirmed) onChange({ dockerMount: true });
	};

	const handleReinstallFfmpeg = async () => {
		setIsReinstallingFfmpeg(true);
		setActionError("");
		try {
			const res = await reinstallFfmpeg(functionId);
			if (typeof res === "string") setActionError(res);
		} catch {
			setActionError("Failed to trigger FFmpeg reinstall");
		} finally {
			setIsReinstallingFfmpeg(false);
		}
	};

	const handleReinstallOpencv = async () => {
		setIsReinstallingOpencv(true);
		setActionError("");
		try {
			const res = await reinstallOpencv(functionId);
			if (typeof res === "string") setActionError(res);
		} catch {
			setActionError("Failed to trigger OpenCV reinstall");
		} finally {
			setIsReinstallingOpencv(false);
		}
	};

	return (
		<SettingsSection
			title="Runtime"
			description="Image, resources, and the packages installed into the container."
		>
			{metadataError && (
				<LoadError
					message={metadataError}
					onRetry={() => setMetadataReloadKey((key) => key + 1)}
				/>
			)}
			{actionError && (
				<div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
					{actionError}
				</div>
			)}

			<div className={htmlOnly ? "opacity-50 pointer-events-none" : ""}>
				<SettingsField label="Runtime Image">
					{isDeprecated && (
						<div className="bg-red-500/10 border-l-4 border-red-500 p-3 rounded-r-lg mb-3 flex items-start gap-3">
							<div>
								<h3 className="text-sm font-bold text-red-400 mb-1">
									Deprecated Runtime Image
								</h3>
								<p className="text-xs text-red-300/80 leading-relaxed">
									The current image{" "}
									<InlineCode color="red">{currentImage}</InlineCode> is no
									longer maintained. Please switch to a newer version.
								</p>
							</div>
						</div>
					)}
					<select
						value={draft.image}
						onChange={(e) => onChange({ image: e.target.value as Image })}
						className={selectClass}
						disabled={disabled || htmlOnly}
					>
						{ImagesAsArray.map((image) => {
							const isCrossFamily =
								getImageFamily(image) !== getImageFamily(draft.image);
							const isDeprecatedImage = deprecatedImages.includes(image);
							return (
								<option
									key={image}
									value={image}
									disabled={isCrossFamily || isDeprecatedImage}
								>
									{getImageDisplayName(image)}
									{isCrossFamily
										? " (changing language/runtime is not allowed)"
										: ""}
									{isDeprecatedImage ? " (deprecated)" : ""}
								</option>
							);
						})}
					</select>
					{htmlOnly && (
						<p className="text-xs text-yellow-400 mt-1">
							Disabled for HTML startup files
						</p>
					)}
				</SettingsField>
			</div>

			<div className={htmlOnly ? "opacity-50 pointer-events-none" : ""}>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<SettingsField label="Max RAM (MB)">
						<input
							type="number"
							placeholder="512"
							value={draft.maxRam || ""}
							onChange={(e) => onChange({ maxRam: Number(e.target.value) })}
							className={inputClass}
							disabled={disabled || htmlOnly}
						/>
					</SettingsField>
					<SettingsField label="Timeout (sec)">
						<input
							type="number"
							placeholder="30"
							value={draft.timeout || ""}
							max={300}
							onChange={(e) => onChange({ timeout: Number(e.target.value) })}
							className={inputClass}
							disabled={disabled || htmlOnly}
						/>
					</SettingsField>
				</div>
				{htmlOnly && (
					<p className="text-xs text-yellow-400 mt-1">
						Resource settings are disabled for HTML startup files
					</p>
				)}
			</div>

			<div className={htmlOnly ? "opacity-50 pointer-events-none" : ""}>
				<ToggleRow
					id="docker-mount-update"
					checked={draft.dockerMount}
					onChange={(checked) => {
						void handleDockerMountChange(checked);
					}}
					disabled={disabled || !isOwner || htmlOnly}
					label="Mount Docker Socket"
					description="Mounts /var/run/docker.sock (Security risk!)"
				/>
				{htmlOnly && (
					<p className="text-xs text-muted mt-1">
						Docker mount is disabled for HTML startup files
					</p>
				)}
			</div>

			<div className={htmlOnly ? "opacity-50 pointer-events-none" : ""}>
				<ToggleRow
					id="ffmpeg-install-update"
					checked={draft.ffmpegInstall}
					onChange={(checked) => onChange({ ffmpegInstall: checked })}
					disabled={disabled || htmlOnly}
					label="Install FFmpeg"
					description="Installs ffmpeg for media processing"
				/>
				{draft.ffmpegInstall && (
					<div className="mt-2 flex justify-end">
						<button
							type="button"
							onClick={() => {
								void handleReinstallFfmpeg();
							}}
							disabled={isReinstallingFfmpeg || disabled}
							className={reinstallBtnClass}
						>
							{isReinstallingFfmpeg ? "Reinstalling..." : "Trigger Reinstall"}
						</button>
					</div>
				)}
				{htmlOnly && (
					<p className="text-xs text-muted mt-1">
						FFmpeg install is disabled for HTML startup files
					</p>
				)}
			</div>

			<div className={htmlOnly ? "opacity-50 pointer-events-none" : ""}>
				<ToggleRow
					id="opencv-install-update"
					checked={draft.opencvInstall}
					onChange={(checked) => onChange({ opencvInstall: checked })}
					disabled={disabled || htmlOnly}
					label="Install OpenCV"
					description="Installs python3-opencv for computer vision"
				/>
				{draft.opencvInstall && (
					<div className="mt-2 flex justify-end">
						<button
							type="button"
							onClick={() => {
								void handleReinstallOpencv();
							}}
							disabled={isReinstallingOpencv || disabled}
							className={reinstallBtnClass}
						>
							{isReinstallingOpencv ? "Reinstalling..." : "Trigger Reinstall"}
						</button>
					</div>
				)}
				{htmlOnly && (
					<p className="text-xs text-muted mt-1">
						OpenCV install is disabled for HTML startup files
					</p>
				)}
			</div>
		</SettingsSection>
	);
}
