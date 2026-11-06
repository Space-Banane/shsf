import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import type { OnMount } from "@monaco-editor/react";
import { UserContext } from "../../App";
import { ConsoleCard } from "../../components/cards/ConsoleCard";
import { CodeEditorPanel } from "../../components/functionDetail/CodeEditorPanel";
import { EditorToolbar } from "../../components/functionDetail/EditorToolbar";
import { FunctionHeader } from "../../components/functionDetail/FunctionHeader";
import { FunctionModals } from "../../components/functionDetail/FunctionModals";
import { FunctionResultModals } from "../../components/functionDetail/FunctionResultModals";
import { FunctionSidebar } from "../../components/functionDetail/FunctionSidebar";
import type { FunctionModal } from "../../components/functionDetail/functionModal";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { useDependencyInstall } from "../../hooks/useDependencyInstall";
import { useEditorViewState } from "../../hooks/useEditorViewState";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useFunctionExecution } from "../../hooks/useFunctionExecution";
import { useFunctionFiles } from "../../hooks/useFunctionFiles";
import { useFunctionLogs } from "../../hooks/useFunctionLogs";
import { useFunctionTriggers } from "../../hooks/useFunctionTriggers";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { getFiles, getFolders } from "../../services/backend.files";
import {
	getFunctionById,
	updateFunction,
} from "../../services/backend.functions";
import { getNamespace } from "../../services/backend.namespaces";
import { getTriggers } from "../../services/backend.triggers";
import type { Namespace, XFunction } from "../../types/Prisma";
import { exportFunctionToFile } from "../../utils/functionExport";
import { can } from "../../services/backend.sharing";
import SharedBadge from "../../components/ui/SharedBadge";
import {
	buildCliPullCommand,
	getDefaultLanguage,
	isHtmlOnlyFunction,
} from "../../utils/functionFiles";

const HTML_ONLY_REASON = "This function is set to only serve an .html file";

/**
 * Route for a single function. It loads the function and composes the editor,
 * execution, logs, triggers and modal workflows; each of those owns its own
 * state in a hook under `hooks/` or a component under `components/functionDetail/`.
 */
