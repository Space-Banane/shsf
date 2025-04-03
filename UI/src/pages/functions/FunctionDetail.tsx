import { useParams } from "react-router-dom";
import { BackendService, FunctionData } from "../../services/backend.service";
import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import Modal from "../../components/modals/Modal";
import NewFileModal from "../../components/modals/NewFileModal";
import RenameFileModal from "../../components/modals/RenameFileModal";
import UpdateFunctionModal from "../../components/modals/UpdateFunctionModal";

function FunctionDetail() {
	const { id } = useParams<{ id: string }>();
	const [functionDetail, setFunctionDetail] = useState<FunctionData | null>(
		null
	);
	const [code, setCode] = useState<string>("");
	const editorRef = useRef<any>(null);
	const [files, setFiles] = useState<any[]>([]);
	const [selectedFile, setSelectedFile] = useState<string>("main.py");
	const [output, setOutput] = useState<string>("");
	const autosaveTimer = useRef<NodeJS.Timeout | null>(null);
	
	// Modal states
	const [isNewFileModalOpen, setIsNewFileModalOpen] = useState<boolean>(false);
	const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
	const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
	const [newFileName, setNewFileName] = useState<string>("");
	const [oldFileName, setOldFileName] = useState<string>("");

    
	useEffect(() => {
		fetchFunctionDetail();
	}, [id]);

	const fetchFunctionDetail = async () => {
		if (!id) return;
		const func = await BackendService.getFunction(parseInt(id));
		setFunctionDetail(func);
		loadFunctionFiles(parseInt(id));
	};

	const loadFunctionFiles = async (functionId: number) => {
		try {
			const fileData = await BackendService.getFunctionFiles(functionId);
			setFiles(fileData);

			// Find main.py or use the first file
			const mainFile =
				fileData.find((f: any) => f.name === "main.py") ||
				(fileData.length > 0 ? fileData[0] : null);

			if (mainFile) {
				setSelectedFile(mainFile.name);
				setCode(mainFile.content || "");
				if (editorRef.current) {
					editorRef.current.getModel().setValue(mainFile.content || "");
				}
			} else {
				// No files exist, create a default main.py
				const defaultCode = "# Write your code here\n\nprint('Hello World!')";
				setCode(defaultCode);
				setSelectedFile("main.py");
				if (editorRef.current) {
					editorRef.current.getModel().setValue(defaultCode);
				}

				// Create the file on the server
				createNewFile("main.py", defaultCode);
			}
		} catch (error) {
			console.error("Error loading files:", error);
			setFiles([]);

			// Set up default file if no files could be loaded
			const defaultCode = "# Write your code here\n\nprint('Hello World!')";
			setCode(defaultCode);
			setSelectedFile("main.py");
			if (editorRef.current) {
				editorRef.current.getModel().setValue(defaultCode);
			}
		}
	};

	const handleEditorChange = (value: string | undefined) => {
		setCode(value || "");
		
		if (autosaveTimer.current) {
			clearTimeout(autosaveTimer.current);
		}
		autosaveTimer.current = setTimeout(() => {
			autosaveFunction();
		}, 2000);
	};

	const handleEditorDidMount = (editor: any) => {
		editorRef.current = editor;
	};
	
	const autosaveFunction = async () => {
		if (!id || !selectedFile || !code) {
			return Promise.resolve();
		}
		
		try {
			await BackendService.updateFunctionFile(
				parseInt(id),
				selectedFile,
				code
			);
			
			// Update the file in our list with the new content
			setFiles((prevFiles) =>
				prevFiles.map((file) =>
					file.name === selectedFile ? { ...file, content: code } : file
				)
			);
			return Promise.resolve();
		} catch (error) {
			console.error("Autosave failed:", error);
			return Promise.reject(error);
		}
	};

	const runCode = () => {
		if (!id) {
			setOutput("No function selected.");
			return;
		}

		// Save before running
		autosaveFunction().then(() => {
			BackendService.executeFunction(parseInt(id))
				.then((data) => {
					setOutput(data.output || "No output received.");
				})
				.catch((error) => {
					console.error("Error:", error);
					setOutput(`Error executing function: ${error.message}`);
				});
		});
	};

	// Function to select a file
	const selectFile = (fileName: string) => {
		if (!id) return;

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
	};

	// Function to create a new file
	const createNewFile = async (filename = newFileName, content = "# New file\n") => {
		if (!id || !filename) return;

		try {
			await BackendService.updateFunctionFile(parseInt(id), filename, content);
			// Reload files to get the new file with its ID
			loadFunctionFiles(parseInt(id));
			setNewFileName("");
			setIsNewFileModalOpen(false);
		} catch (error) {
			console.error("Error creating file:", error);
			alert("Failed to create file");
		}
	};

	// Function to delete a file
	const deleteFile = (fileName: string) => {
		if (!id) return;

		// Confirm before deleting
		if (!window.confirm(`Are you sure you want to delete ${fileName}?`)) {
			return;
		}

		// Don't allow deleting the only file
		if (files.length <= 1) {
			alert("You cannot delete the only file in your function.");
			return;
		}

		BackendService.deleteFile(parseInt(id), fileName)
			.then(() => {
				// If the deleted file was selected, select another file
				if (selectedFile === fileName) {
					const newSelectedFile = files.find((f) => f.name !== fileName);
					if (newSelectedFile) {
						selectFile(newSelectedFile.name);
					}
				}
				// Reload files to reflect changes
				loadFunctionFiles(parseInt(id));
			})
			.catch((error) => {
				console.error("Error deleting file:", error);
				alert("Failed to delete file");
			});
	};

	// Function to handle file renaming
	const handleRenameFile = async (oldName: string, newName: string) => {
		if (!id) return;
		try {
			await BackendService.renameFile(parseInt(id), oldName, newName);
			loadFunctionFiles(parseInt(id));
			setIsRenameModalOpen(false);
		} catch (error) {
			console.error("Error renaming file:", error);
			alert("Failed to rename file");
		}
	};

	const updateFunction = async (updatedData: Partial<FunctionData>) => {
		if (!id) return;
		
		try {
			const updatedFunction = await BackendService.updateFunction(
				parseInt(id),
				updatedData
			);
			setFunctionDetail(updatedFunction);
			setIsUpdateModalOpen(false);
			alert("Function updated successfully!");
		} catch (error) {
			console.error("Error updating function:", error);
			alert("Failed to update function");
		}
	};

	const renderHeader = () => {
		if (functionDetail?.namespace) {
			return (
				<div className="flex justify-between items-center">
					<div>
						<h1 className="text-2xl font-bold">
							📂 {functionDetail.namespace.name}
						</h1>
						<h2 className="text-xl font-semibold">🚀 {functionDetail.name}</h2>
					</div>
					<button
						onClick={() => setIsUpdateModalOpen(true)}
						className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded flex items-center"
					>
						<svg
							className="w-4 h-4 mr-2"
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
						Modify Function
					</button>
				</div>
			);
		}
		return (
			<div className="flex justify-between items-center">
				<h1 className="text-2xl font-bold mb-4">{functionDetail?.name}</h1>
				<button
					onClick={() => setIsUpdateModalOpen(true)}
					className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded flex items-center"
				>
					<svg
						className="w-4 h-4 mr-2"
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
					Modify Function
				</button>
			</div>
		);
	};

	return (
		<div className="p-4">
			{renderHeader()}
			<hr className="my-4" />
			
			<div className="flex gap-4 h-[calc(80vh-16rem)]">
				{/* File Manager */}
				<div className="w-1/5 bg-gray-800 rounded-xl shadow-md p-4">
					<div className="flex justify-between items-center mb-4">
						<h2 className="text-xl font-bold text-gray-100">Files</h2>
						<button
							className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md"
							onClick={() => setIsNewFileModalOpen(true)}
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
										<span className="text-gray-100">
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
				</div>
				
				{/* Editor and Console */}
				<div className="flex-1">
					<div className="flex justify-between items-center mb-4">
						<h2 className="text-xl font-bold text-gray-100">
							Editing: {selectedFile}
						</h2>
						<div className="flex items-center space-x-2">
							<button
								className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md flex items-center"
								onClick={autosaveFunction}
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
					
					{/* Editor */}
					<div className="h-[70%] mb-4">
						<Editor
							theme="vs-dark"
							height="100%"
							defaultLanguage="python"
							value={code}
							onChange={handleEditorChange}
							onMount={handleEditorDidMount}
							options={{
								readOnly: false,
								minimap: { enabled: false },
								scrollBeyondLastLine: false,
								fontSize: 14,
								tabSize: 4,
							}}
						/>
					</div>
					
					{/* Console Output */}
					<div className="bg-gray-700 rounded-md p-4 h-[30%] overflow-y-auto">
						<h3 className="text-lg font-semibold text-gray-100 mb-2">Output:</h3>
						<pre className="text-gray-300 font-mono text-sm whitespace-pre-wrap">
							{output || "No output to display. Run your code to see results."}
						</pre>
					</div>
				</div>
			</div>
			
			{/* New File Modal */}
			<NewFileModal
				isOpen={isNewFileModalOpen}
				onClose={() => setIsNewFileModalOpen(false)}
				onCreateFile={(fileName) => createNewFile(fileName)}
			/>

			{/* Rename File Modal */}
			<RenameFileModal
				isOpen={isRenameModalOpen}
				onClose={() => setIsRenameModalOpen(false)}
				currentFileName={oldFileName}
				onRenameFile={(oldName, newName) => handleRenameFile(oldName, newName)}
			/>
			
			{/* Update Function Modal */}
			<UpdateFunctionModal
				isOpen={isUpdateModalOpen}
				onClose={() => setIsUpdateModalOpen(false)}
				functionData={functionDetail}
				onUpdateFunction={updateFunction}
			/>
		</div>
	);
}

export default FunctionDetail;
