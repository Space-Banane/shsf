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
import { FunctionFile, XFunction, Trigger } from "../../types/Prisma";
import {
	getFunctionById,
	executeFunction,
	executeFunctionStreaming,
	updateFunction,
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

function FunctionDetail() {
	const { id } = useParams<{ id: string }>();
	const [functionData, setFunctionData] = useState<XFunction | null>(null);
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

	useEffect(() => {
		setActiveFileLanguage(getDefaultLanguage(activeFile?.name || ""));
	}, [activeFile]);

	const startTimer = () => {
		let startTime = Date.now();
		setExecutionTime(0);
		timerRef.current = setInterval(() => {
			setExecutionTime(Math.floor((Date.now() - startTime) / 1000));
		}, 1000);
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
					} else {
						alert("Error fetching function: " + functionData.message);
						return;
					}

					if (filesData.status === "OK") {
						setFiles(filesData.data);
						if (functionData.data.allow_http) {
							setFunctionURL(
								`${window.origin.replace("3000", "5000")}/api/exec/${
									functionData.data.namespaceId
								}/${functionData.data.id}`
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
						file.id === activeFile.id ? { ...file, code } : file
					)
				);
				loadData(); // Reload files to ensure the latest content is displayed
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
		data: string
	) => {
		if (!id) return false;

		try {
			const response = await createTrigger(parseInt(id), {
				name,
				description,
				cron,
				data,
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
		data: string
	) => {
		if (!id || !selectedTrigger) return false;

		try {
			const response = await updateTrigger(parseInt(id), selectedTrigger.id, {
				name,
				description,
				cron,
				data,
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

	if (loading) {
		return <div className="text-white">Loading...</div>;
	}

	if (!functionData) {
		return <div className="text-white">Function not found.</div>;
	}

	return (
		<div className="flex flex-col items-center w-full">
			<h1 className="text-white text-2xl mb-4">
				{functionData.name} ({functionData.namespaceId})
			</h1>

			<div className="mt-4 w-full px-4 flex flex-row gap-4">
				<div className="w-1/4">
					<button
						className="mb-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 w-full"
						onClick={() => setShowUpdateModal(true)}
					>
						Update Function Settings
					</button>
					<button
						className="mb-4 bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 w-full"
						onClick={() => setShowEnvModal(true)}
					>
						Edit Environment Variables
					</button>

					<div className="bg-gray-800 p-4 rounded-lg mb-4">
						<h2 className="text-white text-xl mb-2">File Manager</h2>
						<ul className="text-white">
							{files.length > 0 ? (
								files.map((file) => (
									<li
										key={file.id}
										className={`flex justify-between py-1 px-2 cursor-pointer ${
											activeFile?.id === file.id ? "bg-gray-700 rounded-md" : ""
										}`}
										onClick={() => handleFileSelect(file)}
									>
										<span>{file.name}</span>
										<div>
											<button
												className="text-blue-500 mr-2 hover:underline"
												onClick={(e) => {
													e.stopPropagation();
													setSelectedFile(file);
													setShowRenameModal(true);
												}}
											>
												Rename
											</button>
											<button
												className="text-red-500 hover:underline"
												onClick={(e) => {
													e.stopPropagation();
													setSelectedFile(file);
													setShowDeleteModal(true);
												}}
											>
												Delete
											</button>
										</div>
									</li>
								))
							) : (
								<li>No files available.</li>
							)}
						</ul>
						<button
							className="mt-4 bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
							onClick={() => setShowCreateModal(true)}
						>
							Create File
						</button>
					</div>

					<div className="bg-gray-800 p-4 rounded-lg">
						<h2 className="text-white text-xl mb-2">Triggers</h2>
						<ul className="text-white">
							{triggers.length > 0 ? (
								triggers.map((trigger) => (
									<li
										key={trigger.id}
										className="border-b border-gray-700 py-2 last:border-0"
									>
										<div className="flex justify-between items-center">
											<div>
												<h3 className="font-medium">{trigger.name}</h3>
												<p className="text-gray-400 text-sm">{trigger.cron}</p>
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
							className="mt-4 bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
							onClick={() => setShowCreateTriggerModal(true)}
						>
							Create Trigger
						</button>
					</div>
				</div>

				<div className="w-3/4 flex flex-col">
					<div className="flex justify-between mb-2">
						<h2 className="text-white text-xl">
							{activeFile ? activeFile.name : "No file selected"}
						</h2>
						<div className="flex items-center bg-slate-700 px-2 py-1 rounded-md">
							<span className="text-white mr-2">Function URL:</span>
							<div className="relative">
								<input
									type="text"
									value={functionURL}
									readOnly
									className="bg-slate-800 text-white px-2 py-1 rounded-md w-64"
									onClick={(e) => e.currentTarget.select()}
								/>
								<button
									className="ml-2 bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-gray-500"
									onClick={() => {
										navigator.clipboard.writeText(functionURL);
									}}
								>
									Copy
								</button>
							</div>
						</div>
						<div>
							<button
								className={`bg-green-600 text-white px-4 py-1 rounded-md hover:bg-green-700 mr-2 ${
									!activeFile ? "opacity-50 cursor-not-allowed" : ""
								}`}
								onClick={handleSaveFile}
								disabled={!activeFile || saving}
							>
								{saving ? "Saving..." : "💾Save"}
							</button>
							<button
								className={`bg-blue-600 text-white px-4 py-1 rounded-md hover:bg-blue-700`}
								onClick={handleRunCode}
								disabled={running}
							>
								{running ? "Running..." : `🐎Run`}
							</button>
							<select
								className="ml-2 bg-gray-700 text-white px-2 py-1 rounded-md"
								value={runningMode}
								onChange={(e) =>
									setRunningMode(e.target.value as "classic" | "streaming")
								}
								disabled={running}
							>
								<option value="streaming">Stream Output</option>
								<option value="classic">Wait for Completion</option>
							</select>
							<button
								className={`ml-2 px-2 py-1 rounded-md ${
									showRunParams
										? "bg-yellow-600 text-white hover:bg-yellow-700"
										: "bg-gray-600 text-white hover:bg-gray-700"
								}`}
								onClick={() => setShowRunParams(!showRunParams)}
							>
								{showRunParams ? "Hide Params" : "Run Params"}
							</button>
						</div>
					</div>

					{/* Run Parameters Input */}
					{showRunParams && (
						<div className="mb-2">
							<textarea
								className="w-full h-20 bg-gray-800 text-white p-2 rounded-md border border-gray-600"
								placeholder="Enter JSON run parameters..."
								value={runParams}
								onChange={(e) => setRunParams(e.target.value)}
								spellCheck={false}
							/>
						</div>
					)}

					<div className="h-[28rem] border border-gray-700 rounded relative">
						{!activeFile && (
							<div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 text-white text-lg">
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
									codeLens:true,
									automaticLayout: true,
									language:activeFileLanguage,
									smoothScrolling: true,
									overviewRulerBorder: false,
								}}
							/>
						)}
					</div>

					<div className="mt-4">
						<h3 className="text-white text-lg mb-1 flex justify-between">
							<span>
								Console Output{" "}
								{exitCode !== null && (
									<span
										className={
											exitCode === 0 ? "text-green-500" : "text-red-500"
										}
									>
										(Exit Code: {exitCode})
									</span>
								)}{" "}
								{executionTime !== null && (
									<span
										className={
											exitCode === 0
												? "text-gray-500"
												: exitCode === null
												? "text-gray-400"
												: "text-red-500"
										}
									>
										Execution Time: {executionTime}s/{functionData.timeout}s
									</span>
								)}
							</span>
							{functionResult !== null && (
								<span className="text-green-400">
									Function Return Value Available
								</span>
							)}
						</h3>

						<div className="bg-gray-950 p-3 rounded h-36 max-h-42 overflow-auto font-mono text-sm">
							<pre className="whitespace-pre-wrap">
								{consoleOutput || "No output to display"}
							</pre>
						</div>

						{functionResult !== null && (
							<div className="mt-2">
								<h3 className="text-white text-lg mb-1">Function Result</h3>
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
			</div>
		</div>
	);
}

export default FunctionDetail;
