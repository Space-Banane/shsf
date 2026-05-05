import { toast } from "react-toastify";
import { useBeforeUnload, useBlocker, useParams } from "react-router-dom";
import { SHSFExport } from "../../components/modals/functions/ImportFunctionModal";
import { useEffect, useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import CreateFileModal from "../../components/modals/functionFiles/CreateFileModal";
import RenameFileModal from "../../components/modals/functionFiles/RenameFileModal";
import DeleteFileModal from "../../components/modals/functionFiles/DeleteFileModal";
import UpdateFunctionModal from "../../components/modals/functions/UpdateFunctionModal";
import CreateTriggerModal from "../../components/modals/functionTriggers/CreateTriggerModal";
import EditTriggerModal from "../../components/modals/functionTriggers/EditTriggerModal";
import DeleteTriggerModal from "../../components/modals/functionTriggers/DeleteTriggerModal";
import UpdateEnvModal from "../../components/modals/functions/UpdateEnvModal";
import TriggerLogsModal from "../../components/modals/functionTriggers/TriggerLogsModal";
import GuestManagement from "../../components/modals/guests/GuestManagement";
import LoadDefaultModal from "../../components/modals/functionFiles/LoadDefaultModal";
import AIGenerateModal from "../../components/modals/AIGenerateModal";
import GitVersionControlModal from "../../components/modals/functions/GitVersionControlModal";
import DependencyModal from "../../components/modals/functionDetail/DependencyModal";
import ResultModal from "../../components/modals/functionDetail/ResultModal";
import HtmlResultModal from "../../components/modals/functionDetail/HtmlResultModal";
import ImageResultModal from "../../components/modals/functionDetail/ImageResultModal";
import {
	FunctionFile,
	XFunction,
	Trigger,
	Namespace,
	TriggerLog,
} from "../../types/Prisma";
import {
	getFunctionById,
	executeFunction,
	executeFunctionStreaming,
	updateFunction,
	getLogsByFuncId,
	installDependencies,
} from "../../services/backend.functions";
import {
	getFiles,
	createOrUpdateFile,
	deleteFile,
	renameFile,
	loadDefaultContent,
} from "../../services/backend.files";
import {
	createTrigger,
	getTriggers,
	updateTrigger,
	deleteTrigger,
	runTrigger,
} from "../../services/backend.triggers";
import { getNamespace } from "../../services/backend.namespaces";
import { BASE_URL } from "../..";
import React from "react";
import { ConsoleCard } from "../../components/cards/ConsoleCard";
import { LogsCard } from "../../components/cards/LogCard";
import { RateLimitCard } from "../../components/cards/RateLimitCard";
import { TimingCard } from "../../components/cards/TimingCard";
import { TriggersCard } from "../../components/cards/TriggersCard";
import { FileManagerCard } from "../../components/cards/FileManagerCard";
import { ActionButton } from "../../components/buttons/ActionButton";
import { useConfirm } from "../../components/modals/ConfirmModal";

// Define the timing entry interface
export interface TimingEntry {
	timestamp: number;
	value: number;
	description: string;
}

function FunctionDetail() {
	const { id } = useParams<{ id: string }>();
	const confirm = useConfirm();
	const [functionData, setFunctionData] = useState<XFunction | null>(null);
	const [nameSpace, setNamespace] = useState<Namespace | null>(null);
	const [loading, setLoading] = useState(true);
	const [files, setFiles] = useState<FunctionFile[]>([]);
	const [triggers, setTriggers] = useState<Trigger[]>([]);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showRenameModal, setShowRenameModal] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [showUpdateModal, setShowUpdateModal] = useState(false);
	const [showCreateTriggerModal, setShowCreateTriggerModal] = useState(false);
	const [showEditTriggerModal, setShowEditTriggerModal] = useState(false);
	const [showDeleteTriggerModal, setShowDeleteTriggerModal] = useState(false);
	const [showEnvModal, setShowEnvModal] = useState(false);
	const [selectedFile, setSelectedFile] = useState<FunctionFile | null>(null);
	const [selectedTrigger, setSelectedTrigger] = useState<Trigger | null>(null);
	const [activeFile, setActiveFile] = useState<FunctionFile | null>(null);
	const [code, setCode] = useState<string | null>(null); // Updated to allow null
	const editorRef = useRef<any>(null);
	const [consoleOutput, setConsoleOutput] = useState<string>("");
	const [saving, setSaving] = useState<boolean>(false);
	const [running, setRunning] = useState<boolean>(false);
	const [runningMode, setRunningMode] = useState<"classic" | "streaming">(
		"streaming",
	);
	const [exitCode, setExitCode] = useState<number | null>(null);
	const [functionURL, setFunctionURL] = useState<string>("Loading url...");
	const [executionTime, setExecutionTime] = useState<number | null>(null);
	const [functionResult, setFunctionResult] = useState<any>(null);
	const [runParams, setRunParams] = useState<string>("");
	const [showRunParams, setShowRunParams] = useState<boolean>(false);
	const timerRef = useRef<NodeJS.Timeout | null>(null);
	const [activeFileLanguage, setActiveFileLanguage] = useState<string>("");
	const consoleOutputRef = useRef<HTMLDivElement>(null!);
	const [autoScroll, setAutoScroll] = useState<boolean>(true);
	const [copyUrlColor, setCopyUrlColor] = useState<string>("text-stone-300");
	const [copyUrltext, setCopyUrlText] = useState<string>(
		"Copy URL to Clipboard",
	);
	const [copyAliasURL, setCopyAliasURL] = useState<string>("Copy Alias URL");
	const [paramInputColor, setParamInputColor] = useState<string>("text-white");
	const [realTimeTaken, setRealTimeTaken] = useState<number | null>(null);
	const [tooks, setTooks] = useState<TimingEntry[]>([]);
	const [showTimingDetails, setShowTimingDetails] = useState<boolean>(false);
	const [logs, setLogs] = useState<TriggerLog[]>([]);
	const [showLogsDetails, setShowLogsDetails] = useState<boolean>(false);
	const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
	const logPollingRef = useRef<NodeJS.Timeout | null>(null);
	const [showTriggersDetails, setShowTriggersDetails] = useState<boolean>(false);
	const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
	const [pipRunning, setPipRunning] = useState<boolean>(false);
	const [showPopup, setShowPopup] = useState<boolean>(false);
	const [popupContent, setPopupContent] = useState<{
		headers: Record<string, string>;
		html: string;
		code: number;
	} | null>(null);
	const [showImagePopup, setShowImagePopup] = useState<boolean>(false);
	const [imagePopupContent, setImagePopupContent] = useState<{
		headers: Record<string, string>;
		code: number;
		src: string;
		contentType: string;
	} | null>(null);
	const [showAllImageHeaders, setShowAllImageHeaders] = useState<boolean>(false);
	const [serveHtmlOnly, setServeHtmlOnly] = useState<boolean>(false);
	const [showDepModal, setShowDepModal] = useState(false);
	const [depModalContent, setDepModalContent] = useState<{
		title: string;
		message: string;
		success: boolean;
	} | null>(null);
	const [showResultModal, setShowResultModal] = useState(false);
	const [resultModalContent, setResultModalContent] = useState<{
		title: string;
		value: any;
		type: string;
	} | null>(null);
	const [showGuestModal, setShowGuestModal] = useState(false);
	const [showLoadDefaultModal, setShowLoadDefaultModal] = useState(false);
	const [showAIModal, setShowAIModal] = useState(false);
	const [showGitModal, setShowGitModal] = useState(false);
	const [stopShowingResult, setStopShowingResult] = useState(false);
	const navigationPromptOpenRef = useRef(false);
	const editorViewStatesRef = useRef<Map<number, any>>(new Map());
	const saveShortcutRef = useRef<() => void>(() => {});
	const resultModalsEnabled = !stopShowingResult;

	const savedActiveFile =
		activeFile ? files.find((file) => file.id === activeFile.id) ?? activeFile : null;
	const hasUnsavedChanges = Boolean(
		activeFile && code !== (savedActiveFile?.content ?? ""),
	);
	const canSaveFile = Boolean(
		activeFile &&
			hasUnsavedChanges &&
			!saving &&
			!running &&
			!functionData?.git_url,
	);
	const cliPullCommand = functionData
		? `shsf remote pull --id ${functionData.id} --into ./${functionData.name
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "") || "my-func"} --force`
		: "";

	useBeforeUnload(
		(event) => {
			if (!hasUnsavedChanges) return;
			event.preventDefault();
			event.returnValue = "";
		},
		{ capture: true },
	);

	const navigationBlocker = useBlocker(hasUnsavedChanges);

	useEffect(() => {
		setActiveFileLanguage(getDefaultLanguage(activeFile?.name || ""));
	}, [activeFile]);

	useEffect(() => {
		if (!editorRef.current || !activeFile) {
			return;
		}

		requestAnimationFrame(() => {
			const savedViewState = editorViewStatesRef.current.get(activeFile.id);
			if (savedViewState) {
				editorRef.current.restoreViewState(savedViewState);
			}
			editorRef.current.focus();
		});
	}, [activeFile]);

	useEffect(() => {
		if (resultModalsEnabled) {
			return;
		}

		setShowResultModal(false);
		setShowPopup(false);
		setShowImagePopup(false);
	}, [resultModalsEnabled]);

	useEffect(() => {
		if (navigationBlocker.state !== "blocked" || navigationPromptOpenRef.current) {
			return;
		}

		navigationPromptOpenRef.current = true;

		void (async () => {
			const shouldLeave = await confirm({
				title: "Unsaved Changes",
				message:
					"You have unsaved changes in this file. Leave this page and discard them?",
				confirmText: "Leave Page",
				cancelText: "Stay Here",
				variant: "delete",
			});

			if (shouldLeave) {
				navigationBlocker.proceed();
			} else {
				navigationBlocker.reset();
			}

			navigationPromptOpenRef.current = false;
		})();
	}, [navigationBlocker, confirm]);

	// Handle console auto-scrolling
	useEffect(() => {
		if (autoScroll && consoleOutputRef.current) {
			consoleOutputRef.current.scrollTop = consoleOutputRef.current.scrollHeight;
		}
	}, [consoleOutput, autoScroll]);

	const handleConsoleScroll = () => {
		if (consoleOutputRef.current) {
			const { scrollTop, scrollHeight, clientHeight } = consoleOutputRef.current;
			// If user scrolls up, disable auto-scrolling
			// If user scrolls to bottom, re-enable auto-scrolling
			const isScrolledToBottom =
				Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
			setAutoScroll(isScrolledToBottom);
		}
	};

	const startTimer = () => {
		let startTime = Date.now();
		setExecutionTime(0);
		timerRef.current = setInterval(() => {
			setExecutionTime((Date.now() - startTime) / 1000);
		}, 1);
	};

	const stopTimer = () => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	};

	const getDefaultLanguage = (filename: string): string => {
		const extensionMapping: { [key: string]: string } = {
			".py": "python",
			".js": "javascript",
			".ts": "typescript",
			".json": "json",
			".html": "html",
			".css": "css",
			".md": "markdown",
			".go": "go",
			".mod": "go",
			".rs": "rust",
			".lua": "lua",
		};
		const nameMapping: { [key: string]: string } = {
			Dockerfile: "dockerfile",
			Makefile: "makefile",
		};

		// Check for exact name match first
		if (nameMapping[filename]) {
			return nameMapping[filename];
		}

		// Check for extension match
		const extension = Object.keys(extensionMapping).find((ext) =>
			filename.endsWith(ext),
		);
		return extension ? extensionMapping[extension] : "plaintext";
	};

	const handleFileSelect = async (file: FunctionFile) => {
		if (file.id === activeFile?.id) return;

		if (hasUnsavedChanges) {
			const shouldSwitch = await confirm({
				title: "Unsaved Changes",
				message:
					"You have unsaved changes in this file. Switch files and discard them?",
				confirmText: "Switch File",
				cancelText: "Stay Here",
				variant: "delete",
			});

			if (!shouldSwitch) return;
		}

		if (activeFile && editorRef.current) {
			editorViewStatesRef.current.set(
				activeFile.id,
				editorRef.current.saveViewState(),
			);
		}

		setActiveFile(file);
		setCode(file.content || "");
	};

	const handleDownloadFile = (file: FunctionFile) => {
		const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = file.name;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	};

	const handleEditorChange = (value: string | undefined) => {
		setCode(value || "");
	};

	const handleEditorDidMount = (editor: any, monaco: any) => {
		editorRef.current = editor;
		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
			saveShortcutRef.current();
		});
	};

	const loadData = () => {
		if (id) {
			setLoading(true);
			Promise.all([
				getFunctionById(parseInt(id)),
				getFiles(parseInt(id)),
				getTriggers(parseInt(id)),
			])
				.then(([functionData, filesData, triggersData]) => {
					if (functionData.status === "OK") {
						setFunctionData(functionData.data);

						getNamespace(functionData.data.namespaceId).then((namespaceData) => {
							if (namespaceData.status === "OK") {
								setNamespace(namespaceData.data);
							}
						});
					} else {
						toast.error("Error fetching function: " + functionData.message);
						return;
					}

					if (filesData.status === "OK") {
						setFiles(filesData.data);
						if (functionData.data.allow_http) {
							setFunctionURL(
								`${BASE_URL}/api/exec/${functionData.data.namespaceId}/${functionData.data.executionId}`,
							);
						} else {
							setFunctionURL(`No HTTP Access 🚫`);
						}
						if (filesData.data.length > 0) {
							// Select the startup file if it exists, otherwise select the first file
							const startupFile = filesData.data.find(
								(file) => file.name === functionData.data.startup_file,
							);
							const initialFile = startupFile || filesData.data[0];
							// setActiveFile(initialFile);
							setCode(initialFile.content || "");

							// Check if the only file ends in .html to set ServeHtmlOnly
							if (filesData.data.length === 1 && initialFile.name.endsWith(".html")) {
								setServeHtmlOnly(true);
							}
						} else {
							// Reset when no files exist
							setActiveFile(null);
							setCode(null);
						}
					} else {
						toast.error("Error fetching files: " + filesData.message);
					}

					if (triggersData.status === "OK") {
						setTriggers(triggersData.data);
						setShowTriggersDetails(triggersData.data.length > 0);
					} else {
						console.error("Error fetching triggers:", triggersData.message);
					}
				})
				.catch((error) => {
					console.error("Error fetching data:", error);
					toast.error("An error occurred while fetching data.");
				})
				.finally(() => {
					setLoading(false);
				});
		}
	};

	const handleSaveFile = async () => {
		if (!id || !activeFile) return;

		setSaving(true);
		try {
			const data = await createOrUpdateFile(parseInt(id), {
				filename: activeFile.name,
				code: code || "",
			});

			if (data.status === "OK") {
				setFiles((prev) =>
					prev.map((file) =>
						file.id === activeFile.id ? { ...file, content: code || "" } : file,
					),
				);
			} else {
				toast.error("Error saving file: " + data.message);
			}
		} catch (error) {
			console.error("Error saving file:", error);
			toast.error("An error occurred while saving the file.");
		} finally {
			setSaving(false);
		}
	};

	saveShortcutRef.current = () => {
		if (canSaveFile) {
			void handleSaveFile();
		}
	};

	const handleRunCode = async () => {
		if (!id) return;

		setRunning(true);
		setConsoleOutput("Executing code...");
		setExitCode(null);
		setFunctionResult(null);
		setTooks([]);
		startTimer();

		// Parse run params if provided
		let parsedRunParams = null;
		if (showRunParams && runParams.trim()) {
			try {
				parsedRunParams = JSON.parse(runParams);
			} catch (error) {
				setConsoleOutput("Error parsing run parameters: Invalid JSON");
				setRunning(false);
				stopTimer();
				return;
			}
		}

		const checkPopup = (result: any) => {
			if (!resultModalsEnabled) {
				return false;
			}

			const normalizeMaybeJson = (value: any): any => {
				if (typeof value !== "string") return value;
				const trimmed = value.trim();
				if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
					try {
						return JSON.parse(trimmed);
					} catch {
						return value;
					}
				}
				return value;
			};

			const getHeader = (headers: Record<string, string>, name: string) => {
				const target = name.toLowerCase();
				for (const [key, value] of Object.entries(headers || {})) {
					if (key.toLowerCase() === target) return value;
				}
				return "";
			};

			if (
				result &&
				typeof result === "object" &&
				result._shsf === "v2" &&
				typeof result._headers === "object"
			) {
				const headers = result._headers as Record<string, string>;
				const contentType = getHeader(headers, "content-type");
				const normalizedRes = normalizeMaybeJson(result._res);

				if (
					contentType.toLowerCase().startsWith("image/") &&
					normalizedRes &&
					typeof normalizedRes === "object" &&
					normalizedRes.__shsf_transport === "base64-bytes-v1" &&
					typeof normalizedRes.data === "string"
				) {
					setShowAllImageHeaders(false);
					setImagePopupContent({
						headers,
						code: result._code ?? 200,
						src: `data:${contentType};base64,${normalizedRes.data}`,
						contentType,
					});
					setShowImagePopup(true);
					return true;
				}
			}

			if (
				result &&
				typeof result === "object" &&
				result._shsf === "v2" &&
				typeof result._res === "string" &&
				typeof result._headers === "object"
			) {
				setPopupContent({
					headers: result._headers,
					html: result._res,
					code: result._code ?? 200,
				});
				setShowPopup(true);
				return true;
			}
			return false;
		};

		const showResultIfNotPopup = (result: any) => {
			if (resultModalsEnabled && !checkPopup(result)) {
				setResultModalContent({
					title: "Function Result",
					value: result,
					type: typeof result,
				});
				setShowResultModal(true);
			}
		};

		if (runningMode === "classic") {
			try {
				const result = await executeFunction(
					parseInt(id),
					parsedRunParams ? { run: parsedRunParams } : undefined,
				);
				if (result.status === "OK") {
					// Check for popup result
					if (checkPopup(result.data.result)) {
						setConsoleOutput("Popup rendered.");
						setExitCode(result.data.exitCode);
						stopTimer();
						setRunning(false);
						return;
					}
					setConsoleOutput(
						result.data.output || "Execution completed with no output.",
					);
					setExitCode(result.data.exitCode);
					// Handle both old took and new tooks data
					if (result.data.took) {
						setTooks(result.data.took);
						// Find the total execution time entry
						const totalExecution = result.data.took.find(
							(entry: TimingEntry) => entry.description === "Total execution time",
						);
						if (totalExecution) {
							setRealTimeTaken(totalExecution.value);
						}
					}

					// Display result if available
					if (result.data.result !== undefined) {
						setFunctionResult(result.data.result);
						showResultIfNotPopup(result.data.result);
					}
				} else {
					setConsoleOutput(
						`Error: ${result.message}\nDetails: ${
							result.error || "No additional details."
						}`,
					);
				}
			} catch (error) {
				console.error("Error executing code:", error);
				setConsoleOutput("An error occurred while executing the code.");
			} finally {
				stopTimer();
				setRunning(false);
			}
		} else {
			// Streaming mode
			try {
				setConsoleOutput(""); // Clear previous logs
				let popupTriggered = false;
				await executeFunctionStreaming(
					parseInt(id),
					(data) => {
						if (data.type === "output" && data.content) {
							// Check for popup result
							if (!popupTriggered && checkPopup(data.content)) {
								popupTriggered = true;
								setExitCode(data.exitCode ?? null);
								stopTimer();
								setRunning(false);
								return;
							}
							const content =
								typeof data.content === "string"
									? data.content
									: JSON.stringify(data.content);
							setConsoleOutput((prev) => prev + content);
						} else if (data.type === "end") {
							setExitCode(data.exitCode);
							if (data.took) {
								setTooks(data.took);
								// Find the total execution time entry
								const totalExecution = data.took.find(
									(entry: TimingEntry) => entry.description === "Total execution time",
								);
								if (totalExecution) {
									setRealTimeTaken(totalExecution.value);
								}
							}
							if (data.result !== undefined) {
								// Check for popup result
								if (checkPopup(data.result)) {
									stopTimer();
									setRunning(false);
									return;
								}
								setFunctionResult(data.result);
								showResultIfNotPopup(data.result);
							}
						} else if (data.type === "error") {
							setConsoleOutput(
								(prev) => prev + `\nError: ${data.error || "No additional details."}`,
							);
						}
					},
					parsedRunParams ? { run: parsedRunParams } : undefined,
				);
			} catch (error) {
				console.error("Error streaming execution:", error);
				setConsoleOutput(
					(prev) => prev + "\nConnection error: Failed to stream output.",
				);
			} finally {
				stopTimer();
				setRunning(false);
			}
		}
	};

	const handlePipInstall = async () => {
		if (!id) return;

		setPipRunning(true);
		try {
			const response = await installDependencies(parseInt(id));
			if (
				response &&
				typeof response === "object" &&
				"status" in response &&
				response.status === "OK"
			) {
				setDepModalContent({
					title: "Dependencies Installed",
					message: "Dependencies installed successfully.",
					success: true,
				});
				setShowDepModal(true);
			} else {
				setDepModalContent({
					title: "Install Error",
					message: "Error installing dependencies: " + String(response),
					success: false,
				});
				setShowDepModal(true);
			}
		} catch (error) {
			console.error("Error installing dependencies:", error);
			setDepModalContent({
				title: "Install Error",
				message: "An error occurred while installing dependencies.",
				success: false,
			});
			setShowDepModal(true);
		} finally {
			fetchLogs();
			setPipRunning(false);
		}
	};

	useEffect(() => {
		loadData();
	}, [id]);

	const handleCreateFile = async (
		filename: string,
		content: string,
	): Promise<boolean> => {
		if (!id) {
			toast.error("Function ID is missing.");
			return false;
		}

		try {
			const data = await createOrUpdateFile(parseInt(id), {
				filename,
				code: content,
			});
			if (data.status === "OK") {
				setFiles((prev) => [...prev, { ...data.data, content }]); // Ensure the new file has the correct content
				return true;
			} else {
				toast.error("Error creating file: " + data.message);
				return false;
			}
		} catch (error) {
			console.error("Error creating file:", error);
			toast.error("An error occurred while creating the file.");
			return false;
		}
	};

	const handleRenameFile = async (newFilename: string): Promise<boolean> => {
		if (!id || !selectedFile) return false;

		try {
			const data = await renameFile(parseInt(id), selectedFile.id, newFilename);
			if (data.status === "OK") {
				setFiles((prev) =>
					prev.map((file) =>
						file.id === selectedFile.id ? { ...file, name: newFilename } : file,
					),
				);
				return true;
			} else {
				toast.error("Error renaming file: " + data.message);
				return false;
			}
		} catch (error) {
			console.error("Error renaming file:", error);
			toast.error("An error occurred while renaming the file.");
			return false;
		}
	};

	const handleDeleteFile = async (): Promise<boolean> => {
		if (!id || !selectedFile) return false;

		try {
			const data = await deleteFile(parseInt(id), selectedFile.id);
			if (data.status === "OK") {
				setFiles((prev) => prev.filter((file) => file.id !== selectedFile.id));
				if (activeFile?.id === selectedFile.id) {
					editorViewStatesRef.current.delete(selectedFile.id);
					setActiveFile(null);
					setCode(null);
				}
				return true;
			} else {
				toast.error("Error deleting file: " + data.message);
				return false;
			}
		} catch (error) {
			console.error("Error deleting file:", error);
			toast.error("An error occurred while deleting the file.");
			return false;
		}
	};

	const handleCreateTrigger = async (
		functionId: number,
		name: string,
		description: string,
		cron: string,
		data: string,
		enabled: boolean,
	) => {
		try {
			const response = await createTrigger(functionId, {
				name,
				description,
				cron,
				data,
				enabled,
			});

			if (response.status === "OK") {
				// Reload triggers
				if (id) {
					const triggersData = await getTriggers(parseInt(id));
					if (triggersData.status === "OK") {
						setTriggers(triggersData.data);
					}
				}
				return true;
			} else {
				toast.error("Error creating trigger: " + (response as any).message);
				return false;
			}
		} catch (error) {
			console.error("Error creating trigger:", error);
			toast.error("An error occurred while creating the trigger.");
			return false;
		}
	};

	const handleUpdateTrigger = async (
		name: string,
		description: string,
		cron: string,
		data: string,
		enabled: boolean,
	) => {
		if (!id || !selectedTrigger) return false;

		try {
			const response = await updateTrigger(parseInt(id), selectedTrigger.id, {
				name,
				description,
				cron,
				data,
				enabled,
			});

			if (response.status === "OK") {
				// Update triggers list
				setTriggers((prev) =>
					prev.map((trigger) =>
						trigger.id === selectedTrigger.id ? response.data : trigger,
					),
				);
				return true;
			} else {
				toast.error("Error updating trigger: " + (response as any).message);
				return false;
			}
		} catch (error) {
			console.error("Error updating trigger:", error);
			toast.error("An error occurred while updating the trigger.");
			return false;
		}
	};

	const handleDeleteTrigger = async () => {
		if (!id || !selectedTrigger) return false;

		try {
			const response = await deleteTrigger(parseInt(id), selectedTrigger.id);

			if (response.status === "OK") {
				// Remove trigger from list
				setTriggers((prev) =>
					prev.filter((trigger) => trigger.id !== selectedTrigger.id),
				);
				return true;
			} else {
				toast.error("Error deleting trigger: " + response.message);
				return false;
			}
		} catch (error) {
			console.error("Error deleting trigger:", error);
			toast.error("An error occurred while deleting the trigger.");
			return false;
		}
	};

	const handleRunTrigger = async (trigger: Trigger | null) => {
		if (!id || !trigger) return false;

		try {
			const response = await runTrigger(parseInt(id), trigger.id);
			if ((response as any).status === "OK") {
				toast.success("Trigger executed");
				await fetchLogs();
				return true;
			} else {
				toast.error("Error running trigger: " + (response as any).message);
				return false;
			}
		} catch (error) {
			console.error("Error running trigger:", error);
			toast.error("An error occurred while running the trigger.");
			return false;
		}
	};

	const handleUpdateEnvironment = async (
		env: { name: string; value: string }[],
	) => {
		if (!id) return false;

		try {
			const response = await updateFunction(parseInt(id), {
				environment: env,
			});

			if (response.status === "OK") {
				// Update the function data with the new environment variables
				setFunctionData((prev) => {
					if (!prev) return prev;
					return { ...prev, ...response.data };
				});
				return true;
			} else {
				toast.error("Error updating environment variables: " + response.message);
				return false;
			}
		} catch (error) {
			console.error("Error updating environment variables:", error);
			toast.error("An error occurred while updating environment variables.");
			return false;
		}
	};

	// Function to fetch logs
	const fetchLogs = async () => {
		if (!id) return;

		setIsLoadingLogs(true);
		try {
			const logsData = await getLogsByFuncId(parseInt(id));
			if (logsData.status === "OK") {
				setLogs(logsData.data);
			} else {
				console.error("Error fetching logs:", logsData.message);
			}
		} catch (error) {
			console.error("Error fetching logs:", error);
		} finally {
			setIsLoadingLogs(false);
		}
	};

	// Set up polling for logs
	useEffect(() => {
		if (id && !showLogsModal) {
			fetchLogs(); // Fetch immediately on component mount

			// Set up interval to fetch logs
			logPollingRef.current = setInterval(fetchLogs, 10000); // Poll every 10 seconds

			// Clean up interval on unmount
			return () => {
				if (logPollingRef.current) {
					clearInterval(logPollingRef.current);
				}
			};
		}
	}, [id, showLogsModal]);

	// Also fetch logs after running code
	useEffect(() => {
		if (!running && exitCode !== null && !showLogsModal) {
			// Function execution just finished, refresh logs
			fetchLogs();
		}
	}, [running, exitCode, showLogsModal]);

	const handleExportFunction = async () => {
		if (!functionData) return;

		// Parse env to get only the keys (strip values for security)
		let envKeys: string[] = [];
		try {
			const envRaw =
				typeof functionData.env === "string"
					? JSON.parse(functionData.env)
					: functionData.env;
			if (Array.isArray(envRaw)) {
				envKeys = envRaw
					.map((e: any) => e?.name)
					.filter(Boolean);
			}
		} catch {
			// ignore parse errors
		}

		let version = "";
		try {
			const res = await fetch(BASE_URL + "/version");
			if (!res.ok) {
				throw new Error("Failed to fetch version");
			}
			const data = await res.json();
			version = data.version!.raw;
		} catch (err) {
			console.error("Error fetching version:", err);
		}

		const exportData: SHSFExport = {
			shsf_version: version,
			name: functionData.name,
			description: functionData.description,
			image: functionData.image,
			startup_file: functionData.startup_file!,
			docker_mount: functionData.docker_mount,
			ffmpeg_install: functionData.ffmpeg_install,
			settings: {
				max_ram: functionData.max_ram,
				timeout: functionData.timeout,
				allow_http: functionData.allow_http,
			},
			cors_origins: functionData.cors_origins ?? undefined,
			...(envKeys.length > 0 && { env_keys: envKeys }),
			files: files.map((f) => ({ name: f.name, content: f.content })),
			triggers: triggers.map((t) => ({
				name: t.name,
				description: t.description,
				cron: t.cron,
				data: t.data,
				enabled: t.enabled,
			})),
		};

		const json = JSON.stringify(exportData, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${functionData.name}.shsf`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleLoadDefault = () => {
		if (!activeFile) {
			toast.error("No file is currently selected.");
			return;
		}
		setShowLoadDefaultModal(true);
	};

	const handleLoadDefaultContent = async (
		defaultToLoad: string,
	): Promise<boolean> => {
		if (!id || !activeFile) return false;

		setSaving(true);
		try {
			const response = await loadDefaultContent(
				parseInt(id),
				activeFile.id,
				defaultToLoad,
			);

			if (response.status === "OK") {
				// Update the file content in state
				const updatedContent = response.data.content;
				setCode(updatedContent);
				setFiles((prev) =>
					prev.map((file) =>
						file.id === activeFile.id ? { ...file, content: updatedContent } : file,
					),
				);
				return true;
			} else {
				toast.error("Error loading default: " + response.message);
				return false;
			}
		} catch (error) {
			console.error("Error loading default content:", error);
			toast.error("An error occurred while loading the default template.");
			return false;
		} finally {
			setSaving(false);
		}
	};

	const [loadedInitial, setLoadedInitial] = useState(false);

	// Load first file or priority file
	const loadInitialFile = () => {
		if (!functionData) return;
		if (activeFile) return;
		if (loadedInitial) return;

		if (files.length > 0) {
			// Select the startup file if it exists, otherwise select the first file
			const startupFile = files.find(
				(file) => file.name === functionData.startup_file,
			);
			const initialFile = startupFile || files[0];
			setActiveFile(initialFile);
			setCode(initialFile.content || "");
		} else {
			// Reset when no files exist
			setActiveFile(null);
			setCode(null);
		}
		setLoadedInitial(true);
	};
	useEffect(() => {
		loadInitialFile();
	}, [functionData, files, activeFile]);

	// Handle "preopen" query param to open a specific menu on load
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const preopen = params.get("preopen");
		if (preopen === "guests") {
			setShowGuestModal(true);
		} else {
			console.warn("Unknown preopen value:", preopen);
		}

		// Clean up query params from URL after handling
		return () => {
			params.delete("preopen");
			const newUrl = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
			window.history.replaceState({}, "", newUrl);
		};
	}, []);

	if (loading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center space-y-4">
					<div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
					<p className="text-text/70 text-lg">Loading function...</p>
				</div>
			</div>
		);
	}

	if (!functionData) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center space-y-4">
					<div className="text-6xl">❌</div>
					<h2 className="text-2xl font-bold text-primary">Function Not Found</h2>
					<p className="text-text/70">The requested function could not be loaded.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background w-full">
			{/* Dependency Install Modal */}
			<DependencyModal
				isOpen={showDepModal}
				onClose={() => setShowDepModal(false)}
				content={depModalContent || { success: false, title: "", message: "" }}
			/>

			{/* Result Modal */}
			<ResultModal
				isOpen={showResultModal}
				onClose={() => setShowResultModal(false)}
				content={resultModalContent || { title: "", value: "", type: "" }}
				cacheEnabled={functionData?.cache_enabled}
			/>

			{/* Popup Modal for HTML result */}
			<HtmlResultModal
				isOpen={showPopup}
				onClose={() => setShowPopup(false)}
				content={popupContent || { code: 0, headers: {}, html: "" }}
			/>

			{/* Popup Modal for Image result */}
			<ImageResultModal
				isOpen={showImagePopup}
				onClose={() => setShowImagePopup(false)}
				content={imagePopupContent || { code: 0, contentType: "", headers: {}, src: "" }}
			/>

			{/* Hero Header Section - Full Width */}
			<div className="relative bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-b border-primary/20 w-full">
				<div className="w-full py-6 px-0">
					<div className="flex items-center justify-between w-full px-8">
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2 text-2xl font-bold text-primary">
								<span>📂</span>
								<span className="bg-gray-900/50 py-1 px-3 rounded-lg border border-primary/20">
									{nameSpace?.name}
								</span>
								<span className="text-text/40">/</span>
								<span>🚀</span>
								<span className="bg-gray-900/50 py-1 px-3 rounded-lg border border-primary/20">
									{functionData.name}
								</span>
							</div>
						</div>

						<div className="flex items-center gap-6 text-text/60 text-sm">
							<div className="flex items-center gap-2">
								<div className="w-2 h-2 bg-blue-500 rounded-full"></div>
								<span>
									{files.length} {files.length === 1 ? "File" : "Files"}
								</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-2 h-2 bg-green-500 rounded-full"></div>
								<span>{triggers.length} Triggers</span>
							</div>
							<div className="flex items-center gap-2">
								<div
									className={`w-2 h-2 rounded-full ${
										functionData.allow_http ? "bg-green-500" : "bg-gray-500"
									}`}
								></div>
								<span>{functionData.allow_http ? "HTTP" : "No HTTP"}</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="w-full py-6 px-0">
				<div className="flex gap-6 w-full px-8">
					{/* Sidebar */}
					<div className="w-72 shrink-0 space-y-4">
						{/* Quick Actions */}
						<div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-lg p-4">
							<h2 className="text-lg font-bold text-primary mb-3 flex items-center gap-2">
								<span>⚡</span>
								Actions
							</h2>
							<div className="grid grid-cols-2 gap-2">
								<ActionButton
									icon="⚙️"
									label="Settings"
									variant="secondary"
									onClick={() => setShowUpdateModal(true)}
								/>
								<ActionButton
									disabled={serveHtmlOnly}
									icon="🌍"
									label="Env"
									variant="secondary"
									onClick={() => setShowEnvModal(true)}
								/>
								{/* Add Guest Management Button as ActionButton */}
								<ActionButton
									icon="👥"
									label="Guests"
									variant="secondary"
									onClick={() => setShowGuestModal(true)}
								/>
								<ActionButton
									icon="🔀"
									label="Version Control"
									variant={functionData.git_url ? "primary" : "secondary"}
									onClick={() => setShowGitModal(true)}
								/>
							</div>
						</div>

						{/* Function URL - More Compact */}
						<div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-lg p-4">
							<h2 className="text-lg font-bold text-primary mb-3 flex items-center gap-2">
								<span>🌐</span>
								URL
							</h2>
							<div className="space-y-2">
								<div className="bg-background/30 border border-primary/10 rounded-lg p-2">
									<input
										type="text"
										value={functionURL}
										readOnly
										className="w-full bg-transparent text-text text-xs outline-none"
										onClick={(e) => e.currentTarget.select()}
									/>
								</div>
								<ActionButton
									icon="📋"
									label={copyUrltext}
									variant="primary"
									onClick={() => {
										navigator.clipboard.writeText(functionURL);
										setCopyUrlColor("text-green-400");
										setCopyUrlText("✅ Copied!");
										setTimeout(() => {
											setCopyUrlColor("text-stone-300");
											setCopyUrlText("Copy📎");
										}, 2000);
									}}
								/>
							</div>
							{functionData.executionAlias && functionData.allow_http && (
								<div className="space-y-2">
									<h2 className="text-sm font-medium text-primary mt-4">Alias URL</h2>
									<div className="bg-background/30 border border-primary/10 rounded-lg p-2">
										<input
											type="text"
											value={
												functionURL.split("/api/")[0] +
												"/exec/" +
												functionData.executionAlias
											}
											readOnly
											className="w-full bg-transparent text-text text-xs outline-none"
											onClick={(e) => e.currentTarget.select()}
										/>
									</div>
									<ActionButton
										icon="📋"
										label={copyAliasURL}
										variant="primary"
										onClick={() => {
											navigator.clipboard.writeText(
												functionURL.split("/api/")[0] +
													"/exec/" +
													functionData.executionAlias,
											);
											setCopyAliasURL("✅ Copied Alias!");
											setTimeout(() => {
												setCopyAliasURL("Copy Alias📎");
											}, 2000);
										}}
									/>
								</div>
							)}
						</div>

						<FileManagerCard
							files={files}
							activeFile={activeFile}
							onFileSelect={handleFileSelect}
							onCreateFile={() => setShowCreateModal(true)}
							onDownloadFile={handleDownloadFile}
							onRenameFile={(file) => {
								setSelectedFile(file);
								setShowRenameModal(true);
							}}
							onDeleteFile={(file) => {
								setSelectedFile(file);
								setShowDeleteModal(true);
							}}
							onAIGenerate={() => setShowAIModal(true)}
							disabled={Boolean(functionData.git_url)}
							disabledReason="Git source active — file manager disabled. Use Version Control to manage files."
						/>

						<TriggersCard
							triggers={triggers}
							disabled={serveHtmlOnly}
							disabledReason="This function is set to only serve an .html file"
							showDetails={showTriggersDetails}
							onToggleDetails={() => setShowTriggersDetails(!showTriggersDetails)}
							onCreateTrigger={() => setShowCreateTriggerModal(true)}
							onEditTrigger={(trigger) => {
								setSelectedTrigger(trigger);
								setShowEditTriggerModal(true);
							}}
							onDeleteTrigger={(trigger) => {
								setSelectedTrigger(trigger);
								setShowDeleteTriggerModal(true);
							}}
							onRunTrigger={(trigger) => {
								handleRunTrigger(trigger);
							}}
						/>

						<TimingCard
							tooks={tooks}
							showDetails={showTimingDetails}
							onToggleDetails={() => setShowTimingDetails(!showTimingDetails)}
							disabled={serveHtmlOnly}
							disabledReason="This function is set to only serve an .html file"
						/>

						<LogsCard
							logs={logs}
							isLoadingLogs={isLoadingLogs}
							showDetails={showLogsDetails}
							onToggleDetails={() => setShowLogsDetails(!showLogsDetails)}
							onRefreshLogs={fetchLogs}
							onViewLogs={() => setShowLogsModal(true)}
							functionId={functionData?.id ?? 0}
							disabled={serveHtmlOnly}
							disabledReason="This function is set to only serve an .html file"
						/>

						<RateLimitCard
							functionId={functionData?.id ?? 0}
							disabled={serveHtmlOnly}
							disabledReason="This function is set to only serve an .html file"
						/>
					</div>

					{/* Main Content - Use Full Remaining Space */}
					<div className="flex-1 min-w-0 space-y-4">
						{/* Editor Header - More Compact */}
						<div className="bg-gradient-to-br from-gray-900/55 to-gray-800/45 border border-primary/20 rounded-lg p-4 space-y-4">
							<div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
								<div className="min-w-0 flex items-start gap-3">
									<div className="w-9 h-9 bg-gradient-to-br from-blue-500/15 to-cyan-500/10 border border-blue-400/20 rounded-xl flex items-center justify-center text-base flex-shrink-0">
										📝
									</div>
									<div className="min-w-0 space-y-1">
										<div className="flex flex-wrap items-center gap-2">
											<h2 className="text-lg font-semibold text-primary truncate">
												{activeFile ? activeFile.name : "No file selected"}
											</h2>
											{activeFile && (
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
											{activeFile
												? `${activeFileLanguage || "plaintext"} file`
												: "Select a file from the sidebar to start editing"}
										</p>
									</div>
								</div>

								<div className="flex flex-wrap items-center gap-2 xl:justify-end">
									<select
										className={`h-9 min-w-[110px] bg-background/45 border border-primary/20 text-primary px-3 text-sm rounded-lg transition-all duration-300 hover:border-primary/40 ${
											running || saving || serveHtmlOnly
												? "opacity-30 cursor-not-allowed bg-slate-800 text-gray-400"
												: ""
										}`}
										value={runningMode}
										onChange={(e) =>
											setRunningMode(e.target.value as "classic" | "streaming")
										}
										disabled={running || saving || serveHtmlOnly}
									>
										<option value="streaming">Stream</option>
										<option value="classic">Classic</option>
									</select>
									<button
										className={[
											"h-9 px-3 text-sm rounded-lg transition-all duration-300 border",
											showRunParams
												? "bg-gradient-to-r from-blue-600 to-cyan-600 border-transparent text-white"
												: "bg-background/45 border-primary/20 text-primary hover:border-primary/40",
											running || saving || serveHtmlOnly
												? "opacity-30 cursor-not-allowed bg-slate-800 text-gray-400 border-primary/20"
												: "",
										].join(" ")}
										style={{
											cursor: serveHtmlOnly ? "not-allowed" : "pointer",
										}}
										onClick={() => setShowRunParams(!showRunParams)}
										disabled={running || saving || serveHtmlOnly}
									>
										Run Params
									</button>
									<button
										className={`h-9 px-3 text-sm rounded-lg transition-all duration-300 border ${
											resultModalsEnabled
												? "bg-emerald-500/10 border-emerald-400/30 text-emerald-300 hover:border-emerald-300/40"
												: "bg-red-500/10 border-red-400/30 text-red-300 hover:border-red-300/40"
										}`}
										onClick={() => setStopShowingResult(!stopShowingResult)}
										title={
											resultModalsEnabled
												? "Result modals are enabled"
												: "Result modals are disabled"
										}
									>
										{resultModalsEnabled ? "Modals On" : "Modals Off"}
									</button>
								</div>
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
									className="h-9 min-w-0 flex-1 rounded-lg border border-primary/10 bg-background/35 px-3 text-xs text-text/70 outline-none disabled:cursor-text disabled:opacity-100"
									onClick={(e) => e.currentTarget.select()}
								/>
								<button
									className="h-9 shrink-0 rounded-lg border border-primary/20 bg-background/45 px-3 text-sm text-primary transition-all duration-300 hover:border-primary/40"
									onClick={() => {
										navigator.clipboard.writeText(cliPullCommand);
										toast.success("CLI command copied");
									}}
								>
									Copy
								</button>
							</div>

							<div className="flex flex-wrap items-center justify-end gap-2 border-t border-primary/10 pt-4">
								{/* Show Pip Install button if requirements.txt exists or if it's a git-based function (since we don't know the files) */}
								{(files.find((file) => file.name === "requirements.txt") || Boolean(functionData.git_url)) && (
									<button
										className="h-9 px-3 text-sm rounded-lg bg-blue-600/90 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
										onClick={handlePipInstall}
										disabled={pipRunning || running || saving}
									>
										{pipRunning ? "Installing..." : "Install requirements.txt"}
									</button>
								)}
								<button
									className="h-9 px-3 text-sm rounded-lg bg-background/45 border border-primary/20 text-primary hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
									onClick={handleLoadDefault}
									disabled={!activeFile || saving || running || Boolean(functionData.git_url)}
								>
									{saving ? "Loading..." : "Load Defaults"}
								</button>
								<button
									className="h-9 px-3 text-sm rounded-lg bg-background/45 border border-primary/20 text-primary hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
									onClick={handleSaveFile}
									disabled={!canSaveFile}
									title={
										hasUnsavedChanges
											? "Save file (Ctrl/Cmd+S)"
											: "No unsaved changes"
									}
									>
										{saving ? "Saving..." : "Save"}
									</button>
								<button
									className="h-9 px-3 text-sm rounded-lg bg-background/45 border border-primary/20 text-primary hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
									onClick={() => {
										handleExportFunction();
									}}
								>
									Export
								</button>
								<button
									className="h-9 px-3 text-sm rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
									onClick={handleRunCode}
									disabled={running || saving}
								>
									{running ? "Running..." : "Run Function"}
								</button>
							</div>

							{/* Run Parameters */}
							{showRunParams && (
								<div className="mt-3">
									<textarea
										className={`w-full h-20 bg-background/30 border border-primary/20 rounded-lg p-2 text-sm ${paramInputColor} placeholder-text/50 resize-none`}
										placeholder="Enter JSON run parameters..."
										value={runParams}
										onChange={(e) => {
											setRunParams(e.target.value);
											try {
												JSON.parse(e.target.value);
												setParamInputColor("text-text");
											} catch {
												setParamInputColor("text-red-400");
											}
										}}
										spellCheck={false}
									/>
								</div>
							)}
						</div>

						{/* Code Editor - Larger */}
						<div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-lg overflow-hidden">
							<div className="h-[600px] relative">
								{functionData.git_url ? (
									<div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm text-center z-10">
										<div className="space-y-4 px-6">
											<div className="text-5xl">🔀</div>
											<h3 className="text-lg font-bold text-primary">
												Editor Disabled
											</h3>
											<p className="text-text/70 text-sm max-w-xs">
												This function uses a git repository as its source. Manage
												files through version control.
											</p>
											<button
												onClick={() => setShowGitModal(true)}
												className="mt-1 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-[0_0_20px_rgba(124,131,253,0.35)] transition-all duration-300"
											>
												Open Version Control
											</button>
										</div>
									</div>
								) : !activeFile ? (
									<div className="absolute inset-0 flex items-center justify-center bg-background/50 text-center">
										<div className="space-y-3">
											<div className="text-5xl">📝</div>
											<h3 className="text-lg font-bold text-primary">No File Selected</h3>
											<p className="text-text/70 text-sm">
												Select a file from the sidebar
											</p>
										</div>
									</div>
								) : null}
								{activeFile && (
									<Editor
										theme="vs-dark"
										height="100%"
										language={activeFileLanguage}
										value={code || ""}
										onChange={handleEditorChange}
										onMount={handleEditorDidMount}
										options={{
											readOnly: Boolean(functionData.git_url),
											minimap: { enabled: true },
											scrollBeyondLastLine: false,
											fontSize: 13,
											tabSize: 4,
											"semanticHighlighting.enabled": true,
											codeLens: true,
											automaticLayout: true,
											smoothScrolling: true,
											overviewRulerBorder: false,
										}}
									/>
								)}
							</div>
						</div>

						{/* Console Output - More Compact */}
						<ConsoleCard
							consoleOutput={consoleOutput}
							exitCode={exitCode}
							executionTime={executionTime}
							realTimeTaken={realTimeTaken}
							functionResult={functionResult}
							functionData={functionData}
							autoScroll={autoScroll}
							consoleOutputRef={consoleOutputRef}
							onConsoleScroll={handleConsoleScroll}
							onResumeAutoScroll={() => {
								setAutoScroll(true);
								if (consoleOutputRef.current) {
									consoleOutputRef.current.scrollTop =
										consoleOutputRef.current.scrollHeight;
								}
							}}
							disabled={serveHtmlOnly}
							disabledReason="This function is set to only serve an .html file"
						/>
					</div>
				</div>
			</div>

			{/* Modals */}
			<div>
				<CreateFileModal
					isOpen={showCreateModal}
					onClose={() => setShowCreateModal(false)}
					onCreate={handleCreateFile}
					allowedFileTypes={serveHtmlOnly ? [".html"] : undefined}
				/>

				<RenameFileModal
					isOpen={showRenameModal}
					onClose={() => setShowRenameModal(false)}
					onRename={handleRenameFile}
					currentFilename={selectedFile?.name || ""}
				/>

				<DeleteFileModal
					isOpen={showDeleteModal}
					onClose={() => setShowDeleteModal(false)}
					onDelete={handleDeleteFile}
					filename={selectedFile?.name || ""}
				/>

				<UpdateFunctionModal
					isOpen={showUpdateModal}
					onClose={() => setShowUpdateModal(false)}
					onSuccess={loadData}
					functionData={functionData}
					lastLogs={logs} // Pass last 5 logs for context in the update modal
				/>

				<UpdateEnvModal
					isOpen={showEnvModal}
					onClose={() => setShowEnvModal(false)}
					onUpdate={handleUpdateEnvironment}
					envString={
						typeof functionData.env === "string"
							? functionData.env
							: JSON.stringify(functionData.env ?? [])
					}
				/>

				<CreateTriggerModal
					isOpen={showCreateTriggerModal}
					onClose={() => setShowCreateTriggerModal(false)}
					onCreate={handleCreateTrigger}
					initialFunctionId={id ? parseInt(id) : undefined}
				/>

				<EditTriggerModal
					isOpen={showEditTriggerModal}
					onClose={() => setShowEditTriggerModal(false)}
					onUpdate={handleUpdateTrigger}
					onRun={() => handleRunTrigger(selectedTrigger)}
					trigger={selectedTrigger}
				/>

				<DeleteTriggerModal
					isOpen={showDeleteTriggerModal}
					onClose={() => setShowDeleteTriggerModal(false)}
					onDelete={handleDeleteTrigger}
					triggerName={selectedTrigger?.name || ""}
				/>

				<TriggerLogsModal
					isOpen={showLogsModal}
					onClose={() => setShowLogsModal(false)}
					logs={logs}
					isLoading={isLoadingLogs}
					functionId={functionData?.id ?? 0}
					onRefresh={fetchLogs}
				/>

				<GuestManagement
					isOpen={showGuestModal}
					onClose={() => setShowGuestModal(false)}
					functionId={functionData?.id ?? null}
				/>

				<GitVersionControlModal
					isOpen={showGitModal}
					onClose={() => setShowGitModal(false)}
					functionId={functionData?.id ?? null}
					onChanged={loadData}
				/>

				<LoadDefaultModal
					isOpen={showLoadDefaultModal}
					onClose={() => setShowLoadDefaultModal(false)}
					onLoadDefault={handleLoadDefaultContent}
					functionLanguage={functionData?.image}
				/>

				<AIGenerateModal
					isOpen={showAIModal}
					onClose={() => setShowAIModal(false)}
					functionId={functionData?.id ?? 0}
					existingFiles={files}
					onSuccess={() => {
						if (id) {
							getFiles(parseInt(id)).then((filesData) => {
								if (filesData.status === "OK") {
									setFiles(filesData.data);
								}
							});
						}
					}}
				/>

			</div>
		</div>
	);
}

export default FunctionDetail;
