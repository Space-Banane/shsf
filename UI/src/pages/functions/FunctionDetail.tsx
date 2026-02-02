import CLICommandCard from "../../components/cards/CLICommandCard";
import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import CreateFileModal from "../../components/modals/CreateFileModal";
import RenameFileModal from "../../components/modals/RenameFileModal";
import DeleteFileModal from "../../components/modals/DeleteFileModal";
import UpdateFunctionModal from "../../components/modals/UpdateFunctionModal";
import CreateTriggerModal from "../../components/modals/CreateTriggerModal";
import EditTriggerModal from "../../components/modals/EditTriggerModal";
import DeleteTriggerModal from "../../components/modals/DeleteTriggerModal";
import UpdateEnvModal from "../../components/modals/UpdateEnvModal";
import TriggerLogsModal from "../../components/modals/TriggerLogsModal";
import GuestManagement from "../../components/modals/GuestManagement";
import LoadDefaultModal from "../../components/modals/LoadDefaultModal";
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
} from "../../services/backend.triggers";
import { getNamespace } from "../../services/backend.namespaces";
import { BASE_URL } from "../..";
import React from "react";
import { ConsoleCard } from "../../components/cards/ConsoleCard";
import { LogsCard } from "../../components/cards/LogCard";
import { TimingCard } from "../../components/cards/TimingCard";
import { TriggersCard } from "../../components/cards/TriggersCard";
import { FileManagerCard } from "../../components/cards/FileManagerCard";
import { ActionButton } from "../../components/buttons/ActionButton";

// Define the timing entry interface
export interface TimingEntry {
	timestamp: number;
	value: number;
	description: string;
}

