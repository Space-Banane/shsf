import { useCallback, useEffect, useState } from "react";
import { getLogsByFuncId } from "../services/backend.functions";
import type { TriggerLog } from "../types/Prisma";

const POLL_INTERVAL_MS = 10_000;

/**
 * Loads a function's execution logs while they are being watched: the logs
 * card is expanded or the full log modal is open. Polling pauses while the tab
 * is hidden. Background refreshes never toggle the loading spinner, so only
 * the initial load and manual refreshes show it.
 */
export function useFunctionLogs(
	functionId: number | null,
	executionSettled: boolean,
	modalOpen: boolean,
) {
	const [logs, setLogs] = useState<TriggerLog[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expanded, setExpanded] = useState(false);
	const [documentHidden, setDocumentHidden] = useState(() => document.hidden);

	const fetchLogs = useCallback(
		async (showSpinner: boolean) => {
			if (functionId === null) return;

			if (showSpinner) setIsLoading(true);
			try {
				const logsData = await getLogsByFuncId(functionId);
				if (logsData.status === "OK") {
					setLogs(logsData.data);
					setError(null);
				} else {
					console.error("Error fetching logs:", logsData.message);
					setError(logsData.message || "Could not load execution logs.");
				}
			} catch (fetchError) {
				console.error("Error fetching logs:", fetchError);
				setError("Could not load execution logs.");
			} finally {
				if (showSpinner) setIsLoading(false);
			}
		},
		[functionId],
	);

	/** Manual refresh; shows the loading spinner. */
	const refresh = useCallback(() => fetchLogs(true), [fetchLogs]);
	/** Background refresh; never toggles the loading spinner. */
	const refreshSilently = useCallback(() => fetchLogs(false), [fetchLogs]);

	useEffect(() => {
		setError(null);
	}, [functionId]);

	useEffect(() => {
		const onVisibilityChange = () => setDocumentHidden(document.hidden);
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () =>
			document.removeEventListener("visibilitychange", onVisibilityChange);
	}, []);

	const watching = modalOpen || expanded;

	useEffect(() => {
		if (functionId === null || !watching || documentHidden) return;

		void refresh();
		const interval = setInterval(
			() => void refreshSilently(),
			POLL_INTERVAL_MS,
		);
		return () => clearInterval(interval);
	}, [functionId, watching, documentHidden, refresh, refreshSilently]);

	// A settled run is an on-demand refresh, so it survives a closed log view.
	useEffect(() => {
		if (executionSettled) void refreshSilently();
	}, [executionSettled, refreshSilently]);

	return {
		logs,
		isLoading,
		error,
		refresh,
		refreshSilently,
		expanded,
		setExpanded,
	};
}
