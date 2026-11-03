import { useCallback, useEffect, useState } from "react";
import { getLogsByFuncId } from "../services/backend.functions";
import type { TriggerLog } from "../types/Prisma";

const POLL_INTERVAL_MS = 10_000;

/**
 * Loads a function's execution logs, polling while the full log modal is
 * closed. Also refreshes once a run settles so the new entry shows up.
 */
export function useFunctionLogs(
	functionId: number | null,
	executionSettled: boolean,
) {
	const [logs, setLogs] = useState<TriggerLog[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);

	const refresh = useCallback(async () => {
		if (functionId === null) return;

		setIsLoading(true);
		try {
			const logsData = await getLogsByFuncId(functionId);
			if (logsData.status === "OK") {
				setLogs(logsData.data);
			} else {
				console.error("Error fetching logs:", logsData.message);
			}
		} catch (error) {
			console.error("Error fetching logs:", error);
		} finally {
			setIsLoading(false);
		}
	}, [functionId]);

	useEffect(() => {
		if (functionId === null || modalOpen) return;
		void refresh();
		const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
		return () => clearInterval(interval);
	}, [functionId, modalOpen, refresh]);

	useEffect(() => {
		if (executionSettled && !modalOpen) void refresh();
	}, [executionSettled, modalOpen, refresh]);

	return { logs, isLoading, refresh, modalOpen, setModalOpen };
}