function FunctionDetail() {
	const { id } = useParams<{ id: string }>();
	const functionId = id ? parseInt(id) : null;
	const { user } = useContext(UserContext);

	const [functionData, setFunctionData] = useState<XFunction | null>(null);
	const [namespace, setNamespace] = useState<Namespace | null>(null);
	const [loading, setLoading] = useState(true);
	const [modal, setModal] = useState<FunctionModal | null>(null);
	const [resultModalsEnabled, setResultModalsEnabled] = useState(true);

	const htmlOnly = isHtmlOnlyFunction(functionData);
	const gitManaged = Boolean(functionData?.git_url);
	const canEdit = can(functionData?.access, "edit");
	const canExecute = can(functionData?.access, "execute");
	const aiEnabled = Boolean(user?.apiKeyConfigured);
	const closeModal = useCallback(() => setModal(null), []);

	const editorView = useEditorViewState();
	const execution = useFunctionExecution({ functionId, resultModalsEnabled });
	const files = useFunctionFiles({
		functionId,
		htmlOnly,
		readOnly: gitManaged || !canEdit,
		busy: execution.running,
		editorViewState: editorView,
	});
	const upload = useFileUpload({
		files: files.files,
		htmlOnly,
		persistFile: files.persistFile,
	});
	const logs = useFunctionLogs(
		functionId,
		!execution.running && execution.exitCode !== null,
	);
	const triggers = useFunctionTriggers(functionId, { onRan: logs.refresh });
	const dependencies = useDependencyInstall(functionId, {
		onFinished: () => void logs.refresh(),
	});
	const output = useAutoScroll(execution.consoleOutput);

	useUnsavedChangesGuard(files.hasUnsavedChanges);

	const { restore: restoreViewState } = editorView;
	const activeFileId = files.activeFile?.id;
	useEffect(() => {
		if (activeFileId === undefined) return;
		requestAnimationFrame(() => restoreViewState(activeFileId));
	}, [activeFileId, restoreViewState]);

	// Monaco captures the save command once at mount, so it calls through a ref.
	const saveShortcutRef = useRef<() => void>(() => {});
	saveShortcutRef.current = () => {
		if (files.canSave) void files.saveActiveFile();
	};
	const handleEditorMount: OnMount = (editor, monaco) => {
		editorView.editorRef.current = editor;
		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
			saveShortcutRef.current();
		});
	};

	const { replaceFiles } = files;
	const { setFolders } = files;
	const { setTriggers } = triggers;
	const loadData = useCallback(async () => {
		if (functionId === null) return;

		setLoading(true);
		try {
			const [functionResult, filesResult, foldersResult, triggersResult] =
				await Promise.all([
					getFunctionById(functionId),
					getFiles(functionId),
					getFolders(functionId),
					getTriggers(functionId),
				]);

			if (functionResult.status !== "OK") {
				toast.error("Error fetching function: " + functionResult.message);
				return;
			}
			const loaded = functionResult.data;
			setFunctionData(loaded);

			void getNamespace(loaded.namespaceId).then((namespaceResult) => {
				if (namespaceResult.status === "OK") setNamespace(namespaceResult.data);
			});

			if (filesResult.status === "OK") {
				replaceFiles(filesResult.data, loaded.startup_file);
			} else if (!loaded.git_url) {
				toast.error("Error fetching files: " + filesResult.message);
			}

			if (foldersResult.status === "OK") {
				setFolders(foldersResult.data);
			} else if (!loaded.git_url) {
				toast.error("Error fetching folders: " + foldersResult.message);
			}

			if (triggersResult.status === "OK") {
				setTriggers(triggersResult.data);
			} else {
				console.error("Error fetching triggers:", triggersResult.message);
			}
		} catch (error) {
			console.error("Error fetching data:", error);
			toast.error("An error occurred while fetching data.");
		} finally {
			setLoading(false);
		}
	}, [functionId, replaceFiles, setFolders, setTriggers]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	// `?preopen=guests` deep-links straight into the guest dialog.
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get("preopen") === "guests") setModal({ type: "guests" });

		return () => {
			params.delete("preopen");
			const query = params.toString();
			window.history.replaceState(
				{},
				"",
				window.location.pathname + (query ? "?" + query : ""),
			);
		};
	}, []);

	const updateEnvironment = async (env: { name: string; value: string }[]) => {
		if (functionId === null) return false;

		try {
			const response = await updateFunction(functionId, { environment: env });
			if (response.status !== "OK") {
				toast.error("Error updating environment variables: " + response.message);
				return false;
			}
			setFunctionData((prev) => (prev ? { ...prev, ...response.data } : prev));
			return true;
		} catch (error) {
			console.error("Error updating environment variables:", error);
			toast.error("An error occurred while updating environment variables.");
			return false;
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-24">
				<div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
			</div>
		);
	}

	if (!functionData) {
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

	return (
		<div className="w-full">
			<FunctionResultModals
				popup={execution.popup}
				onClosePopup={execution.closePopup}
				valueResult={execution.valueResult}
				onCloseValueResult={execution.closeValueResult}
				cacheEnabled={functionData.cache_enabled}
				dependencyResult={dependencies.result}
				dependencyResultOpen={dependencies.resultOpen}
				onCloseDependencyResult={dependencies.closeResult}
			/>

			<FunctionHeader
				namespaceName={namespace?.name}
				functionName={functionData.name}
				fileCount={files.files.length}
				triggerCount={triggers.triggers.length}
				httpEnabled={functionData.allow_http}
			/>
			{functionData.shared && (
				<div role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-200">
					<SharedBadge access={functionData.access} />
					<span>
						Owned by {functionData.owner?.displayName} ({functionData.owner?.email}).
						{!canEdit && " You can view this function but not change it."}
					</span>
				</div>
			)}

			<div className="flex flex-col xl:flex-row gap-6 w-full">
				<FunctionSidebar
					functionData={functionData}
					htmlOnly={htmlOnly}
					aiEnabled={aiEnabled}
					files={files}
					upload={upload}
					logs={logs}
					triggers={triggers.triggers}
					onRunTrigger={(trigger) => void triggers.run(trigger)}
					tooks={execution.tooks}
					onOpenModal={setModal}
				/>

				<div className="flex-1 min-w-0 space-y-4">
					<EditorToolbar
						functionData={functionData}
						activeFileName={files.activeFile?.name ?? null}
						language={getDefaultLanguage(files.activeFile?.name ?? "")}
						hasUnsavedChanges={files.hasUnsavedChanges}
						cliPullCommand={buildCliPullCommand(functionData)}
						htmlOnly={htmlOnly}
						hasRequirementsFile={files.files.some(
							(file) => file.name === "requirements.txt",
						)}
						running={execution.running}
						saving={files.saving}
						canSave={files.canSave}
						installing={dependencies.installing}
						runMode={execution.runMode}
						onRunModeChange={execution.setRunMode}
						showRunParams={execution.showRunParams}
						onToggleRunParams={() =>
							execution.setShowRunParams(!execution.showRunParams)
						}
						runParams={execution.runParams}
						onRunParamsChange={execution.setRunParams}
						resultModalsEnabled={resultModalsEnabled}
						onToggleResultModals={() => setResultModalsEnabled((on) => !on)}
						onManageDependencies={() => setModal({ type: "dependencies" })}
						onInstallDependencies={dependencies.install}
						onLoadDefaults={() => {
							if (!files.activeFile) {
								toast.error("No file is currently selected.");
								return;
							}
							setModal({ type: "loadDefault" });
						}}
						onSave={files.saveActiveFile}
						onExport={() =>
							void exportFunctionToFile({
								functionData,
								files: files.files,
								triggers: triggers.triggers,
							})
						}
						onRun={execution.run}
						canEdit={canEdit}
						canExecute={canExecute}
					/>

					<CodeEditorPanel
						hasActiveFile={files.activeFile !== null}
						gitManaged={gitManaged}
						language={getDefaultLanguage(files.activeFile?.name ?? "")}
						code={files.code}
						onChange={files.setCode}
						onMount={handleEditorMount}
						onOpenVersionControl={() => setModal({ type: "git" })}
						readOnly={!canEdit}
					/>

					<ConsoleCard
						consoleOutput={execution.consoleOutput}
						exitCode={execution.exitCode}
						executionTime={execution.executionTime}
						realTimeTaken={execution.realTimeTaken}
						functionResult={execution.functionResult}
						functionData={functionData}
						autoScroll={output.autoScroll}
						consoleOutputRef={output.ref}
						onConsoleScroll={output.onScroll}
						onResumeAutoScroll={output.resume}
						disabled={htmlOnly}
						disabledReason={HTML_ONLY_REASON}
					/>
				</div>
			</div>

			<FunctionModals
				modal={modal}
				onClose={closeModal}
				functionData={functionData}
				htmlOnly={htmlOnly}
				aiEnabled={aiEnabled}
				files={files}
				triggers={triggers}
				logs={logs}
				onFunctionChanged={() => void loadData()}
				onUpdateEnvironment={updateEnvironment}
			/>
		</div>
	);
}

export default FunctionDetail;
