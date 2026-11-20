import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { can } from "../../services/backend.sharing";
import { getFunctionById, updateFunction } from "../../services/backend.functions";
import { usePageTitle } from "../../hooks/usePageTitle";
import { primaryBtnClass } from "../../components/modals/Modal";
import { AccessSection } from "../../components/functionSettings/AccessSection";
import { CachingSection } from "../../components/functionSettings/CachingSection";
import { GeneralSection } from "../../components/functionSettings/GeneralSection";
import { NetworkSection } from "../../components/functionSettings/NetworkSection";
import { RateLimitsSection } from "../../components/functionSettings/RateLimitsSection";
import { RuntimeSection } from "../../components/functionSettings/RuntimeSection";
import {
	FUNCTION_SETTINGS_SECTIONS,
	draftFromFunction,
	draftsEqual,
	parseFunctionSettingsSection,
	type FunctionSettingsDraft,
	type FunctionSettingsSectionId,
} from "../../components/functionSettings/functionSettings";
import type { XFunction } from "../../types/Prisma";

const HTML_ONLY_REASON = "This function is set to only serve an .html file";

/**
 * Routed settings for one function. The URL owns the active section, while the
 * draft lives above the sections so switching sections keeps unsaved edits.
 */
function FunctionSettings() {
	const { id } = useParams<{ id: string }>();
	const functionId = id ? parseInt(id) : null;
	const [searchParams, setSearchParams] = useSearchParams();
	const section = parseFunctionSettingsSection(searchParams.get("section"));

	const [functionData, setFunctionData] = useState<XFunction | null>(null);
	const [draft, setDraft] = useState<FunctionSettingsDraft | null>(null);
	const [savedDraft, setSavedDraft] = useState<FunctionSettingsDraft | null>(
		null,
	);
	const [loading, setLoading] = useState(true);
	const [loadFailed, setLoadFailed] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	// Sections stay mounted after their first visit so unsaved form state
	// survives switching between them, while unvisited sections load nothing.
	const visitedSections = useRef(new Set<FunctionSettingsSectionId>());
	visitedSections.current.add(section);

	usePageTitle(functionData ? `${functionData.name} settings` : null);

	useEffect(() => {
		if (functionId === null) {
			setLoading(false);
			setLoadFailed(true);
			return;
		}

		let active = true;
		setLoading(true);
		setLoadFailed(false);
		getFunctionById(functionId)
			.then((result) => {
				if (!active) return;
				if (result.status === "OK") {
					const nextDraft = draftFromFunction(result.data);
					setFunctionData(result.data);
					setDraft(nextDraft);
					setSavedDraft(nextDraft);
				} else {
					setLoadFailed(true);
				}
			})
			.catch(() => {
				if (active) setLoadFailed(true);
			})
			.finally(() => {
				if (active) setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [functionId]);

	const updateDraft = useCallback((patch: Partial<FunctionSettingsDraft>) => {
		setDraft((current) => (current ? { ...current, ...patch } : current));
	}, []);

	const selectSection = (next: string) => {
		setSearchParams((current) => {
			const params = new URLSearchParams(current);
			params.set("section", next);
			return params;
		});
	};

	const handleSave = async () => {
		if (!functionData || !draft) return;
		if (!draft.name.trim()) {
			setError("Please enter a function name");
			return;
		}

		const executionAlias = draft.executionAlias.trim();
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
			return;
		}

		setError("");
		setSaving(true);
		try {
			const namespacePayload =
				draft.namespaceId != null &&
				draft.namespaceId !== functionData.namespaceId
					? draft.namespaceId
					: undefined;

			const response = await updateFunction(functionData.id, {
				name: draft.name.trim() || undefined,
				description: draft.description.trim() || undefined,
				image: draft.image,
				startup_file: draft.startupFile.trim() || undefined,
				docker_mount: draft.dockerMount,
				network_restricted: draft.networkRestricted,
				ffmpeg_install: draft.ffmpegInstall,
				opencv_install: draft.opencvInstall,
				executionAlias: executionAlias === "" ? undefined : executionAlias,
				settings: {
					max_ram: draft.maxRam,
					timeout: draft.timeout,
					allow_http: draft.allowHttp,
					secure_header:
						draft.secureHeader.length === 0 ? null : draft.secureHeader,
					cache_enabled: draft.cacheEnabled,
					cache_ttl: draft.cacheTtl,
				},
				cors_origins: draft.corsOrigins,
				...(namespacePayload !== undefined && {
					namespaceId: namespacePayload,
				}),
			});

			if (response.status === "OK") {
				const updated = { ...functionData, ...response.data };
				const nextDraft = draftFromFunction(updated);
				setFunctionData(updated);
				setDraft(nextDraft);
				setSavedDraft(nextDraft);
				toast.success("Function settings saved");
			} else {
				setError("Error updating function: " + response.message);
			}
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-24">
				<div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
			</div>
		);
	}

	if (loadFailed || !functionData || !draft || !savedDraft) {
		return (
			<div className="flex flex-col items-center py-24 text-center">
				<h2 className="text-xl font-semibold text-text mb-2">
					Function Not Found
				</h2>
				<p className="text-sm text-muted">
					The requested function could not be loaded.
				</p>
			</div>
		);
	}

	const canEdit = can(functionData.access, "edit");
	const isOwner = can(functionData.access, "owner");
	const htmlOnly =
		!!functionData.startup_file &&
		functionData.startup_file.trim().toLowerCase().endsWith(".html");
	const disabled = saving || !canEdit;
	const dirty = !draftsEqual(draft, savedDraft);
	const disabledReason = htmlOnly
		? HTML_ONLY_REASON
		: !canEdit
			? "You have read-only access to this shared function."
			: undefined;

	const renderSection = (settingsSection: FunctionSettingsSectionId) => {
		switch (settingsSection) {
			case "general":
				return (
					<GeneralSection
						functionData={functionData}
						draft={draft}
						onChange={updateDraft}
						disabled={disabled}
						isOwner={isOwner}
						onSourceFlagsCleared={() =>
							setFunctionData((current) =>
								current
									? { ...current, imported: false, ai_kicked_off: false }
									: current,
							)
						}
					/>
				);
			case "runtime":
				return (
					<RuntimeSection
						functionId={functionData.id}
						currentImage={functionData.image}
						draft={draft}
						onChange={updateDraft}
						disabled={disabled}
						isOwner={isOwner}
						htmlOnly={htmlOnly}
					/>
				);
			case "network":
				return (
					<NetworkSection
						functionId={functionData.id}
						draft={draft}
						onChange={updateDraft}
						disabled={disabled}
						htmlOnly={htmlOnly}
					/>
				);
			case "caching":
				return (
					<CachingSection
						draft={draft}
						onChange={updateDraft}
						disabled={disabled}
					/>
				);
			case "access":
				return (
					<AccessSection
						draft={draft}
						onChange={updateDraft}
						disabled={disabled}
					/>
				);
			case "rate-limits":
				return (
					<RateLimitsSection
						functionId={functionData.id}
						disabledReason={disabledReason}
						active={section === "rate-limits"}
					/>
				);
		}
	};

	return (
		<div className="w-full max-w-5xl">
			<div className="mb-6 space-y-2">
				<Link
					to={`/functions/${functionData.id}`}
					className="text-xs text-muted hover:text-text transition-colors"
				>
					← Back to function
				</Link>
				<div>
					<h1 className="text-xl font-semibold text-text">
						{functionData.name} settings
					</h1>
					<p className="mt-1 text-sm text-muted">
						Each section has its own URL, so links can open the exact setting.
					</p>
				</div>
			</div>

			<nav
				aria-label="Settings sections"
				className="mb-6 flex flex-wrap gap-1 border-b border-white/[0.07]"
			>
				{FUNCTION_SETTINGS_SECTIONS.map((settingsSection) => {
					const active = settingsSection.id === section;
					return (
						<button
							key={settingsSection.id}
							type="button"
							onClick={() => selectSection(settingsSection.id)}
							aria-current={active ? "page" : undefined}
							className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
								active
									? "border-primary text-primary"
									: "border-transparent text-muted hover:text-text"
							}`}
						>
							{settingsSection.label}
						</button>
					);
				})}
			</nav>

			<div className="space-y-6">
				{error && (
					<div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
						{error}
					</div>
				)}

				{!canEdit && (
					<div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
						You can view these settings but not change them.
					</div>
				)}

				<div className="bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded-r-lg flex items-start gap-4">
					<div>
						<h3 className="text-yellow-300 text-sm font-semibold mb-1">
							Data Deletion Warning
						</h3>
						<p className="text-yellow-200/80 text-xs leading-relaxed">
							Updating this function may cause temporary downtime and could{" "}
							<span className="underline decoration-yellow-400">
								delete all files in
							</span>{" "}
							<code className="text-yellow-300">/app</code>. Back up any
							important data before updating fields that trigger a redeploy
							like Image, Docker Mount, Network Restriction, FFMPEG Install, or
							OpenCV Install.
						</p>
					</div>
				</div>

				{FUNCTION_SETTINGS_SECTIONS.filter((settingsSection) =>
					visitedSections.current.has(settingsSection.id),
				).map((settingsSection) => (
					<div
						key={settingsSection.id}
						hidden={settingsSection.id !== section}
					>
						{renderSection(settingsSection.id)}
					</div>
				))}

				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
					<span className="text-xs text-muted" role="status">
						{dirty ? "Unsaved changes" : "No unsaved changes"}
					</span>
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => {
								void handleSave();
							}}
							className={primaryBtnClass}
							disabled={saving || !dirty || !canEdit}
						>
							{saving ? "Saving..." : "Save changes"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default FunctionSettings;
