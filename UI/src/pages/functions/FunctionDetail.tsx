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
} from "../../services/backend.functions";
import {
	getFiles,
	createOrUpdateFile,
	deleteFile,
	renameFile,
} from "../../services/backend.files";
import {
	createTrigger,
	getTriggers,
	updateTrigger,
	deleteTrigger,
} from "../../services/backend.triggers";
import { getNamespace } from "../../services/backend.namespaces";
import { BASE_URL } from "../..";

// Define the timing entry interface
interface TimingEntry {
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
		"streaming"
	);
	const [exitCode, setExitCode] = useState<number | null>(null);
	const [functionURL, setFunctionURL] = useState<string>("Loading url...");
	const [executionTime, setExecutionTime] = useState<number | null>(null);
	const [functionResult, setFunctionResult] = useState<any>(null);
	const [runParams, setRunParams] = useState<string>("");
	const [showRunParams, setShowRunParams] = useState<boolean>(false);
	const timerRef = useRef<NodeJS.Timeout | null>(null);
	const [activeFileLanguage, setActiveFileLanguage] = useState<string>("");
	const consoleOutputRef = useRef<HTMLDivElement>(null);
	const [autoScroll, setAutoScroll] = useState<boolean>(true);
	const [copyUrlColor, setCopyUrlColor] = useState<string>("text-stone-300");
	const [copyUrltext, setCopyUrlText] = useState<string>("Copy📎");
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

	useEffect(() => {
		setActiveFileLanguage(getDefaultLanguage(activeFile?.name || ""));
	}, [activeFile]);

	// Handle console auto-scrolling
	useEffect(() => {
		if (autoScroll && consoleOutputRef.current) {
			consoleOutputRef.current.scrollTop =
				consoleOutputRef.current.scrollHeight;
		}
	}, [consoleOutput, autoScroll]);

	const handleConsoleScroll = () => {
		if (consoleOutputRef.current) {
			const { scrollTop, scrollHeight, clientHeight } =
				consoleOutputRef.current;
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
			filename.endsWith(ext)
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

						getNamespace(functionData.data.namespaceId).then(
							(namespaceData) => {
								if (namespaceData.status === "OK") {
									setNamespace(namespaceData.data);
								}
							}
						);
					} else {
						alert("Error fetching function: " + functionData.message);
						return;
					}

					if (filesData.status === "OK") {
						setFiles(filesData.data);
						if (functionData.data.allow_http) {
							setFunctionURL(
								`${BASE_URL}/api/exec/${functionData.data.namespaceId}/${functionData.data.executionId}`
							);
						} else {
							setFunctionURL(`HTTP ACCESS DISABLED`);
						}
						if (filesData.data.length > 0) {
							// Select the startup file if it exists, otherwise select the first file
							const startupFile = filesData.data.find(
								(file) => file.name === functionData.data.startup_file
							);
							const initialFile = startupFile || filesData.data[0];
							// setActiveFile(initialFile);
							setCode(initialFile.content || "");
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
						file.id === activeFile.id ? { ...file, content: code || "" } : file
					)
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

		if (runningMode === "classic") {
			try {
				const result = await executeFunction(
					parseInt(id),
					parsedRunParams ? { run: parsedRunParams } : undefined
				);
				if (result.status === "OK") {
					setConsoleOutput(
						result.data.output || "Execution completed with no output."
					);
					setExitCode(result.data.exitCode);
					// Handle both old took and new tooks data
					if (result.data.took) {
						setTooks(result.data.took);
						// Find the total execution time entry
						const totalExecution = result.data.took.find(
							(entry: TimingEntry) =>
								entry.description === "Total execution time"
						);
						if (totalExecution) {
							setRealTimeTaken(totalExecution.value);
						}
					}

					// Display result if available
					if (result.data.result !== undefined) {
						setFunctionResult(result.data.result);
					}
				} else {
					setConsoleOutput(
						`Error: ${result.message}\nDetails: ${
							result.error || "No additional details."
						}`
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
				await executeFunctionStreaming(
					parseInt(id),
					(data) => {
						if (data.type === "output" && data.content) {
							// Ensure we're dealing with a string
							const content =
								typeof data.content === "string"
									? data.content
									: JSON.stringify(data.content);
							setConsoleOutput((prev) => prev + content);
						} else if (data.type === "end") {
							setExitCode(data.exitCode);

							// Handle both old took and new tooks data
							if (data.took) {
								setTooks(data.took);
								// Find the total execution time entry
								const totalExecution = data.took.find(
									(entry: TimingEntry) =>
										entry.description === "Total execution time"
								);
								if (totalExecution) {
									setRealTimeTaken(totalExecution.value);
								}
							}

							// Handle function result if present
							if (data.result !== undefined) {
								setFunctionResult(data.result);
							}
						} else if (data.type === "error") {
							setConsoleOutput(
								(prev) =>
									prev + `\nError: ${data.error || "No additional details."}`
							);
						}
					},
					parsedRunParams ? { run: parsedRunParams } : undefined
				);
			} catch (error) {
				console.error("Error streaming execution:", error);
				setConsoleOutput(
					(prev) => prev + "\nConnection error: Failed to stream output."
				);
			} finally {
				stopTimer();
				setRunning(false);
			}
		}
	};

	useEffect(() => {
		loadData();
	}, [id]);

	const handleCreateFile = async (
		filename: string,
		content: string
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
						file.id === selectedFile.id ? { ...file, name: newFilename } : file
					)
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
		enabled: boolean
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
		enabled: boolean
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
						trigger.id === selectedTrigger.id ? response.data : trigger
					)
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
					prev.filter((trigger) => trigger.id !== selectedTrigger.id)
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
		env: { name: string; value: string }[]
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

	if (loading) {
		return <div className="text-white">Loading...</div>;
	}

	if (!functionData) {
		return <div className="text-white">Function not found.</div>;
	}

	return (
		<div className="flex flex-col items-center w-full">
			<h1 className="text-primary text-center text-3xl font-bold mb-2">
				 📂
				<span className="bg-gray-950 py-1 px-2 rounded-2xl">
					{nameSpace?.name}
				</span>
				/🚀
				<span className="bg-gray-950 py-1 px-2 rounded-xl">
					{functionData.name}
				</span>
			</h1>

			<div className="mt-4 w-full px-4 flex flex-col lg:flex-row gap-4">
				<div className="lg:w-1/4 w-full">
					<div className="flex space-x-2 mb-4">
						<button
							className="bg-primary text-white px-1 py-2 rounded-md hover:bg-primary/80 w-1/2"
							onClick={() => setShowUpdateModal(true)}
						>
							Update Function
						</button>
						<button
							className="bg-primary text-white px-1 py-2 rounded-md hover:bg-primary/80 w-1/2"
							onClick={() => setShowEnvModal(true)}
						>
							Edit Environment
						</button>
					</div>
					<div className="bg-gray-800 p-4 rounded-lg mb-4">
						<h2 className="text-secondary text-xl mb-2">File Manager</h2>
						<ul className="text-white">
							{files.length > 0 ? (
								files.map((file) => (
									<li
										key={file.id}
										className={`flex justify-between py-1 px-2 cursor-pointer ${
											activeFile?.id === file.id
												? "bg-slate-700 rounded-md"
												: ""
										}`}
										onClick={() => handleFileSelect(file)}
									>
										 <span className="truncate">{file.name}</span>
										<div>
											<button
												className="text-blue-500 mr-2 outline rounded-md px-2 bg-gray-800"
												onClick={(e) => {
													e.stopPropagation();
													setSelectedFile(file);
													setShowRenameModal(true);
												}}
											>
												 ✏️
											</button>
											<button
												className="text-red-500 outline rounded-md px-2 bg-gray-800"
												onClick={(e) => {
													e.stopPropagation();
													setSelectedFile(file);
													setShowDeleteModal(true);
												}}
											>
												 🗑️
											</button>
										</div>
									</li>
								))
							) : (
								<li>No files available.</li>
							)}
						</ul>
						<button
							className="mt-4 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/80 w-full"
							onClick={() => setShowCreateModal(true)}
						>
							Create File
						</button>
					</div>

					<div className="bg-gray-800 p-4 rounded-lg mb-4">
						<div
							className="flex justify-between items-center cursor-pointer"
							onClick={() => setShowTriggersDetails(!showTriggersDetails)}
						>
							<h2 className="text-secondary text-xl">Triggers</h2>
							<span className="text-white text-xl">
								{showTriggersDetails ? "📂" : "📁"}
							</span>
						</div>

						{showTriggersDetails && (
							<>
								<ul className="text-white">
									{triggers.length > 0 ? (
										triggers.map((trigger) => (
											<li
												key={trigger.id}
												className="border-b border-gray-700 py-2 last:border-0"
											>
												<div className="flex justify-between items-center">
													<div>
														<h3
															className={`font-medium ${
																!trigger.enabled ? "text-gray-400" : ""
															}`}
														>
															{trigger.name} {!trigger.enabled && "(Disabled)"}
														</h3>
														<p className="text-gray-400 text-sm">
															{trigger.cron}
														</p>
													</div>
													<div>
														<button
															className="text-blue-500 mr-2 hover:underline"
															onClick={() => {
																setSelectedTrigger(trigger);
																setShowEditTriggerModal(true);
															}}
														>
															Edit
														</button>
														<button
															className="text-red-500 hover:underline"
															onClick={() => {
																setSelectedTrigger(trigger);
																setShowDeleteTriggerModal(true);
															}}
														>
															Delete
														</button>
													</div>
												</div>
												{trigger.description && (
													<p className="text-gray-400 text-sm mt-1">
														{trigger.description}
													</p>
												)}
											</li>
										))
									) : (
										<li>No triggers configured.</li>
									)}
								</ul>
								<button
									className="mt-4 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/80"
									onClick={() => setShowCreateTriggerModal(true)}
								>
									Create Trigger
								</button>
							</>
						)}
					</div>

					{/* New Timing Details Card */}
					<div className="bg-gray-800 p-4 rounded-lg mb-4">
						<div
							className="flex justify-between items-center cursor-pointer"
							onClick={() => setShowTimingDetails(!showTimingDetails)}
						>
							<h2 className="text-secondary text-xl">
								Execution Timing Details
							</h2>
							<span className="text-white text-xl">
								{showTimingDetails ? "📂" : "📁"}
							</span>
						</div>

						{showTimingDetails && tooks.length > 0 && (
							<div className="mt-1 text-white">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-gray-700">
											<th className="text-left py-1">Operation</th>
											<th className="text-right py-1">Duration (s)</th>
										</tr>
									</thead>
									<tbody>
										{tooks.map((entry, index) => (
											<tr
												key={index}
												className={`border-b border-gray-700 ${
													entry.description === "Total execution time"
														? "font-bold text-primary"
														: ""
												}`}
											>
												<td className="py-1">{String(entry.description)}</td>
												<td className="text-right py-1">
													{typeof entry.value === "number"
														? entry.value.toFixed(3)
														: String(entry.value)}{" "}
													{/* Ensure value is a number or string */}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}

						{showTimingDetails && tooks.length === 0 && (
							<p className="mt-3 text-gray-400">
								No timing data available. Run your function to see execution
								timing details.
							</p>
						)}
					</div>

					{/* Function Logs Card */}
					<div className="bg-gray-800 p-4 rounded-lg">
						<div
							className="flex justify-between items-center cursor-pointer"
							onClick={() => setShowLogsDetails(!showLogsDetails)}
						>
							<h2 className="text-secondary text-xl">Function Logs</h2>
							<div className="flex items-center">
								{isLoadingLogs && (
									<div className="animate-spin mr-2 text-xs">⟳</div>
								)}
								<span className="text-white text-xl">
									{showLogsDetails ? "📂" : "📁"}
								</span>
							</div>
						</div>

						{showLogsDetails && (
							<div className="flex justify-between mt-4 space-x-4">
								<button
									className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/80 w-1/2 text-sm"
									onClick={() => fetchLogs()}
								>
									Refresh Logs
								</button>
								<button
									className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/80 w-1/2 text-sm"
									onClick={() => setShowLogsModal(true)}
								>
									View Logs
								</button>
							</div>
						)}
					</div>
				</div>

				<div className="lg:w-3/4 w-full flex flex-col">
					<div className="flex flex-col lg:flex-row justify-between mb-2">
						<h2 className="text-primary text-xl truncate">
							{activeFile ? activeFile.name : "No file selected"}
						</h2>
						<div className="flex flex-col lg:flex-row items-start lg:items-center gap-2">
							<div className="flex items-center bg-stone-100/10 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg w-full lg:w-auto">
								<span className="text-stone-300 text-sm font-light mr-3">
									URL
								</span>
								<div className="relative flex items-center space-x-2 w-full">
									<input
										type="text"
										value={functionURL}
										readOnly
										className="bg-stone-800/50 text-stone-100 text-sm px-4 py-1.5 rounded-md w-full lg:w-72 outline-none ring-1 ring-stone-400/30"
										onClick={(e) => e.currentTarget.select()}
									/>
									<button
										className="transition-all duration-200 bg-stone-700/50 hover:bg-stone-600/50 px-3 py-1.5 rounded-md text-sm font-light"
										onClick={() => {
											navigator.clipboard.writeText(functionURL);
											setCopyUrlColor("text-green-400");
											setCopyUrlText("✅ Copied!");
											setTimeout(() => {
												setCopyUrlColor("text-stone-300");
												setCopyUrlText("Copy📎");
											}, 2000);
										}}
									>
										<span className={copyUrlColor}>{copyUrltext}</span>
									</button>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<button
									className={`bg-green-600 text-white px-4 py-1.5 rounded-md hover:bg-green-700 ${
										!activeFile ? "opacity-50 cursor-not-allowed" : ""
									}`}
									onClick={handleSaveFile}
									disabled={!activeFile || saving}
								>
									{saving ? "Saving..." : "💾Save"}
								</button>
								<button
									className={`bg-primary text-white px-4 py-1.5 rounded-md hover:bg-primary/80`}
									onClick={handleRunCode}
									disabled={running}
								>
									{running ? "Running..." : `🐎Run`}
								</button>
								<select
									className="bg-gray-700 text-white px-2 py-1.5 rounded-md"
									value={runningMode}
									onChange={(e) =>
										setRunningMode(e.target.value as "classic" | "streaming")
									}
									disabled={running}
								>
									<option value="streaming">Stream</option>
									<option value="classic">Completion</option>
								</select>
								<button
									className={`px-2 py-1.5 rounded-md ${
										showRunParams
											? "bg-yellow-600 text-white hover:bg-yellow-700"
											: "bg-gray-600 text-white hover:bg-gray-700"
									}`}
									onClick={() => setShowRunParams(!showRunParams)}
								>
									{showRunParams ? "Params" : "Params"}
								</button>
							</div>
						</div>
					</div>

					{/* Run Parameters Input */}
					{showRunParams && (
						<div className="mb-2">
							<textarea
								className={`w-full h-20 bg-gray-800 ${paramInputColor} p-2 rounded-md border border-gray-600`}
								placeholder="Enter JSON run parameters..."
								value={runParams}
								onChange={(e) => {
									setRunParams(e.target.value);
									try {
										JSON.parse(e.target.value);
										setParamInputColor("text-white");
									} catch {
										setParamInputColor("text-red-500");
									}
								}}
								spellCheck={false}
							/>
						</div>
					)}

					<div className="h-[28rem] border border-gray-700 rounded relative">
						{!activeFile && (
							<div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 text-text text-lg">
								No file selected. Please select a file to edit.
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
									minimap: { enabled: false },
									scrollBeyondLastLine: false,
									fontSize: 14,
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

					<div className="mt-4">
						<h3 className="text-white text-lg mb-1 flex justify-between">
							<div className="flex space-x-5">
								<span className="text-primary font-semibold text-xl">
									Console Output
								</span>
								<span
									className={`${
										exitCode === null
											? "text-gray-400"
											: exitCode === 0
											? "text-green-500"
											: "text-red-500"
									}`}
								>
									(Exit Code: {exitCode !== null ? exitCode : "N/A"})
								</span>
								<span
									title="Call to Return Time"
									className={`${
										executionTime !== null &&
										executionTime > functionData.timeout
											? "text-red-500"
											: "text-gray-400"
									}`}
								>
									CR Time: {executionTime !== null ? executionTime : "N/A"}s/
									{functionData.timeout}s
								</span>
								<span
									className="text-gray-500"
									title="The time taken to run the function"
								>
									Container: {realTimeTaken !== null ? realTimeTaken : "N/A"}s
								</span>
								<span
									title={`${
										functionResult !== null
											? "Your Code has returned readable data!"
											: "We could not find any data returned from your code."
									}`}
									className={`${
										functionResult !== null ? "text-green-400" : "text-gray-400"
									}`}
								>
									{functionResult !== null
										? "Function returned data!"
										: "No data returned."}
								</span>
							</div>
						</h3>

						<div
							className="bg-gray-950 p-3 rounded min-h-[38px] max-h-[200px] overflow-auto font-mono text-sm text-white scrollbar-none"
							ref={consoleOutputRef}
							onScroll={handleConsoleScroll}
							style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
						>
							<pre className="whitespace-pre-wrap text-white/90">
								{consoleOutput || "No output to display"}
							</pre>
						</div>

						{!autoScroll && consoleOutput && (
							<div className="mt-1 text-xs text-gray-400 flex justify-end">
								<button
									className="hover:text-white"
									onClick={() => {
										setAutoScroll(true);
										if (consoleOutputRef.current) {
											consoleOutputRef.current.scrollTop =
												consoleOutputRef.current.scrollHeight;
										}
									}}
								>
									↓ Resume auto-scroll
								</button>
							</div>
						)}

						{functionResult !== null && (
							<div className="mt-2">
								<span className="text-primary font-semibold text-xl mb-1">
									Function Result
								</span>
								<div className="bg-gray-950 p-3 rounded max-h-40 overflow-auto font-mono text-sm">
									<pre className="whitespace-pre-wrap text-green-400">
										{typeof functionResult === "object"
											? JSON.stringify(functionResult, null, 2)
											: String(functionResult)}
									</pre>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Modals */}
			<div>
				<CreateFileModal
					isOpen={showCreateModal}
					onClose={() => setShowCreateModal(false)}
					onCreate={handleCreateFile}
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
			</div>
		</div>
	);
}

export default FunctionDetail;
