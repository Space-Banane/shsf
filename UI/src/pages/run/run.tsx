import { useEffect, useRef, useState, useContext } from "react";
import Editor from "@monaco-editor/react";
import { UserContext } from "../../App";
import { BackendService } from "../../services/backend.service";

interface FunctionSettings {
	max_ram?: number;
	timeout?: number;
	secure_header?: string;
	priority?: number;
	tags?: string[];
	retry_on_failure?: boolean;
	retry_count?: number;
}

interface FunctionData {
	id: number;
	name: string;
	description: string;
	image: string;
	settings?: FunctionSettings;
	environment?: FunctionEnvironment[];
}

interface FunctionEnvironment {
	name: string;
	value: string;
}

interface FunctionData {
	id: number;
	name: string;
	description: string;
	image: string;
	settings?: FunctionSettings;
	environment?: FunctionEnvironment[];
}

// Simple Modal component
function Modal({
	isOpen,
	onClose,
	title,
	children,
}: {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
}) {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-xl font-bold text-gray-100">{title}</h3>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-200"
					>
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M6 18L18 6M6 6l12 12"
							></path>
						</svg>
					</button>
				</div>
				<div>{children}</div>
			</div>
		</div>
	);
}

function RunnerPage() {
	// Get user context
	const { user } = useContext(UserContext);

	const [code, setCode] = useState<string>("");
	const [output, setOutput] = useState<string>("");
	const [image, setImage] = useState<string>("");
	const [functionName, setFunctionName] = useState<string>("");
	const [functionDesc, setFunctionDesc] = useState<string>("");
	const [functions, setFunctions] = useState<any[]>([]);
	const editorRef = useRef<any>(null);
	const autosaveTimer = useRef<NodeJS.Timeout | null>(null);
	const [currentFunctionId, setCurrentFunctionId] = useState<number | null>(
		null
	);
	const [mainFileName, setMainFileName] = useState<string>("main.py");

	// New state variables for file management
	const [files, setFiles] = useState<any[]>([]);
	const [selectedFile, setSelectedFile] = useState<string>("main.py");
	const [isNewFileModalOpen, setIsNewFileModalOpen] = useState<boolean>(false);
	const [newFileName, setNewFileName] = useState<string>("");

	// Modal states
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
	const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
	const [functionToDelete, setFunctionToDelete] = useState<number | null>(null);

	// New state variables for modals
	const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
	const [oldFileName, setOldFileName] = useState<string>("");
	const [showFileMenu, setShowFileMenu] = useState<boolean>(false);
	const [selectedFileMenu, setSelectedFileMenu] = useState<string | null>(null);

	const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
	const [startupFile, setStartupFile] = useState<string>("");
	const [allowHttp, setAllowHttp] = useState<boolean>(false); // Add this line

	const refreshFunctionList = () => {
		BackendService.getFunctions()
			.then((data) => {
				setFunctions(data);
			})
			.catch((error) => {
				console.error("Error fetching functions:", error);
			});
	};

	useEffect(() => {
		refreshFunctionList();
	}, []);

	useEffect(() => {
		return () => {
			if (autosaveTimer.current) {
				clearTimeout(autosaveTimer.current);
			}
		};
	}, []);

	function handleEditorChange(value: any, event: any) {
		setCode(value);

		if (autosaveTimer.current) {
			clearTimeout(autosaveTimer.current);
		}
		autosaveTimer.current = setTimeout(() => {
			autosaveFunction();
		}, 2000); // Changed from 3000 to 2000 for 2-second delay
	}

	function handleEditorDidMount(editor: any, monaco: any) {
		editorRef.current = editor;
	}

	function handleEditorWillMount(monaco: any) {}
	function handleEditorValidation(markers: any) {}

	function runCode() {
		if (!currentFunctionId) {
			setOutput("Please select or create a function first.");
			return;
		}

		BackendService.executeFunction(currentFunctionId)
			.then((data) => {
				setOutput(data.output || "No output received.");
			})
			.catch((error) => {
				console.error("Error:", error);
				setOutput(`Error executing function: ${error.message}`);
			});
	}

	// Modified loadFunction to separate file loading
	function loadFunction(id: number) {
		setCurrentFunctionId(id);
		BackendService.getFunction(id)
			.then((func) => {
				setFunctionName(func.name);
				setFunctionDesc(func.description || "");
				setImage(func.image);

				// Load files separately
				loadFunctionFiles(id);
			})
			.catch((error) => {
				console.error("Error:", error);
				alert("Failed to load function.");
			});
	}

	// New function to load files for a function
	function loadFunctionFiles(id: number) {
		BackendService.getFunctionFiles(id)
			.then((fileData) => {
				setFiles(fileData);

				// Find main.py or use the first file
				const mainFile =
					fileData.find((f: any) => f.name === "main.py") ||
					(fileData.length > 0 ? fileData[0] : null);

				if (mainFile) {
					setSelectedFile(mainFile.name);
					setMainFileName(mainFile.name);
					setCode(mainFile.content || "");
					if (editorRef.current) {
						editorRef.current.getModel().setValue(mainFile.content || "");
					}
				} else {
					// No files exist, create a default main.py
					const defaultCode = "# Write your code here\n\nprint('Hello World!')";
					setCode(defaultCode);
					setSelectedFile("main.py");
					setMainFileName("main.py");
					if (editorRef.current) {
						editorRef.current.getModel().setValue(defaultCode);
					}

					// Create the file on the server
					createNewFile("main.py", defaultCode);
				}
			})
			.catch((error) => {
				console.error("Error loading files:", error);
				setFiles([]);

				// Set up default file if no files could be loaded
				const defaultCode = "# Write your code here\n\nprint('Hello World!')";
				setCode(defaultCode);
				setSelectedFile("main.py");
				setMainFileName("main.py");
				if (editorRef.current) {
					editorRef.current.getModel().setValue(defaultCode);
				}
			});
	}

	// Function to handle file selection
	function selectFile(fileName: string) {
		if (!currentFunctionId) return;

		// If we're changing files, save the current file first
		if (selectedFile && selectedFile !== fileName) {
			autosaveFunction().then(() => {
				const fileToLoad = files.find((f) => f.name === fileName);
				if (fileToLoad) {
					setSelectedFile(fileName);
					setCode(fileToLoad.content || "");
					if (editorRef.current) {
						editorRef.current.getModel().setValue(fileToLoad.content || "");
					}
				}
			});
		} else if (selectedFile !== fileName) {
			const fileToLoad = files.find((f) => f.name === fileName);
			if (fileToLoad) {
				setSelectedFile(fileName);
				setCode(fileToLoad.content || "");
				if (editorRef.current) {
					editorRef.current.getModel().setValue(fileToLoad.content || "");
				}
			}
		}
	}

	// Function to create a new file
	function createNewFile(filename = newFileName, content = "# New file\n") {
		if (!currentFunctionId || !filename) return;

		BackendService.updateFunctionFile(currentFunctionId, filename, content)
			.then(() => {
				// Reload files to get the new file with its ID
				loadFunctionFiles(currentFunctionId);
				setNewFileName("");
				setIsNewFileModalOpen(false);
			})
			.catch((error) => {
				console.error("Error creating file:", error);
				alert("Failed to create file");
			});
	}

	// Function to delete a file
	function deleteFile(fileName: string) {
		if (!currentFunctionId) return;

		// Confirm before deleting
		if (!window.confirm(`Are you sure you want to delete ${fileName}?`)) {
			return;
		}

		// Don't allow deleting the only file
		if (files.length <= 1) {
			alert("You cannot delete the only file in your function.");
			return;
		}

		// Don't allow deleting main.py if it's the entry point
		if (fileName === "main.py" && mainFileName === "main.py") {
			alert(
				"You cannot delete main.py as it is the entry point for your function."
			);
			return;
		}

		BackendService.deleteFile(currentFunctionId, fileName)
			.then(() => {
				// If the deleted file was selected, select another file
				if (selectedFile === fileName) {
					const newSelectedFile = files.find((f) => f.name !== fileName);
					if (newSelectedFile) {
						selectFile(newSelectedFile.name);
					}
				}
				// Reload files to reflect changes
				loadFunctionFiles(currentFunctionId);
			})
			.catch((error) => {
				console.error("Error deleting file:", error);
				alert("Failed to delete file");
			});
	}

	function saveFunction() {
		if (!currentFunctionId) return;

		const functionData = {
			name: functionName,
			description: functionDesc || "Updated function",
			image: image || "python:3.9",
		};

		BackendService.updateFunction(currentFunctionId, functionData)
			.then(() => {
				return autosaveFunction().then(() => {
					setIsSaveModalOpen(false);
					alert("Function and code saved successfully");
					refreshFunctionList();
				});
			})
			.catch((error) => {
				console.error("Error:", error);
				setIsSaveModalOpen(false);
				alert("Failed to save function");
			});
	}

	function confirmDeleteFunction(id: number) {
		setFunctionToDelete(id);
		setIsDeleteModalOpen(true);
	}

	function deleteFunction() {
		if (!functionToDelete) return;

		BackendService.deleteFunction(functionToDelete)
			.then(() => {
				setIsDeleteModalOpen(false);

				// If we deleted the current function, reset state
				if (functionToDelete === currentFunctionId) {
					setFunctionName("");
					setFunctionDesc("");
					setCode("");
					setCurrentFunctionId(null);
					if (editorRef.current) {
						editorRef.current.getModel().setValue("");
					}
				}

				refreshFunctionList();
				alert("Function deleted successfully");
			})
			.catch((error) => {
				console.error("Error:", error);
				setIsDeleteModalOpen(false);
				alert("Failed to delete function");
			});
	}

	function createNewFunction() {
		if (!functionName || functionName.trim() === "") {
			alert("Function name is required");
			return;
		}

		if (
			!functionDesc ||
			functionDesc.trim() === "" ||
			functionDesc.length < 12
		) {
			alert("Please provide a description (at least 12 characters)");
			return;
		}

		const functionData = {
			name: functionName,
			description: functionDesc,
			image: image || "python:3.9",
		};

		BackendService.createFunction(functionData)
			.then((data) => {
				setCurrentFunctionId(data.id);

				const defaultCode = "# Write your code here\n\nprint('Hello World!')";
				setCode(defaultCode);

				// Create initial main.py file
				return BackendService.updateFunctionFile(
					data.id,
					"main.py",
					defaultCode
				);
			})
			.then(() => {
				setIsCreateModalOpen(false);
				alert("Function created successfully with default code");
				refreshFunctionList();
			})
			.catch((error) => {
				console.error("Error:", error);
				setIsCreateModalOpen(false);
				alert("Failed to create function");
			});
	}

	// Modified autosaveFunction to save the currently selected file
	function autosaveFunction() {
		if (!currentFunctionId || !code) {
			return Promise.resolve();
		}

		return BackendService.updateFunctionFile(
			currentFunctionId,
			selectedFile,
			code
		)
			.then((data) => {
				// Update the file in our list with the new content
				setFiles((prevFiles) =>
					prevFiles.map((file) =>
						file.name === selectedFile ? { ...file, content: code } : file
					)
				);
			})
			.catch((error) => {
				console.error("Autosave failed:", error);
			});
	}

	// Function to handle file renaming
	const handleRenameFile = async (oldName: string, newName: string) => {
		if (!currentFunctionId) return;
		try {
			await BackendService.renameFile(currentFunctionId, oldName, newName);
			loadFunctionFiles(currentFunctionId);
			setIsRenameModalOpen(false);
		} catch (error) {
			console.error("Error renaming file:", error);
			alert("Failed to rename file");
		}
	};

	function openUpdateModal(func: any) {
		setFunctionName(func.name);
		setFunctionDesc(func.description);
		setImage(func.image);
		setAllowHttp(func.allow_http || false);
		setStartupFile(func.startup_file || ""); // Add this line to initialize startup file
		setIsUpdateModalOpen(true);
	}

	function updateFunctionDetails() {
		if (!currentFunctionId) {console.error("No function selected"); return;}

		const functionData = {
			name: functionName,
			description: functionDesc,
			image: image,
			startup_file: startupFile.length === 0 ? undefined : startupFile, // This property needs to be included
			allow_http: allowHttp,
		};

		console.log("Updating function with data:", functionData); // Add logging to debug

		BackendService.updateFunction(currentFunctionId, functionData)
			.then((response) => {
				console.log("Update successful:", response); // Add logging for success
				setIsUpdateModalOpen(false);
				refreshFunctionList();
				alert("Function updated successfully");
			})
			.catch((error) => {
				console.error("Error updating function:", error);
				alert(`Failed to update function: ${error.message}`);
			});
	}

	return (
		<div className="min-h-screen flex flex-row gap-4 p-4 bg-gray-900">
			{/* Function Manager (far left) */}
			<div className="w-1/5 bg-gray-800 rounded-xl shadow-md p-4">
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-xl font-bold text-gray-100">Function Manager</h2>
					<button
						className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md"
						onClick={() => setIsCreateModalOpen(true)}
					>
						<span className="flex items-center">
							<svg
								className="w-4 h-4 mr-1"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M12 4v16m8-8H4"
								/>
							</svg>
							New
						</span>
					</button>
				</div>
				<div className="overflow-y-auto max-h-[calc(100vh-8rem)]">
					{functions.map((func) => (
						<div
							key={func.id}
							className={`mb-2 p-3 rounded-lg ${
								currentFunctionId === func.id ? "bg-gray-700" : "bg-gray-750"
							} hover:bg-gray-700 transition-colors`}
						>
							<div className="flex justify-between items-center">
								<div
									className="flex-grow cursor-pointer"
									onClick={() => loadFunction(func.id)}
								>
									<h3 className="font-medium text-gray-100">{func.name}</h3>
									<p>{func.allow_http.toString()}</p>
									<p className="text-sm text-gray-400 truncate">
										{func.description}
									</p>
								</div>
								<div className="flex items-center space-x-2">
									<button
										className="p-1 rounded hover:bg-gray-600 text-red-400"
										onClick={() => confirmDeleteFunction(func.id)}
									>
										<svg
											className="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</button>
									<div className="flex items-center space-x-2">
										<button
											className="p-1 rounded hover:bg-gray-600"
											onClick={() => openUpdateModal(func)}
											title="Update Function"
										>
											<svg
												className="w-4 h-4 text-blue-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth="2"
													d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
												/>
											</svg>
										</button>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* File Manager (middle left) */}
			<div className="w-1/5 bg-gray-800 rounded-xl shadow-md p-4">
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-xl font-bold text-gray-100">File Manager</h2>
					<button
						className={`bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md ${
							!currentFunctionId ? "opacity-50 cursor-not-allowed" : ""
						}`}
						onClick={() => currentFunctionId && setIsNewFileModalOpen(true)}
						disabled={!currentFunctionId}
					>
						<span className="flex items-center">
							<svg
								className="w-4 h-4 mr-1"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M12 4v16m8-8H4"
								/>
							</svg>
							New File
						</span>
					</button>
				</div>
				<div className="overflow-y-auto max-h-[calc(100vh-12rem)]">
					{files.map((file) => (
						<div
							key={file.name}
							className={`relative mb-2 p-2 rounded-lg ${
								selectedFile === file.name ? "bg-gray-700" : "bg-gray-750"
							} hover:bg-gray-700 transition-colors`}
						>
							<div className="flex justify-between items-center">
								<div
									className="flex-grow cursor-pointer"
									onClick={() => selectFile(file.name)}
								>
									<span
										className={`text-gray-100 ${
											file.name === mainFileName ? "font-bold" : ""
										}`}
									>
										{file.name}
									</span>
								</div>
								<div className="flex items-center space-x-2">
									<button
										className="p-1 rounded hover:bg-gray-600"
										onClick={() => {
											setOldFileName(file.name);
											setIsRenameModalOpen(true);
										}}
									>
										<svg
											className="w-4 h-4 text-blue-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
											/>
										</svg>
									</button>
									<button
										className="p-1 rounded hover:bg-gray-600"
										onClick={() => deleteFile(file.name)}
									>
										<svg
											className="w-4 h-4 text-red-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
				<div className="mt-4 pt-4 border-t border-gray-700">
					<p className="text-sm text-gray-400">
						Currently editing:{" "}
						<span className="font-bold text-gray-100">
							{selectedFile || "No file selected"}
						</span>
					</p>
				</div>
			</div>

			{/* Code Editor (right side) */}
			<div className="flex-1 bg-gray-800 rounded-xl shadow-md p-4">
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-xl font-bold text-gray-100">Code Editor</h2>
					<div className="flex items-center space-x-2">
						<button
							className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md flex items-center"
							onClick={() => currentFunctionId && autosaveFunction()}
							disabled={!currentFunctionId}
						>
							<svg
								className="w-4 h-4 mr-1"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
								/>
							</svg>
							Save
						</button>
						<button
							className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md flex items-center"
							onClick={runCode}
							disabled={!currentFunctionId}
						>
							<svg
								className="w-4 h-4 mr-1"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
								/>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							Run
						</button>
					</div>
				</div>
				<div className="h-[calc(80vh-16rem)]">
					<Editor
						theme="vs-dark"
						height="80%"
						defaultLanguage="python"
						value={code}
						onChange={handleEditorChange}
						onMount={handleEditorDidMount}
						beforeMount={handleEditorWillMount}
						onValidate={handleEditorValidation}
						path={selectedFile}
						options={{
							readOnly: !currentFunctionId || !selectedFile,
							minimap: { enabled: false },
							scrollBeyondLastLine: false,
							fontSize: 14,
							tabSize: 4,
						}}
					/>
				</div>
				<div className="mt-4 bg-gray-700 rounded-md p-4 h-[12rem] overflow-y-auto">
					<h3 className="text-lg font-semibold text-gray-100 mb-2">Output:</h3>
					<pre className="text-gray-300 font-mono text-sm whitespace-pre-wrap">
						{output || "No output to display"}
					</pre>
				</div>
			</div>

			{/* Delete Confirmation Modal */}
			<Modal
				isOpen={isDeleteModalOpen}
				onClose={() => setIsDeleteModalOpen(false)}
				title="Confirm Delete"
			>
				<div className="text-gray-300 mb-4">
					Are you sure you want to delete this function? This action cannot be
					undone.
				</div>
				<div className="flex justify-end space-x-3">
					<button
						type="button"
						className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
						onClick={() => setIsDeleteModalOpen(false)}
					>
						Cancel
					</button>
					<button
						type="button"
						className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
						onClick={deleteFunction}
					>
						Delete
					</button>
				</div>
			</Modal>

			{/* Create Function Modal */}
			<Modal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				title="Create New Function"
			>
				<div className="mb-4">
					<label className="block text-gray-300 mb-2">Function Name</label>
					<input
						type="text"
						className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
						value={functionName}
						onChange={(e) => setFunctionName(e.target.value)}
						placeholder="my_function"
					/>
				</div>
				<div className="mb-4">
					<label className="block text-gray-300 mb-2">Description</label>
					<textarea
						className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100 h-24"
						value={functionDesc}
						onChange={(e) => setFunctionDesc(e.target.value)}
						placeholder="Function description (at least 12 characters)"
					/>
				</div>
				<div className="mb-4">
					<label className="block text-gray-300 mb-2">Runtime Image</label>
					<select
						className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
						value={image}
						onChange={(e) => setImage(e.target.value)}
					>
						<option value="">Select a runtime</option>
						<option value="python:3.9">Python 3.9</option>
						<option value="python:3.10">Python 3.10</option>
						<option value="python:3.11">Python 3.11</option>
					</select>
				</div>
				<div className="flex justify-end space-x-3">
					<button
						type="button"
						className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
						onClick={() => setIsCreateModalOpen(false)}
					>
						Cancel
					</button>
					<button
						type="button"
						className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
						onClick={createNewFunction}
					>
						Create Function
					</button>
				</div>
			</Modal>

			{/* Save Changes Modal */}
			<Modal
				isOpen={isSaveModalOpen}
				onClose={() => setIsSaveModalOpen(false)}
				title="Save Function"
			>
				<div className="mb-4">
					<label className="block text-gray-300 mb-2">Function Name</label>
					<input
						type="text"
						className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
						value={functionName}
						onChange={(e) => setFunctionName(e.target.value)}
					/>
				</div>
				<div className="mb-4">
					<label className="block text-gray-300 mb-2">Description</label>
					<textarea
						className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100 h-24"
						value={functionDesc}
						onChange={(e) => setFunctionDesc(e.target.value)}
						placeholder="Function description (at least 12 characters)"
					/>
				</div>
				<div className="mb-4">
					<label className="block text-gray-300 mb-2">Runtime Image</label>
					<select
						className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
						value={image}
						onChange={(e) => setImage(e.target.value)}
					>
						<option value="">Select a runtime</option>
						<option value="python:3.9">Python 3.9</option>
						<option value="python:3.10">Python 3.10</option>
						<option value="python:3.11">Python 3.11</option>
					</select>
				</div>
				<div className="flex justify-end space-x-3">
					<button
						type="button"
						className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
						onClick={() => setIsSaveModalOpen(false)}
					>
						Cancel
					</button>
					<button
						type="button"
						className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
						onClick={saveFunction}
					>
						Save Changes
					</button>
				</div>
			</Modal>

			{/* New File Modal */}
			<Modal
				isOpen={isNewFileModalOpen}
				onClose={() => setIsNewFileModalOpen(false)}
				title="Create New File"
			>
				<div className="mb-4">
					<label className="block text-gray-300 mb-2">File Name</label>
					<input
						type="text"
						className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
						value={newFileName}
						onChange={(e) => setNewFileName(e.target.value)}
						placeholder="example.py"
					/>
				</div>
				<div className="flex justify-end space-x-3">
					<button
						type="button"
						className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
						onClick={() => setIsNewFileModalOpen(false)}
					>
						Cancel
					</button>
					<button
						type="button"
						className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
						onClick={() => createNewFile()}
						disabled={!newFileName}
					>
						Create File
					</button>
				</div>
			</Modal>

			{/* Rename File Modal */}
			<Modal
				isOpen={isRenameModalOpen}
				onClose={() => setIsRenameModalOpen(false)}
				title="Rename File"
			>
				<div className="mb-4">
					<p className="text-gray-300 mb-2">
						Current name: <span className="font-bold">{oldFileName}</span>
					</p>
					<label className="block text-gray-300 mb-2">New File Name</label>
					<input
						type="text"
						className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
						placeholder="new-name.py"
						id="newFilename"
					/>
				</div>
				<div className="flex justify-end space-x-3">
					<button
						type="button"
						className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
						onClick={() => setIsRenameModalOpen(false)}
					>
						Cancel
					</button>
					<button
						type="button"
						className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
						onClick={() => {
							const newFilename = (
								document.getElementById("newFilename") as HTMLInputElement
							).value;
							if (newFilename) {
								handleRenameFile(oldFileName, newFilename);
							}
						}}
					>
						Rename
					</button>
				</div>
			</Modal>

			{/* Update Function Modal */}
			<Modal
				isOpen={isUpdateModalOpen}
				onClose={() => setIsUpdateModalOpen(false)}
				title="Update Function"
			>
				<div className="mb-4">
					<label className="block text-gray-300 mb-2">Function Name</label>
					<input
						type="text"
						className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
						value={functionName}
						onChange={(e) => setFunctionName(e.target.value)}
					/>
				</div>
				<div className="mb-4">
					<label className="block text-gray-300 mb-2">Description</label>
					<textarea
						className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100 h-24"
						value={functionDesc}
						onChange={(e) => setFunctionDesc(e.target.value)}
					/>
				</div>
				<div className="mb-4">
					<label className="block text-gray-300 mb-2">Startup File</label>
					<input
						type="text"
						className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
						value={startupFile}
						onChange={(e) => setStartupFile(e.target.value)}
					/>
				</div>
				<div className="mb-4">
					<label className="flex items-center space-x-2 text-gray-300">
						<input
							type="checkbox"
							className="form-checkbox h-4 w-4 text-blue-500 rounded bg-gray-700 border-gray-600"
							checked={allowHttp}
							onChange={(e) => setAllowHttp(e.target.checked)}
						/>
						<span>Allow HTTP Access</span>
					</label>
					<p className="text-sm text-gray-400 mt-1">
						If enabled, this function can be executed via HTTP without authentication
					</p>
				</div>
				<div className="flex justify-end space-x-3">
					<button
						type="button"
						className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
						onClick={() => setIsUpdateModalOpen(false)}
					>
						Cancel
					</button>
					<button
						type="button"
						className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
						onClick={updateFunctionDetails}
					>
						Update
					</button>
				</div>
			</Modal>
		</div>
	);
}

export default RunnerPage;
