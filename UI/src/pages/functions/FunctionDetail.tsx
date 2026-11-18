import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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
import {
	pageTitleKeys,
	resolvePageTitle,
	usePageTitle,
} from "../../hooks/usePageTitle";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { getFiles, getFolders } from "../../services/backend.files";
import {
	getFunctionById,
	updateFunction,
} from "../../services/backend.functions";
import { getNamespace } from "../../services/backend.namespaces";
import { getTriggers } from "../../services/backend.triggers";
import type {
	FunctionFile,
	Namespace,
	Trigger,
	XFunction,
} from "../../types/Prisma";
import { exportFunctionToFile } from "../../utils/functionExport";
import { can } from "../../services/backend.sharing";
import SharedBadge from "../../components/ui/SharedBadge";
import {
	buildCliPullCommand,
	getDefaultLanguage,
	isHtmlOnlyFunction,
} from "../../utils/functionFiles";

const HTML_ONLY_REASON = "This function is set to only serve an .html file";
const MODAL_PARAM_KEYS = ["modal", "parent", "mode", "target", "file", "trigger"] as const;

function parseFunctionModal(
	params: URLSearchParams,
	files: FunctionFile[],
	triggers: Trigger[],
): FunctionModal | null {
	const type = params.get("modal");
	switch (type) {
		case "settings":
		case "env":
		case "guests":
		case "git":
		case "share":
		case "ai":
		case "loadDefault":
		case "dependencies":
		case "createTrigger":
		case "logs":
			return { type };
		case "createFile":
			return { type, parentPath: params.get("parent") ?? "" };
		case "folder":
			return {
				type,
				mode: params.get("mode") === "rename" ? "rename" : "create",
				parentPath: params.get("parent") ?? "",
				targetPath: params.get("target") ?? "",
			};
		case "renameFile":
		case "deleteFile": {
			const file = files.find(
				(candidate) => String(candidate.id) === params.get("file"),
			);
			return file ? { type, file } : null;
		}
		case "editTrigger":
		case "deleteTrigger": {
			const trigger = triggers.find(
				(candidate) => String(candidate.id) === params.get("trigger"),
			);
			return trigger ? { type, trigger } : null;
		}
		default:
			return null;
	}
}

function writeFunctionModal(
	modal: FunctionModal | null,
	base: URLSearchParams,
): URLSearchParams {
	const params = new URLSearchParams(base);
	for (const key of MODAL_PARAM_KEYS) params.delete(key);
	if (!modal) return params;

	params.set("modal", modal.type);
	if (modal.type === "createFile") {
		params.set("parent", modal.parentPath);
	} else if (modal.type === "folder") {
		params.set("mode", modal.mode);
		params.set("parent", modal.parentPath);
		params.set("target", modal.targetPath);
	} else if (modal.type === "renameFile" || modal.type === "deleteFile") {
		params.set("file", String(modal.file.id));
	} else if (modal.type === "editTrigger" || modal.type === "deleteTrigger") {
		params.set("trigger", String(modal.trigger.id));
	}
	return params;
}

/**
 * Route for a single function. It loads the function and composes the editor,
 * execution, logs, triggers and modal workflows; each of those owns its own
 * state in a hook under `hooks/` or a component under `components/functionDetail/`.
 */
