import React, { useState, useEffect } from "react";
import Modal from "../Modal";
import { cancelBtnClass } from "../Modal";
import { TriggerLog } from "../../../types/Prisma";
import TriggerLogCard from "./TriggerLogCard";
import { deleteSpecificLog } from "../../../services/backend.function.logs";

interface TriggerLogsModalProps {
	isOpen: boolean;
	onClose: () => void;
	logs: TriggerLog[];
	isLoading?: boolean;
	functionId: number;
	onRefresh: () => void;
}

function TriggerLogsModal({
	isOpen,
	onClose,
	logs,
	isLoading = false,
	functionId,
	onRefresh,
}: TriggerLogsModalProps) {
	const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});

	useEffect(() => {
		if (logs.length > 0) {
			const sortedLogs = [...logs].sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);
			setExpandedLogs((prev) => {
				if (Object.keys(prev).length === 0 && sortedLogs.length > 0) {
					return { [sortedLogs[0].id]: true };
				}
				return prev;
			});
		}
	}, [logs]);

	const toggleExpand = (logId: number) => {
		setExpandedLogs((prev) => ({ ...prev, [logId]: !prev[logId] }));
	};

	const handleDeleteLog = async (logId: number) => {
		const res = await deleteSpecificLog(functionId, logId);
		if (res.status === "OK") onRefresh();
	};

	const sortedLogs = [...logs].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
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
				{sortedLogs.length > 0 ? (
					<div className="space-y-2">
						{sortedLogs.map((log) => (
							<TriggerLogCard
								key={log.id}
								log={log}
								expanded={!!expandedLogs[log.id]}
								onToggle={toggleExpand}
								onDelete={() => handleDeleteLog(log.id)}
							/>
						))}
					</div>
				) : (
					<div className="text-center py-10">
						<p className="text-sm font-medium text-text/60">No execution logs</p>
						<p className="text-xs text-muted mt-1">
							This trigger hasn't been executed yet or logs are not available.
						</p>
					</div>
				)}

				<div className="flex justify-end pt-4 border-t border-white/[0.07]">
					<button onClick={onClose} className={cancelBtnClass}>
						Close
					</button>
				</div>
			</div>
		</Modal>
	);
}

export default TriggerLogsModal;