function FunctionDetail() {
	const { id } = useParams<{ id: string }>();
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
	const [copyUrltext, setCopyUrlText] = useState<string>("Copy URL to Clipboard");
	const [copyAliasURL, setCopyAliasURL] = useState<string>("Copy Alias URL");
	const [paramInputColor, setParamInputColor] = useState<string>("text-white");
	const [realTimeTaken, setRealTimeTaken] = useState<number | null>(null);
	const [tooks, setTooks] = useState<TimingEntry[]>([]);
	const [showTimingDetails, setShowTimingDetails] = useState<boolean>(false);
	const [logs, setLogs] = useState<TriggerLog[]>([]);
	const [showLogsDetails, setShowLogsDetails] = useState<boolean>(false);
	const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
	const logPollingRef = useRef<NodeJS.Timeout | null>(null);
	const [showTriggersDetails, setShowTriggersDetails] = useState<boolean>(true);
	const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
	const [pipRunning, setPipRunning] = useState<boolean>(false);
	const [showPopup, setShowPopup] = useState<boolean>(false);
	const [popupContent, setPopupContent] = useState<{
		headers: Record<string, string>;
		html: string;
		code: number;
	} | null>(null);
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

	useEffect(() => {
		setActiveFileLanguage(getDefaultLanguage(activeFile?.name || ""));
	}, [activeFile]);

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

	const handleFileSelect = (file: FunctionFile) => {
		setActiveFile(file);
		setCode(file.content || "");
	};

	const handleEditorChange = (value: string | undefined) => {
		setCode(value || "");
	};

	const handleEditorDidMount = (editor: any) => {
		editorRef.current = editor;
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
						alert("Error fetching function: " + functionData.message);
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
						alert("Error fetching files: " + filesData.message);
					}

					if (triggersData.status === "OK") {
						setTriggers(triggersData.data);
					} else {
						console.error("Error fetching triggers:", triggersData.message);
					}
				})
				.catch((error) => {
					console.error("Error fetching data:", error);
					alert("An error occurred while fetching data.");
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
				alert("Error saving file: " + data.message);
			}
		} catch (error) {
			console.error("Error saving file:", error);
			alert("An error occurred while saving the file.");
		} finally {
			setSaving(false);
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
			if (!checkPopup(result)) {
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
			alert("Function ID is missing.");
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
				alert("Error creating file: " + data.message);
				return false;
			}
		} catch (error) {
			console.error("Error creating file:", error);
			alert("An error occurred while creating the file.");
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
				alert("Error renaming file: " + data.message);
				return false;
			}
		} catch (error) {
			console.error("Error renaming file:", error);
			alert("An error occurred while renaming the file.");
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
					setActiveFile(null);
					setCode(null);
				}
				return true;
			} else {
				alert("Error deleting file: " + data.message);
				return false;
			}
		} catch (error) {
			console.error("Error deleting file:", error);
			alert("An error occurred while deleting the file.");
			return false;
		}
	};

	const handleCreateTrigger = async (
		name: string,
		description: string,
		cron: string,
		data: string,
		enabled: boolean,
	) => {
		if (!id) return false;

		try {
			const response = await createTrigger(parseInt(id), {
				name,
				description,
				cron,
				data,
				enabled,
			});

			if (response.status === "OK") {
				// Reload triggers
				const triggersData = await getTriggers(parseInt(id));
				if (triggersData.status === "OK") {
					setTriggers(triggersData.data);
				}
				return true;
			} else {
				alert("Error creating trigger: " + (response as any).message);
				return false;
			}
		} catch (error) {
			console.error("Error creating trigger:", error);
			alert("An error occurred while creating the trigger.");
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
				alert("Error updating trigger: " + (response as any).message);
				return false;
			}
		} catch (error) {
			console.error("Error updating trigger:", error);
			alert("An error occurred while updating the trigger.");
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
				alert("Error deleting trigger: " + response.message);
				return false;
			}
		} catch (error) {
			console.error("Error deleting trigger:", error);
			alert("An error occurred while deleting the trigger.");
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
				alert("Error updating environment variables: " + response.message);
				return false;
			}
		} catch (error) {
			console.error("Error updating environment variables:", error);
			alert("An error occurred while updating environment variables.");
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

	const handleLoadDefault = () => {
		if (!activeFile) {
			alert("No file is currently selected.");
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
						file.id === activeFile.id
							? { ...file, content: updatedContent }
							: file,
					),
				);
				return true;
			} else {
				alert("Error loading default: " + response.message);
				return false;
			}
		} catch (error) {
			console.error("Error loading default content:", error);
			alert("An error occurred while loading the default template.");
			return false;
		} finally {
			setSaving(false);
		}
	};

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
			{showDepModal && depModalContent && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="bg-background/50 rounded-xl shadow-2xl border border-primary/30 max-w-sm w-full p-6 animate-fadein">
						<div className="flex flex-col items-center">
							<div
								className={`text-4xl mb-2 ${
									depModalContent.success ? "text-green-500" : "text-red-500"
								}`}
							>
								{depModalContent.success ? "✅" : "❌"}
							</div>
							<h2 className="text-xl font-bold mb-2 text-primary text-center">
								{depModalContent.title}
							</h2>
							<p className="text-center text-text/80 mb-4">
								{depModalContent.message}
							</p>
							<button
								className="mt-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
								onClick={() => setShowDepModal(false)}
							>
								Close
							</button>
						</div>
					</div>
					<style>{`
            .animate-fadein {
              animation: fadein 0.2s cubic-bezier(.4,0,.2,1);
            }
            @keyframes fadein {
              from { opacity: 0; transform: scale(0.98);}
              to { opacity: 1; transform: scale(1);}
            }
          `}</style>
				</div>
			)}

			{/* Result Modal */}
			{showResultModal && resultModalContent && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="bg-background/50 rounded-xl shadow-2xl border border-primary/30 max-w-sm w-full p-6 animate-fadein">
						<div className="flex flex-col items-center">
							<div className="text-4xl mb-2 text-blue-500">📦</div>
							<h2 className="text-xl font-bold mb-2 text-primary text-center">
								{resultModalContent.title}
							</h2>
							<div className="text-center text-text/80 mb-2">
								<span className="font-mono text-xs bg-blue-100 px-2 py-1 rounded text-blue-700 border border-blue-200 shadow">
									Type: {resultModalContent.type}
								</span>
							</div>
							<pre className="w-full bg-background/80 border border-primary/10 rounded-lg p-3 text-xs font-mono text-text/90 shadow-inner text-left overflow-x-auto mb-4">
								{typeof resultModalContent.value === "string"
									? resultModalContent.value
									: JSON.stringify(resultModalContent.value, null, 2)}
							</pre>
							<button
								className="mt-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
								onClick={() => setShowResultModal(false)}
							>
								Close
							</button>
						</div>
					</div>
					<style>{`
            .animate-fadein {
              animation: fadein 0.2s cubic-bezier(.4,0,.2,1);
            }
            @keyframes fadein {
              from { opacity: 0; transform: scale(0.98);}
              to { opacity: 1; transform: scale(1);}
            }
          `}</style>
				</div>
			)}

			{/* Popup Modal for HTML result */}
			{showPopup && popupContent && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadein">
					<div className="relative max-w-2xl w-full rounded-2xl p-0 overflow-hidden shadow-2xl border border-primary/30 bg-gradient-to-br from-white/80 to-violet-100/80 backdrop-blur-lg">
						<button
							className="absolute top-4 right-4 text-2xl text-violet-700 hover:text-violet-900 bg-white/60 rounded-full px-2 py-1 shadow transition-all duration-200 border border-violet-200"
							onClick={() => setShowPopup(false)}
							aria-label="Close"
							style={{ zIndex: 2 }}
						>
							×
						</button>
						<div className="p-6">
							<h2 className="text-2xl font-bold text-violet-800 mb-4 text-center drop-shadow">
								HTML Result
							</h2>
							<div className="mb-4 flex flex-wrap gap-2 items-center justify-center">
								<span className="font-mono text-xs bg-violet-100 px-3 py-1 rounded-full text-violet-700 border border-violet-200 shadow">
									HTTP {popupContent.code}
								</span>
							</div>
							<div className="mb-4">
								<h3 className="text-sm font-semibold text-violet-700 mb-2">Headers</h3>
								<div className="bg-white/60 border border-violet-200 rounded-lg p-3 text-xs font-mono text-violet-900 shadow-inner">
									{Object.entries(popupContent.headers).map(([k, v]) => (
										<div key={k} className="flex gap-2 py-0.5">
											<span className="font-bold text-violet-700">{k}:</span>
											<span className="text-violet-900">{v}</span>
										</div>
									))}
								</div>
							</div>
							<div>
								<h3 className="text-sm font-semibold text-violet-700 mb-2">
									HTML Content
								</h3>
								<div className="border-2 border-violet-200 rounded-xl bg-white/70 shadow-lg overflow-hidden">
									<iframe
										srcDoc={popupContent.html}
										title="Popup HTML"
										className="w-full h-96 rounded-xl border-none"
										sandbox="allow-scripts allow-same-origin"
									/>
								</div>
							</div>
						</div>
					</div>
					<style>{`
            .animate-fadein {
              animation: fadein 0.25s cubic-bezier(.4,0,.2,1);
            }
            @keyframes fadein {
              from { opacity: 0; transform: scale(0.98);}
              to { opacity: 1; transform: scale(1);}
            }
          `}</style>
				</div>
			)}

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

						{/* CLICommandCard for CLI Pull command */}
						<CLICommandCard
							command={`shsf-cli --mode pull --project ./my-func --link ${functionData.id}`}
							label="CLI Pull"
							description="Pull this function to your local project using the CLI."
						/>

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
							{(functionData.executionAlias && functionData.allow_http) && (
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
							onRenameFile={(file) => {
								setSelectedFile(file);
								setShowRenameModal(true);
							}}
							onDeleteFile={(file) => {
								setSelectedFile(file);
								setShowDeleteModal(true);
							}}
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
							disabled={serveHtmlOnly}
							disabledReason="This function is set to only serve an .html file"
						/>
					</div>

					{/* Main Content - Use Full Remaining Space */}
					<div className="flex-1 min-w-0 space-y-4">
						{/* Editor Header - More Compact */}
						<div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-lg p-4">
							<div className="flex justify-between items-center gap-4">
								<div className="flex items-center gap-3 min-w-0">
									<div className="w-6 h-6 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center text-sm flex-shrink-0">
										📝
									</div>
									<h2 className="text-lg font-bold text-primary truncate">
										{activeFile ? activeFile.name : "No file selected"}
									</h2>
								</div>

								<div className="flex items-center gap-2 flex-shrink-0">
									{files.find((file) => file.name === "requirements.txt") && (
										<button
											className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
											onClick={handlePipInstall}
											disabled={pipRunning || running || saving}
										>
											{pipRunning ? "📦 Installing..." : "📦 Pip Install"}
										</button>
									)}
									<button
										className="bg-background/50 border border-primary/20 text-primary px-3 py-1.5 text-sm rounded-lg hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
										onClick={handleLoadDefault}
										disabled={!activeFile || saving || running}
									>
										{saving ? "🚥Loading..." : "📂Load Default"}
									</button>
									<button
										className="bg-background/50 border border-primary/20 text-primary px-3 py-1.5 text-sm rounded-lg hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
										onClick={handleSaveFile}
										disabled={!activeFile || saving || running}
									>
										{saving ? "💾Saving..." : "💾Save"}
									</button>
									<button
										className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1.5 text-sm rounded-lg hover:shadow-[0_0_20px_rgba(124,131,253,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
										onClick={handleRunCode}
										disabled={running || saving}
									>
										{running ? "🚀Running..." : "🚀Run Startup"}
									</button>
									<select
										className={`bg-background/50 border border-primary/20 text-primary px-2 py-1.5 text-sm rounded-lg transition-all duration-300
                      hover:border-primary/40
                      ${
																							running || saving || serveHtmlOnly
																								? "opacity-30 cursor-not-allowed bg-slate-800 text-gray-400"
																								: ""
																						}
                    `}
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
											"px-3 py-1.5 text-sm rounded-lg transition-all duration-300",
											showRunParams
												? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
												: "bg-background/50 border border-primary/20 text-primary hover:border-primary/40",
											running || saving || serveHtmlOnly
												? "opacity-30 cursor-not-allowed bg-slate-800 text-gray-400 border border-primary/20 "
												: "",
										].join(" ")}
										style={{
											cursor: serveHtmlOnly ? "not-allowed" : "pointer",
										}}
										onClick={() => setShowRunParams(!showRunParams)}
										disabled={running || saving || serveHtmlOnly}
									>
										⚙️
									</button>
								</div>
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
								{!activeFile && (
									<div className="absolute inset-0 flex items-center justify-center bg-background/50 text-center">
										<div className="space-y-3">
											<div className="text-5xl">📝</div>
											<h3 className="text-lg font-bold text-primary">No File Selected</h3>
											<p className="text-text/70 text-sm">
												Select a file from the sidebar
											</p>
										</div>
									</div>
								)}
								{activeFile && (
									<Editor
										theme="vs-dark"
										height="100%"
										defaultLanguage={activeFileLanguage}
										value={code || ""}
										onChange={handleEditorChange}
										onMount={handleEditorDidMount}
										options={{
											readOnly: false,
											minimap: { enabled: true },
											scrollBeyondLastLine: false,
											fontSize: 13,
											tabSize: 4,
											"semanticHighlighting.enabled": true,
											codeLens: true,
											automaticLayout: true,
											language: activeFileLanguage,
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
				/>

				<EditTriggerModal
					isOpen={showEditTriggerModal}
					onClose={() => setShowEditTriggerModal(false)}
					onUpdate={handleUpdateTrigger}
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
				/>

				<GuestManagement
					isOpen={showGuestModal}
					onClose={() => setShowGuestModal(false)}
					functionId={functionData?.id ?? null}
				/>

			<LoadDefaultModal
				isOpen={showLoadDefaultModal}
				onClose={() => setShowLoadDefaultModal(false)}
				onLoadDefault={handleLoadDefaultContent}
				functionLanguage={functionData?.image}
			/>
		</div>
	</div>
);
}

export default FunctionDetail;