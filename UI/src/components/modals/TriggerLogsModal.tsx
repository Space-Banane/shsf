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

	const getStatusDisplay = (status: string) => {
		switch (status) {
			case "success":
				return { icon: "✅", color: "text-green-400", bg: "bg-green-500/10" };
			case "error":
				return { icon: "⚠️", color: "text-red-400", bg: "bg-red-500/10" };
			case "failed":
				return { icon: "❌", color: "text-red-400", bg: "bg-red-500/10" };
			case "running":
				return { icon: "⏳", color: "text-yellow-400", bg: "bg-yellow-500/10" };
			default:
				return { icon: "❔", color: "text-gray-400", bg: "bg-gray-500/10" };
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
					<div className="text-center py-8">
						<div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
						<p className="text-gray-400">Loading execution logs...</p>
					</div>
				) : sortedLogs.length > 0 ? (
					<div className="space-y-3">
						{sortedLogs.map((log) => (
							<div
								key={log.id}
								className="bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden hover:border-primary/30 transition-all duration-300"
							>
								{/* Log Header */}
								<div
									className="p-4 cursor-pointer hover:bg-gray-800/70 transition-all duration-300"
									onClick={() => toggleExpand(log.id)}
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<div className="w-8 h-8 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
												<span className="text-sm">📋</span>
											</div>
											<div>
												<p className="text-white font-medium text-sm">
													{new Date(log.createdAt).toLocaleString()}
												</p>
												<p className="text-gray-400 text-xs">
													Execution #{log.id}
												</p>
											</div>
										</div>
										<div className="flex items-center gap-2">
											<span
												className={`transform transition-transform duration-300 ${
													expandedLogs[log.id] ? "rotate-90" : ""
												} text-primary`}
											>
												▶
											</span>
										</div>
									</div>
								</div>

								{/* Expanded Log Content */}
								{expandedLogs[log.id] && (
									<div className="border-t border-gray-700/50 p-4 space-y-4">
										{/* Payload Section */}
										{log.result && (
											<div className="space-y-2">
												<h4 className="text-sm font-semibold text-primary flex items-center gap-2">
													<span>📊</span> Payload
												</h4>
												<div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3 max-h-60 overflow-auto">
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

										{/* Output Logs Section */}
										{log.logs && (
											<div className="space-y-2">
												<h4 className="text-sm font-semibold text-primary flex items-center gap-2">
													<span>📝</span> Output Logs
												</h4>
												<div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3 max-h-60 overflow-auto">
													<pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap">
														{log.logs}
													</pre>
												</div>
											</div>
										)}

										{/* Timing Details */}
										{log.result && (
											<div className="space-y-2">
												<h4 className="text-sm font-semibold text-primary flex items-center gap-2">
													<span>⏱️</span> Timing Details
												</h4>
												<div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3">
													{JSON.parse(log.result)?.tooks?.map(
														(took: any, index: number) => (
															<div
																key={index}
																className="flex items-center justify-between py-1 border-b border-gray-700/30 last:border-b-0"
															>
																<span className="text-gray-400 text-sm">
																	{took.description}
																</span>
																<span className="text-white text-sm font-mono">
																	{took.value} ms
																</span>
															</div>
														)
													) || (
														<p className="text-gray-400 text-xs">
															No timing details available
														</p>
													)}
												</div>
											</div>
										)}

										{/* Execution Result */}
										{log.result && (
											<div className="space-y-2">
												<h4 className="text-sm font-semibold text-primary flex items-center gap-2">
													<span>🎯</span> Execution Result
												</h4>
												<div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3 max-h-60 overflow-auto">
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

										{/* Timestamps */}
										<div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-700/30">
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
						))}
					</div>
				) : (
					<div className="text-center py-12">
						<div className="text-4xl mb-4">📋</div>
						<h3 className="text-lg font-semibold text-gray-300 mb-2">
							No Execution Logs
						</h3>
						<p className="text-gray-500 text-sm">
							This trigger hasn't been executed yet or logs are not available.
						</p>
					</div>
				)}

				{/* Close Button */}
				<div className="flex justify-end pt-4 border-t border-gray-700/50">
					<button
						onClick={onClose}
						className="px-6 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg font-medium transition-all duration-300 border border-gray-600/50 hover:border-gray-500"
					>
						Close
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default TriggerLogsModal;
