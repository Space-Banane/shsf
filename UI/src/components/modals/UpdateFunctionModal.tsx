import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { updateFunction } from "../../services/backend.functions";
import { Image, ImagesAsArray, XFunction } from "../../types/Prisma";

interface UpdateFunctionModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	functionData: XFunction | null;
}

function UpdateFunctionModal({
	isOpen,
	onClose,
	onSuccess,
	functionData,
}: UpdateFunctionModalProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [image, setImage] = useState<Image>("python:3.9");
	const [maxRam, setMaxRam] = useState<number | undefined>();
	const [timeout, setTimeout] = useState<number | undefined>();
	const [allowHttp, setAllowHttp] = useState<boolean>(false);
	const [priority, setPriority] = useState<number | undefined>();
	const [startupFile, setStartupFile] = useState<string | undefined>();
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	// Initialize form with existing function data
	useEffect(() => {
		if (functionData && isOpen) {
			setName(functionData.name);
			setDescription(functionData.description || "");
			setImage(functionData.image as Image);
			setMaxRam(functionData.max_ram);
			setTimeout(functionData.timeout);
			setAllowHttp(functionData.allow_http || false);
			setPriority(functionData.priority);
			setStartupFile(functionData.startup_file || "");
		}
	}, [functionData, isOpen]);

	const handleSubmit = async () => {
		if (!functionData) {
			setError("No function data available");
			return;
		}

		if (!name.trim()) {
			setError("Please enter a function name");
			return;
		}

		setError("");
		setIsLoading(true);
		
		try {
			const response = await updateFunction(functionData.id, {
				name,
				description,
				image,
				startup_file: startupFile,
				settings: {
					max_ram: maxRam,
					timeout,
					allow_http: allowHttp,
					priority,
				},
			});

			if (response.status === "OK") {
				onSuccess();
				onClose();
			} else {
				setError("Error updating function: " + response.message);
			}
		} catch (err) {
			setError("An unexpected error occurred");
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		if (!isLoading) {
			onClose();
			setError("");
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Update Function Settings" maxWidth="lg" isLoading={isLoading}>
			<div className="space-y-4">
				{error && <div className="bg-red-500/20 border border-red-500 p-2 rounded-md text-red-300">{error}</div>}
				
				<div className="space-y-1">
					<label className="text-sm text-gray-300" title="The name of your function">Function Name</label>
					<input
						type="text"
						placeholder="Function Name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md"
						disabled={isLoading}
					/>
				</div>
				
				<div className="space-y-1">
					<label className="text-sm text-gray-300" title="A brief description of what the function does">Description</label>
					<textarea
						placeholder="Function Description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md"
						disabled={isLoading}
					/>
				</div>
				
				<div className="space-y-1">
					<label className="text-sm text-gray-300" title="The runtime environment for your function">Runtime Image</label>
					<select
						value={image}
						onChange={(e) => setImage(e.target.value as Image)}
						className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md"
						disabled={isLoading}
					>
						{ImagesAsArray.map((img) => (
							<option key={img} value={img}>
								{img}
							</option>
						))}
					</select>
				</div>
				
				<div className="space-y-1">
					<label className="text-sm text-gray-300" title="Maximum memory allocation in megabytes">Max RAM (MB)</label>
					<input
						type="number"
						placeholder="Max RAM (MB)"
						value={maxRam || ""}
						onChange={(e) => setMaxRam(Number(e.target.value))}
						className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md"
						disabled={isLoading}
					/>
				</div>
				
				<div className="space-y-1">
					<label className="text-sm text-gray-300" title="Maximum execution time in seconds">Timeout (seconds)</label>
					<input
						type="number"
						placeholder="Timeout (seconds)"
						value={timeout || ""}
						onChange={(e) => setTimeout(Number(e.target.value))}
						className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md"
						disabled={isLoading}
					/>
				</div>
				
				<div className="flex items-center">
					<input
						type="checkbox"
						checked={allowHttp}
						onChange={(e) => setAllowHttp(e.target.checked)}
						className="mr-2"
						disabled={isLoading}
						id="allow-http"
					/>
					<label htmlFor="allow-http" className="text-white" title="Allow the function to make HTTP requests">Allow HTTP</label>
				</div>
				
				<div className="space-y-1">
					<label className="text-sm text-gray-300" title="Function execution priority (higher values = higher priority)">Priority</label>
					<input
						type="number"
						placeholder="Priority"
						value={priority || ""}
						onChange={(e) => setPriority(Number(e.target.value))}
						className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md"
						disabled={isLoading}
					/>
				</div>
				
				<div className="space-y-1">
					<label className="text-sm text-gray-300" title="The main file that will be executed when your function runs">Startup File</label>
					<input
						type="text"
						placeholder="Startup File"
						value={startupFile || ""}
						onChange={(e) => setStartupFile(e.target.value)}
						className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md"
						disabled={isLoading}
					/>
				</div>
				
				<div className="flex justify-end space-x-3 mt-6">
					<button
						onClick={handleClose}
						className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors"
						disabled={isLoading}
					>
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
						disabled={isLoading}
					>
						Update
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default UpdateFunctionModal;
