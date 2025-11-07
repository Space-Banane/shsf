import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { TriggerLog } from "../../types/Prisma";
import TriggerLogCard from "./TriggerLogCard";

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
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
								<TriggerLogCard
									key={log.id}
									log={log}
									expanded={!!expandedLogs[log.id]}
									onToggle={toggleExpand}
								/>
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
