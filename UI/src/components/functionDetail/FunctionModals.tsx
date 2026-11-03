import { toast } from "react-toastify";
import AIGenerateModal from "../modals/AIGenerateModal";
import CreateFileModal from "../modals/functionFiles/CreateFileModal";
import DeleteFileModal from "../modals/functionFiles/DeleteFileModal";
import FolderModal from "../modals/functionFiles/FolderModal";
import LoadDefaultModal from "../modals/functionFiles/LoadDefaultModal";
import RenameFileModal from "../modals/functionFiles/RenameFileModal";
import CreateTriggerModal from "../modals/functionTriggers/CreateTriggerModal";
import DeleteTriggerModal from "../modals/functionTriggers/DeleteTriggerModal";
import EditTriggerModal from "../modals/functionTriggers/EditTriggerModal";
import TriggerLogsModal from "../modals/functionTriggers/TriggerLogsModal";
import DependencyManagerModal from "../modals/functionDetail/DependencyManagerModal";
import GitVersionControlModal from "../modals/functions/GitVersionControlModal";
import UpdateEnvModal from "../modals/functions/UpdateEnvModal";
import UpdateFunctionModal from "../modals/functions/UpdateFunctionModal";
import GuestManagement from "../modals/guests/GuestManagement";
import type { useFunctionFiles } from "../../hooks/useFunctionFiles";
import type { useFunctionLogs } from "../../hooks/useFunctionLogs";
import type { useFunctionTriggers } from "../../hooks/useFunctionTriggers";
import type { XFunction } from "../../types/Prisma";
import type { FunctionModal } from "./functionModal";

type Files = ReturnType<typeof useFunctionFiles>;
type Logs = ReturnType<typeof useFunctionLogs>;
type Triggers = ReturnType<typeof useFunctionTriggers>;

interface FunctionModalsProps {
	modal: FunctionModal | null;
	onClose: () => void;
	functionData: XFunction;
	htmlOnly: boolean;
	aiEnabled: boolean;
	files: Files;
	triggers: Triggers;
	logs: Logs;
	/** Reloads the function after a change that can affect everything on the page. */
	onFunctionChanged: () => void;
	onUpdateEnvironment: (env: { name: string; value: string }[]) => Promise<boolean>;
}

const AI_DISABLED_REASON = "Enable AI in Account Settings to use AI KICKOFF.";

/** Every dialog of the function page, driven by the single `modal` selection. */
export function FunctionModals({
	modal,
	onClose,
	functionData,
	htmlOnly,
	aiEnabled,
	files,
	triggers,
	logs,
	onFunctionChanged,
	onUpdateEnvironment,
}: FunctionModalsProps) {
	const allowedFileTypes = htmlOnly ? [".html"] : undefined;
	const folder = modal?.type === "folder" ? modal : null;

	return (
		<div>
			<DependencyManagerModal
				isOpen={modal?.type === "dependencies"}
				onClose={onClose}
				functionId={functionData.id}
				image={functionData.image}
				files={files.files}
				onSave={async (filename, content) => {
					const result = await files.persistFile(filename, content);
					if (!result.success) {
						toast.error(`Error saving ${filename}: ${result.message}`);
						return false;
					}
					return true;
				}}
			/>
			<CreateFileModal
				isOpen={modal?.type === "createFile"}
				onClose={onClose}
				onCreate={(filename, content) => {
					const parent = modal?.type === "createFile" ? modal.parentPath : "";
					return files.createFile(
						parent ? `${parent}/${filename}` : filename,
						content,
					);
				}}
				allowedFileTypes={allowedFileTypes}
			/>
			<FolderModal
				isOpen={folder !== null}
				mode={folder?.mode ?? "create"}
				parentPath={folder?.parentPath ?? ""}
				currentName={folder?.targetPath ?? ""}
				onClose={onClose}
				onSubmit={(leafName) =>
					folder
						? files.submitFolder(
								folder.mode,
								{
									parentPath: folder.parentPath,
									targetPath: folder.targetPath,
								},
								leafName,
							)
						: Promise.resolve(false)
				}
			/>
			<RenameFileModal
				isOpen={modal?.type === "renameFile"}
				onClose={onClose}
				onRename={(newName) =>
					modal?.type === "renameFile"
						? files.renameFileTo(modal.file, newName)
						: Promise.resolve(false)
				}
				currentFilename={modal?.type === "renameFile" ? modal.file.name : ""}
				allowedFileTypes={allowedFileTypes}
			/>
			<DeleteFileModal
				isOpen={modal?.type === "deleteFile"}
				onClose={onClose}
				onDelete={() =>
					modal?.type === "deleteFile"
						? files.deleteFiles([modal.file])
						: Promise.resolve(false)
				}
				filename={modal?.type === "deleteFile" ? modal.file.name : ""}
			/>
			<UpdateFunctionModal
				isOpen={modal?.type === "settings"}
				onClose={onClose}
				onSuccess={onFunctionChanged}
				functionData={functionData}
				lastLogs={logs.logs}
			/>
			<UpdateEnvModal
				isOpen={modal?.type === "env"}
				onClose={onClose}
				onUpdate={onUpdateEnvironment}
				envString={
					typeof functionData.env === "string"
						? functionData.env
						: JSON.stringify(functionData.env ?? [])
				}
			/>
			<CreateTriggerModal
				isOpen={modal?.type === "createTrigger"}
				onClose={onClose}
				onCreate={(_functionId, name, description, cron, data, enabled) =>
					triggers.create({ name, description, cron, data, enabled })
				}
				initialFunctionId={functionData.id}
			/>
			<EditTriggerModal
				isOpen={modal?.type === "editTrigger"}
				onClose={onClose}
				onUpdate={(name, description, cron, data, enabled) =>
					modal?.type === "editTrigger"
						? triggers.update(modal.trigger.id, {
								name,
								description,
								cron,
								data,
								enabled,
							})
						: Promise.resolve(false)
				}
				onRun={() =>
					triggers.run(modal?.type === "editTrigger" ? modal.trigger : null)
				}
				trigger={modal?.type === "editTrigger" ? modal.trigger : null}
			/>
			<DeleteTriggerModal
				isOpen={modal?.type === "deleteTrigger"}
				onClose={onClose}
				onDelete={() =>
					modal?.type === "deleteTrigger"
						? triggers.remove(modal.trigger.id)
						: Promise.resolve(false)
				}
				triggerName={modal?.type === "deleteTrigger" ? modal.trigger.name : ""}
			/>
			<TriggerLogsModal
				isOpen={logs.modalOpen}
				onClose={() => logs.setModalOpen(false)}
				logs={logs.logs}
				isLoading={logs.isLoading}
				functionId={functionData.id}
				onRefresh={logs.refresh}
			/>
			<GuestManagement
				isOpen={modal?.type === "guests"}
				onClose={onClose}
				functionId={functionData.id}
			/>
			<GitVersionControlModal
				isOpen={modal?.type === "git"}
				onClose={onClose}
				functionId={functionData.id}
				onChanged={onFunctionChanged}
			/>
			<LoadDefaultModal
				isOpen={modal?.type === "loadDefault"}
				onClose={onClose}
				onLoadDefault={files.loadDefaultInto}
				functionLanguage={functionData.image}
			/>
			<AIGenerateModal
				isOpen={modal?.type === "ai"}
				onClose={onClose}
				functionId={functionData.id}
				existingFiles={files.files}
				disabled={!aiEnabled}
				disabledReason={AI_DISABLED_REASON}
				onSuccess={() => void files.refreshExplorer()}
			/>
		</div>
	);
}