function FunctionDetail() {
	const { id } = useParams<{ id: string }>();
	const functionId = id ? parseInt(id) : null;
	const { user } = useContext(UserContext);
	const [searchParams, setSearchParams] = useSearchParams();

	const [functionData, setFunctionData] = useState<XFunction | null>(null);
	const [namespace, setNamespace] = useState<Namespace | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadFailed, setLoadFailed] = useState(false);
	const [resultModalsEnabled, setResultModalsEnabled] = useState(true);

	// Only trust the loaded name when it belongs to the id in the URL, so the
	// tab never keeps the previous function's title while the next one loads.
	const loadedTitle = functionData && functionData.id === functionId ? functionData.name : null;
	usePageTitle(
		loadedTitle ??
			(loading
				? null
				: resolvePageTitle(
						loadFailed ? pageTitleKeys.functionFallback : pageTitleKeys.notFound,
					)),
	);

	const htmlOnly = isHtmlOnlyFunction(functionData);
	const gitManaged = Boolean(functionData?.git_url);
	const canEdit = can(functionData?.access, "edit");
	const canExecute = can(functionData?.access, "execute");
	const aiEnabled = Boolean(user?.apiKeyConfigured);

	const editorView = useEditorViewState();
	const execution = useFunctionExecution({ functionId, resultModalsEnabled });
	const files = useFunctionFiles({
		functionId,
		htmlOnly,
		readOnly: gitManaged || !canEdit,
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
		searchParams.get("modal") === "logs",
	);
	const triggers = useFunctionTriggers(functionId, {
		onRan: logs.refreshSilently,
	});
	const dependencies = useDependencyInstall(functionId, {
		onFinished: () => void logs.refreshSilently(),
	});
	const output = useAutoScroll(execution.consoleOutput);
	const modal = useMemo(
		() => parseFunctionModal(searchParams, files.files, triggers.triggers),
		[searchParams, files.files, triggers.triggers],
	);
	const openModal = useCallback(
		(next: FunctionModal) => {
			setSearchParams((current) => writeFunctionModal(next, current));
		},
		[setSearchParams],
	);
	const closeModal = useCallback(() => {
		setSearchParams((current) => writeFunctionModal(null, current), {
			replace: true,
		});
	}, [setSearchParams]);

	// The backend runs the persisted files, so persist pending edits first. A
	// failed save cancels the run instead of executing an older version.
	const runExecution = execution.run;
	const saveActiveFile = files.saveActiveFile;
	const hasUnsavedChanges = files.hasUnsavedChanges;
	const handleRun = useCallback(async () => {
		if (hasUnsavedChanges) {
			const saved = await saveActiveFile();
			if (!saved) {
				toast.error("Run cancelled: your unsaved changes could not be saved.");
				return;
			}
		}
		await runExecution();
	}, [hasUnsavedChanges, runExecution, saveActiveFile]);

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
		setLoadFailed(false);
		try {
			const [functionResult, filesResult, foldersResult, triggersResult] =
				await Promise.all([
					getFunctionById(functionId),
					getFiles(functionId),
					getFolders(functionId),
					getTriggers(functionId),
				]);

			if (functionResult.status !== "OK") {
				setLoadFailed(true);
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
			setLoadFailed(true);
			toast.error("An error occurred while fetching data.");
		} finally {
			setLoading(false);
		}
	}, [functionId, replaceFiles, setFolders, setTriggers]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	// `?preopen=guests` still works for links created before dialogs were URL-backed.
	useEffect(() => {
		if (!searchParams.has("preopen")) return;
		const params = new URLSearchParams(searchParams);
		const preopen = params.get("preopen");
		params.delete("preopen");
		if (preopen === "guests" && !params.has("modal")) {
			params.set("modal", "guests");
		}
		setSearchParams(params, { replace: true });
	}, [searchParams, setSearchParams]);

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
					onOpenModal={openModal}
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
						onManageDependencies={() => openModal({ type: "dependencies" })}
						onInstallDependencies={dependencies.install}
						onLoadDefaults={() => {
							if (!files.activeFile) {
								toast.error("No file is currently selected.");
								return;
							}
							openModal({ type: "loadDefault" });
						}}
						onSave={files.saveActiveFile}
						onExport={async () => {
							const exportFiles = await files.readAllFileContents();
							if (!exportFiles) {
								toast.error(
									"Error exporting: could not load every file.",
								);
								return;
							}
							await exportFunctionToFile({
								functionData,
								files: exportFiles,
								triggers: triggers.triggers,
							});
						}}
						onRun={handleRun}
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
						onOpenVersionControl={() => openModal({ type: "git" })}
						readOnly={!canEdit}
						loading={files.contentState === "loading"}
						error={
							files.contentState === "error" ? files.contentError : null
						}
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
