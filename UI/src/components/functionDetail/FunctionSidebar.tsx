import { useState } from "react";
import type { useFileUpload } from "../../hooks/useFileUpload";
import type { useFunctionFiles } from "../../hooks/useFunctionFiles";
import type { useFunctionLogs } from "../../hooks/useFunctionLogs";
import type { TimingEntry } from "../../types/FunctionExecution";
import type { Trigger, XFunction } from "../../types/Prisma";
import { downloadTextFile } from "../../utils/functionFiles";
import { FileManagerCard } from "../cards/FileManagerCard";
import { LogsCard } from "../cards/LogCard";
import { RateLimitCard } from "../cards/RateLimitCard";
import { TimingCard } from "../cards/TimingCard";
import { TriggersCard } from "../cards/TriggersCard";
import { FunctionActionsCard } from "./FunctionActionsCard";
import { FunctionUrlCard } from "./FunctionUrlCard";
import type { FunctionModal } from "./functionModal";

const HTML_ONLY_REASON = "This function is set to only serve an .html file";

interface FunctionSidebarProps {
	functionData: XFunction;
	htmlOnly: boolean;
	aiEnabled: boolean;
	files: ReturnType<typeof useFunctionFiles>;
	upload: ReturnType<typeof useFileUpload>;
	logs: ReturnType<typeof useFunctionLogs>;
	triggers: Trigger[];
	onRunTrigger: (trigger: Trigger) => void;
	tooks: TimingEntry[];
	onOpenModal: (modal: FunctionModal) => void;
}

export function FunctionSidebar({
	functionData,
	htmlOnly,
	aiEnabled,
	files,
	upload,
	logs,
	triggers,
	onRunTrigger,
	tooks,
	onOpenModal,
}: FunctionSidebarProps) {
	const [showTriggersDetails, setShowTriggersDetails] = useState(
		triggers.length > 0,
	);
	const [showTimingDetails, setShowTimingDetails] = useState(false);
	const [showLogsDetails, setShowLogsDetails] = useState(false);

	return (
		<div className="w-full xl:w-72 shrink-0 space-y-4">
			<FunctionActionsCard
				functionData={functionData}
				envDisabled={htmlOnly}
				onOpenSettings={() => onOpenModal({ type: "settings" })}
				onOpenEnv={() => onOpenModal({ type: "env" })}
				onOpenGuests={() => onOpenModal({ type: "guests" })}
				onOpenVersionControl={() => onOpenModal({ type: "git" })}
			/>

			<FunctionUrlCard functionData={functionData} />

			<FileManagerCard
				files={files.files}
				folders={files.folders}
				activeFile={files.activeFile}
				onFileSelect={files.selectFile}
				onCreateFile={(parentPath) =>
					onOpenModal({ type: "createFile", parentPath: parentPath ?? "" })
				}
				onCreateFolder={(parentPath) =>
					onOpenModal({
						type: "folder",
						mode: "create",
						parentPath: parentPath ?? "",
						targetPath: "",
					})
				}
				onRenameFolder={(folderPath) =>
					onOpenModal({
						type: "folder",
						mode: "rename",
						parentPath: "",
						targetPath: folderPath,
					})
				}
				onDeleteFolder={files.removeFolder}
				onDownloadFile={(file) => downloadTextFile(file.name, file.content)}
				onRenameFile={(file) => onOpenModal({ type: "renameFile", file })}
				onDeleteFile={(file) => onOpenModal({ type: "deleteFile", file })}
				onDeleteSelectedFiles={files.confirmAndDeleteFiles}
				nonSelectableOnSelectAllFileNames={
					functionData.startup_file ? [functionData.startup_file] : []
				}
				onDropFiles={upload.dropFiles}
				autoUnzipFiles={upload.autoUnzipFiles}
				onAutoUnzipFilesChange={upload.setAutoUnzipFiles}
				onAIGenerate={() => onOpenModal({ type: "ai" })}
				aiDisabled={!aiEnabled}
				aiDisabledReason="Enable AI in Account Settings to use AI KICKOFF."
				disabled={Boolean(functionData.git_url)}
				disabledReason="Git source active — file manager disabled. Use Version Control to manage files."
			/>

			<TriggersCard
				triggers={triggers}
				disabled={htmlOnly}
				disabledReason={HTML_ONLY_REASON}
				showDetails={showTriggersDetails}
				onToggleDetails={() => setShowTriggersDetails((open) => !open)}
				onCreateTrigger={() => onOpenModal({ type: "createTrigger" })}
				onEditTrigger={(trigger) => onOpenModal({ type: "editTrigger", trigger })}
				onDeleteTrigger={(trigger) =>
					onOpenModal({ type: "deleteTrigger", trigger })
				}
				onRunTrigger={onRunTrigger}
			/>

			<TimingCard
				tooks={tooks}
				showDetails={showTimingDetails}
				onToggleDetails={() => setShowTimingDetails((open) => !open)}
				disabled={htmlOnly}
				disabledReason={HTML_ONLY_REASON}
			/>

			<LogsCard
				logs={logs.logs}
				isLoadingLogs={logs.isLoading}
				showDetails={showLogsDetails}
				onToggleDetails={() => setShowLogsDetails((open) => !open)}
				onRefreshLogs={logs.refresh}
				onViewLogs={() => logs.setModalOpen(true)}
				functionId={functionData.id}
				disabled={htmlOnly}
				disabledReason={HTML_ONLY_REASON}
			/>

			<RateLimitCard
				functionId={functionData.id}
				disabled={htmlOnly}
				disabledReason={HTML_ONLY_REASON}
			/>
		</div>
	);
}
