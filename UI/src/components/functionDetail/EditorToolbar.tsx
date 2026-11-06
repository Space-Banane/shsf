import { toast } from "react-toastify";
import { getImageDisplayName, type XFunction } from "../../types/Prisma";
import type { RunMode } from "../../types/FunctionExecution";
import { copyTextToClipboard } from "../../utils/clipboard";
import { RunControls, RunParamsInput } from "./RunControls";

const secondaryButton =
	"h-9 px-3 text-sm rounded-lg bg-background/45 border border-primary/20 text-primary hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300";

interface EditorToolbarProps {
	functionData: XFunction;
	activeFileName: string | null;
	language: string;
	hasUnsavedChanges: boolean;
	cliPullCommand: string;
	htmlOnly: boolean;
	hasRequirementsFile: boolean;
	running: boolean;
	saving: boolean;
	canSave: boolean;
	installing: boolean;
	runMode: RunMode;
	onRunModeChange: (mode: RunMode) => void;
	showRunParams: boolean;
	onToggleRunParams: () => void;
	runParams: string;
	onRunParamsChange: (value: string) => void;
	resultModalsEnabled: boolean;
	onToggleResultModals: () => void;
	onManageDependencies: () => void;
	onInstallDependencies: () => void;
	onLoadDefaults: () => void;
	onSave: () => void;
	onExport: () => void;
	onRun: () => void;
	/** Caller's effective access; below edit hides mutations, below execute disables Run. */
	canEdit?: boolean;
	canExecute?: boolean;
}

export function EditorToolbar({
	functionData,
	activeFileName,
	language,
	hasUnsavedChanges,
	cliPullCommand,
	htmlOnly,
	hasRequirementsFile,
	running,
	saving,
	canSave,
	installing,
	runMode,
	onRunModeChange,
	showRunParams,
	onToggleRunParams,
	runParams,
	onRunParamsChange,
	resultModalsEnabled,
	onToggleResultModals,
	onManageDependencies,
	onInstallDependencies,
	onLoadDefaults,
	onSave,
	onExport,
	onRun,
	canEdit = true,
	canExecute = true,
}: EditorToolbarProps) {
	const gitManaged = Boolean(functionData.git_url);
	const supportsDependencyManager =
		functionData.image.startsWith("python") ||
		functionData.image.startsWith("golang") ||
		functionData.image.startsWith("node:");

	const copyCliCommand = async () => {
		try {
			await copyTextToClipboard(cliPullCommand);
			toast.success("CLI command copied");
		} catch {
			toast.error(
				"The command could not be copied. Select it and copy it manually.",
			);
		}
	};

	return (
		<div className="bg-surface border border-white/[0.07] rounded-xl p-4 space-y-4">
			<div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
				<div className="min-w-0 flex items-start gap-3">
					<div className="w-9 h-9 bg-gradient-to-br from-blue-500/15 to-cyan-500/10 border border-blue-400/20 rounded-xl flex items-center justify-center text-base flex-shrink-0">
						📝
					</div>
					<div className="min-w-0 space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<h2 className="text-lg font-semibold text-primary truncate">
								{activeFileName ?? "No file selected"}
							</h2>
							{activeFileName && (
								<span
									className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
										hasUnsavedChanges
											? "border-amber-400/30 bg-amber-500/10 text-amber-300"
											: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
									}`}
								>
									{hasUnsavedChanges ? "Unsaved" : "Saved"}
								</span>
							)}
						</div>
						<p className="text-xs text-text/55">
							{activeFileName
								? `${language || "plaintext"} file`
								: "Select a file from the sidebar to start editing"}
						</p>
						<p className="text-xs text-text/45">
							Runtime: {getImageDisplayName(functionData.image)}
						</p>
					</div>
				</div>

				<RunControls
					runMode={runMode}
					onRunModeChange={onRunModeChange}
					showRunParams={showRunParams}
					onToggleRunParams={onToggleRunParams}
					resultModalsEnabled={resultModalsEnabled}
					onToggleResultModals={onToggleResultModals}
					locked={running || saving || htmlOnly}
					htmlOnly={htmlOnly}
				/>
			</div>

			<div className="flex flex-col gap-2 rounded-xl border border-primary/10 bg-background/20 p-3 lg:flex-row lg:items-center">
				<div className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-text/45">
					CLI Pull
				</div>
				<input
					type="text"
					value={cliPullCommand}
					readOnly
					disabled
					aria-label="CLI pull command"
					className="h-9 min-w-0 flex-1 rounded-lg border border-primary/10 bg-background/35 px-3 text-xs text-text/70 outline-none disabled:cursor-text disabled:opacity-100"
					onClick={(e) => e.currentTarget.select()}
				/>
				<button
					className="h-9 shrink-0 rounded-lg border border-primary/20 bg-background/45 px-3 text-sm text-primary transition-all duration-300 hover:border-primary/40"
					onClick={copyCliCommand}
				>
					Copy
				</button>
			</div>

			<div className="flex flex-wrap items-center justify-end gap-2 border-t border-primary/10 pt-4">
				{canEdit && !htmlOnly && supportsDependencyManager && (
					<button
						className={secondaryButton}
						onClick={onManageDependencies}
						disabled={running || saving || gitManaged}
						title={
							gitManaged
								? "Dependency files are managed by the linked git repository"
								: "Edit runtime dependency manifests"
						}
					>
						Manage Dependencies
					</button>
				)}
				{/* A git-backed function's files aren't loaded here, so offer the install anyway. */}
				{canEdit && (hasRequirementsFile || gitManaged) && (
					<button
						className="h-9 px-3 text-sm rounded-lg bg-blue-600/90 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
						onClick={onInstallDependencies}
						disabled={installing || running || saving}
					>
						{installing ? "Installing..." : "Install requirements.txt"}
					</button>
				)}
				{canEdit && <button
					className={secondaryButton}
					onClick={onLoadDefaults}
					disabled={!activeFileName || saving || running || gitManaged}
				>
					{saving ? "Loading..." : "Load Defaults"}
				</button>}
				{canEdit && <button
					className={secondaryButton}
					onClick={onSave}
					disabled={!canSave}
					title={
						hasUnsavedChanges ? "Save file (Ctrl/Cmd+S)" : "No unsaved changes"
					}
				>
					{saving ? "Saving..." : "Save"}
				</button>}
				<button className={secondaryButton} onClick={onExport}>
					Export
				</button>
				<button
					className="h-9 px-3 text-sm rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
					onClick={onRun}
					disabled={running || saving || !canExecute}
					title={canExecute ? undefined : "You have view-only access to this function"}
				>
					{running ? "Running..." : "Run Function"}
				</button>
			</div>

			{showRunParams && (
				<RunParamsInput value={runParams} onChange={onRunParamsChange} />
			)}
		</div>
	);
}
