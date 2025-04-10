import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { TriggerLog } from "../../types/Prisma";

interface TriggerLogsModalProps {
	isOpen: boolean;
	onClose: () => void;
	logs: TriggerLog[];
	isLoading?: boolean;
}

function TriggerLogsModal({
	isOpen,
	onClose,
	logs,
	isLoading = false,
}: TriggerLogsModalProps) {
	const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});

	// Sort logs by date (newest first) and expand only the latest log
	useEffect(() => {
		if (logs.length > 0) {
			const sortedLogs = [...logs].sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);

			// Expand only the latest log
			const newExpandedState: Record<number, boolean> = {};
			if (sortedLogs.length > 0) {
				newExpandedState[sortedLogs[0].id] = true;
			}

			setExpandedLogs(newExpandedState);
		}
	}, [logs]);

	// Toggle expanded state for a log
	const toggleExpand = (logId: number) => {
		setExpandedLogs((prev) => ({
			...prev,
			[logId]: !prev[logId],
		}));
	};

	// Get status icon and color based on status
	const getStatusDisplay = (status: string) => {
		switch (status) {
			case "success":
				return { icon: "✅", color: "text-green-500" };
			case "error":
				return { icon: "⚠️", color: "text-red-500" };
			case "failed":
				return { icon: "❌", color: "text-red-500" };
			case "running":
				return { icon: "⏳", color: "text-yellow-500" };
			default:
				return { icon: "❔", color: "text-gray-400" };
		}
	};

	// Sort logs by date (newest first)
	const sortedLogs = [...logs].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Trigger Execution Logs"
			maxWidth="xl"
			isLoading={isLoading}
		>
			<div className="space-y-4">
				{isLoading ? (
					<p className="text-gray-400 text-center py-4">Loading logs...</p>
				) : sortedLogs.length > 0 ? (
					sortedLogs.map((log) => (
						<div
							key={log.id}
							className="border border-gray-700 rounded-lg bg-gray-900 overflow-hidden"
						>
							<div
								className="p-3 bg-gray-800 flex justify-between items-center cursor-pointer hover:bg-gray-750"
								onClick={() => toggleExpand(log.id)}
							>
								<div className="flex-1">
									<div className="flex items-center">
										<span className="font-medium text-white">
											{log.createdAt.toLocaleString()}
										</span>
									</div>
								</div>
								<div className="text-xl text-gray-400">
									{expandedLogs[log.id] ? "▼" : "▶"}
								</div>
							</div>

							{expandedLogs[log.id] && (
								<div className="p-3 border-t border-gray-700">
									{log.result && (
										<div className="mb-3">
											<h4 className="text-white text-sm font-medium mb-1">
												Payload
											</h4>
											<div className="bg-gray-950 p-3 rounded max-h-60 overflow-auto">
												<pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap">
													{JSON.stringify(
														JSON.parse(log.result).payload,
														null,
														2
													)}
												</pre>
											</div>
										</div>
									)}
									{log.logs && (
										<div className="mb-3">
											<h4 className="text-white text-sm font-medium mb-1">
												Output Logs:
											</h4>
											<div className="bg-gray-950 p-3 rounded max-h-60 overflow-auto">
												<pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap">
													{log.logs}
												</pre>
											</div>
										</div>
									)}

									{log.result && (
										<div className="mb-2">
											<h4 className="text-white text-base font-medium mb-1">
												Timing Details:
											</h4>
											{JSON.parse(log.result)?.tooks?.map(
												(took: any, index: number) => (
													<div
														key={index}
														className="text-gray-300"
													>
														<span className="text-gray-400 text-sm">
															{took.description}:
														</span>{" "}
														{took.value} ms
													</div>
												)
											) || (
												<div className="text-gray-400 text-xs font-mono">
													No timing details available
												</div>
											)}
										</div>
									)}

									{log.result && (
										<div className="mb-2">
											<h4 className="text-white text-sm font-medium mb-1">
												Execution Result:
											</h4>
											<div className="bg-gray-950 p-3 rounded max-h-60 overflow-auto">
												<pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap">
													{(() => {
														try {
															const parsedResult = JSON.parse(log.result);
															return JSON.stringify(
																{
																	...parsedResult,
																	payload: undefined,
																	tooks: undefined,
																	exit_code: undefined,
																}.output || {},
																null,
																2
															);
														} catch (error) {
															return "Invalid JSON format in result";
														}
													})()}
												</pre>
											</div>
										</div>
									)}

									<div className="flex justify-between text-xs text-gray-400 mt-2">
										<span>
											Created: {new Date(log.createdAt).toLocaleString()}
										</span>
										{log.updatedAt && (
											<span>
												Updated: {new Date(log.updatedAt).toLocaleString()}
											</span>
										)}
									</div>
								</div>
							)}
						</div>
					))
				) : (
					<p className="text-gray-400 text-center py-8">No logs available</p>
				)}

				<div className="flex justify-end mt-4">
					<button
						onClick={onClose}
						className="bg-grayed hover:bg-grayed/70 text-white px-4 py-2 rounded"
					>
						Close
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default TriggerLogsModal;
