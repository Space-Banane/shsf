import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";

function RunnerPage() {
	const [code, setCode] = useState<string>("");
	const [output, setOutput] = useState<string>("");
	const [image, setImage] = useState<string>(""); // Updated to load last_image
	const [functionName, setFunctionName] = useState<string>("");
	const [functions, setFunctions] = useState<any[]>([]); // Updated to store metadata objects
	const [allowHttp, setAllowHttp] = useState<boolean>(false); // State for the selected function's HTTP flag
	const editorRef = useRef<any>(null);
	const autosaveTimer = useRef<NodeJS.Timeout | null>(null); // Timer reference for autosave

	const refreshFunctionList = () => {
		fetch("http://localhost:5000/listfunctions")
			.then((response) => response.json())
			.then((data) => {
				if (data.functions) {
					setFunctions(data.functions);
				}
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
			// Cleanup the timer on component unmount
			if (autosaveTimer.current) {
				clearTimeout(autosaveTimer.current);
			}
		};
	}, []);

	function handleEditorChange(value: any, event: any) {
		setCode(value);

		// Reset the autosave timer
		if (autosaveTimer.current) {
			clearTimeout(autosaveTimer.current);
		}
		autosaveTimer.current = setTimeout(() => {
			autosaveFunction();
		}, 3000); // Trigger autosave after 3 seconds of inactivity
	}

	function handleEditorDidMount(editor: any, monaco: any) {
		editorRef.current = editor;
	}

	function handleEditorWillMount(monaco: any) {}
	function handleEditorValidation(markers: any) {}

	function runCode() {
		fetch("http://localhost:5000/runcode", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: functionName, image: image }), // Removed 'code' from the request body
		})
			.then((response) => response.json())
			.then((data) => {
				console.log("Response from server:", data);
				if (data.error) {
					setOutput(data.error);
				} else {
					setOutput(data.message);
				}
			})
			.catch((error) => {
				console.error("Error:", error);
			});
	}

	function loadFunction(name: string) {
		fetch("http://localhost:5000/getfunction", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: name }),
		})
			.then((response) => response.json())
			.then((data) => {
				if (data.code && data.metadata) {
					setFunctionName(name);
					setCode(data.code);
					setImage(data.metadata.last_image || ""); // Load last_image
					setAllowHttp(data.metadata.allow_http || false); // Load allow_http
					// Update the editor model if it's available.
					if (editorRef.current) {
						editorRef.current.getModel().setValue(data.code);
					}
				} else {
					alert(data.error || "Failed to load function.");
				}
			})
			.catch((error) => {
				console.error("Error:", error);
			});
	}

	function saveFunction() {
		fetch("http://localhost:5000/savefunction", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ code: code, name: functionName }),
		})
			.then((response) => response.json())
			.then((data) => {
				console.log("Save response:", data);
				alert(data.message || data.error);
				refreshFunctionList();
			})
			.catch((error) => {
				console.error("Error:", error);
			});
	}

	function deleteFunction() {
		fetch("http://localhost:5000/deletefunction", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: functionName }),
		})
			.then((response) => response.json())
			.then((data) => {
				console.log("Delete response:", data);
				alert(data.message || data.error);
				refreshFunctionList();
			})
			.catch((error) => {
				console.error("Error:", error);
			});
	}

	function createFunction() {
		fetch("http://localhost:5000/createfunction", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: functionName }),
		})
			.then((response) => response.json())
			.then((data) => {
				console.log("Create response:", data);
				alert(data.message || data.error);
				refreshFunctionList();
			})
			.catch((error) => {
				console.error("Error:", error);
			});
	}

	function toggleAllowHttp(checked: boolean) {
		fetch("http://localhost:5000/setallowhttp", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: functionName, allow: checked }),
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.message) {
					setAllowHttp(checked); // Update the state only if the backend call succeeds
				} else {
					alert(data.error || "Failed to update HTTP setting.");
				}
			})
			.catch((err) => {
				console.error("Error setting allow_http:", err);
				alert("An error occurred while updating the HTTP setting.");
			});
	}

	function autosaveFunction() {
		if (functionName && code) {
			fetch("http://localhost:5000/savefunction", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ code: code, name: functionName }),
			})
				.then((response) => response.json())
				.then((data) => {
					console.log("Autosave response:", data);
					if (data.error) {
						console.error("Autosave error:", data.error);
					}
				})
				.catch((error) => {
					console.error("Autosave failed:", error);
				});
		}
	}

	return (
		<div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8 flex gap-4">
			<div className="w-1/4 bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 flex flex-col h-[90vh]">
				<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Function Manager</h2>
				<div className="flex-grow overflow-auto mb-4">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Available Functions</h3>
					{functions.length > 0 ? (
						<ul className="border rounded dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
							{functions.map((func, index) => (
								<li 
									key={index} 
									className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-900 dark:text-gray-100"
									onClick={() => loadFunction(func.name)}
								>
									<div>
										<strong>{func.name}</strong>
										<p className="text-sm text-gray-500 dark:text-gray-400">
											Created: {new Date(func.created_at).toLocaleString()}
										</p>
										<p className="text-sm text-gray-500 dark:text-gray-400">
											Last Saved: {new Date(func.last_saved).toLocaleString()}
										</p>
									</div>
								</li>
							))}
						</ul>
					) : (
						<p className="text-gray-500 dark:text-gray-400">No functions available</p>
					)}
				</div>
				<div className="border-t pt-4 dark:border-gray-700">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Function Controls</h3>
					<input
						type="text"
						placeholder="Function Name"
						className="p-2 border border-gray-300 rounded w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
						value={functionName}
						onChange={(e) => setFunctionName(e.target.value)}
					/>
					<label className="flex items-center space-x-2 mb-2">
						<input type="checkbox" checked={allowHttp} onChange={(e) => toggleAllowHttp(e.target.checked)} />
						<span className="text-gray-900 dark:text-gray-100">Enable HTTP for this Function</span>
					</label>
					<div className="grid grid-cols-1 gap-2 mt-2">
						<button
							className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
							onClick={createFunction}
						>
							Create New
						</button>
						<button
							className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
							onClick={saveFunction}
						>
							Save Changes
						</button>
						<button
							className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
							onClick={deleteFunction}
						>
							Delete Function
						</button>
					</div>
				</div>
			</div>
			<div className="w-3/4 bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 h-[90vh] flex flex-col">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
					Code Editor
				</h1>
				<div className="flex-grow mb-4">
					<Editor
						theme="vs-dark"
						height="100%"
						defaultLanguage="python"
						defaultValue={code}
						onChange={(newValue,event) => {setCode(newValue || ""); handleEditorChange(newValue, event)}}
						onMount={handleEditorDidMount}
						beforeMount={handleEditorWillMount}
						onValidate={handleEditorValidation}
					/>
				</div>
				<div className="border-t pt-4 dark:border-gray-700">
					<div className="flex gap-4 mb-4">
						<select
							className="p-2 border border-gray-300 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex-grow"
							value={image} // Bind to the last_image
							onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setImage(e.target.value)}
						>
							<option value="NOIMAGE" disabled={true} className="text-gray-500">
								Select a runtime
							</option>
							<option value="python:3.9">Python 3.9</option>
							<option value="python:3.10">Python 3.10</option>
							<option value="python:3.11">Python 3.11</option>
							<option value="python:latest">Python latest</option>
						</select>
						<button 
							className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded" 
							onClick={runCode}
						>
							Run Code
						</button>
					</div>
					<div className="bg-gray-100 dark:bg-gray-700 rounded-md p-4 max-h-40 overflow-y-auto whitespace-pre-wrap">
						<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Output:</h3>
						{output || <span className="text-gray-500 dark:text-gray-400">No output to display</span>}
					</div>
				</div>
			</div>
		</div>
	);
}

export default RunnerPage;
