import { useCallback, useEffect, useRef, useState } from "react";
import {
	executeFunction,
	executeFunctionStreaming,
} from "../services/backend.functions";
import type {
	PopupResult,
	RunMode,
	TimingEntry,
	ValueResultContent,
} from "../types/FunctionExecution";
import {
	classifyPopupResult,
	findTotalExecutionTime,
	parseRunParams,
} from "../utils/functionExecution";

interface Options {
	functionId: number | null;
	/** When false, results are only shown in the console, never in modals. */
	resultModalsEnabled: boolean;
}

/**
 * Owns everything about running a function from the editor: run settings,
 * console output, timing, exit code and the result popups. Aborts any
 * in-flight execution when the component unmounts.
 */
export function useFunctionExecution({
	functionId,
	resultModalsEnabled,
}: Options) {
	const [running, setRunning] = useState(false);
	const [runMode, setRunMode] = useState<RunMode>("streaming");
	const [consoleOutput, setConsoleOutput] = useState("");
	const [exitCode, setExitCode] = useState<number | null>(null);
	const [executionTime, setExecutionTime] = useState<number | null>(null);
	const [realTimeTaken, setRealTimeTaken] = useState<number | null>(null);
	const [tooks, setTooks] = useState<TimingEntry[]>([]);
	const [functionResult, setFunctionResult] = useState<unknown>(null);
	const [showRunParams, setShowRunParams] = useState(false);
	const [runParams, setRunParams] = useState("");
	const [popup, setPopup] = useState<PopupResult | null>(null);
	const [valueResult, setValueResult] = useState<ValueResultContent | null>(
		null,
	);

	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const stopTimer = useCallback(() => {
		if (timerRef.current) clearInterval(timerRef.current);
		timerRef.current = null;
	}, []);

	const startTimer = useCallback(() => {
		const startTime = Date.now();
		setExecutionTime(0);
		timerRef.current = setInterval(() => {
			setExecutionTime((Date.now() - startTime) / 1000);
		}, 50);
	}, []);

	useEffect(
		() => () => {
			abortRef.current?.abort();
			if (timerRef.current) clearInterval(timerRef.current);
			timerRef.current = null;
		},
		[],
	);

	useEffect(() => {
		if (resultModalsEnabled) return;
		setPopup(null);
		setValueResult(null);
	}, [resultModalsEnabled]);

	const recordTimings = useCallback((took: TimingEntry[]) => {
		setTooks(took);
		const total = findTotalExecutionTime(took);
		if (total !== null) setRealTimeTaken(total);
	}, []);

	const run = useCallback(async () => {
		if (functionId === null) return;

		setRunning(true);
		setConsoleOutput("Executing code...");
		setExitCode(null);
		setFunctionResult(null);
		setTooks([]);
		const controller = new AbortController();
		abortRef.current = controller;
		startTimer();

		const finish = () => {
			if (abortRef.current === controller) {
				stopTimer();
				setRunning(false);
				abortRef.current = null;
			}
		};

		const params = parseRunParams(showRunParams, runParams);
		if (!params.ok) {
			setConsoleOutput("Error parsing run parameters: Invalid JSON");
			finish();
			return;
		}
		const payload = params.value ? { run: params.value } : undefined;

		/** Opens a preview modal for HTTP-style results; true when handled. */
		const showPopup = (result: unknown) => {
			if (!resultModalsEnabled) return false;
			const classified = classifyPopupResult(result);
			if (!classified) return false;
			setPopup(classified);
			return true;
		};

		const showResult = (result: unknown) => {
			if (resultModalsEnabled && !showPopup(result)) {
				setValueResult({
					title: "Function Result",
					value: result,
					type: typeof result,
				});
			}
		};

		if (runMode === "classic") {
			try {
				const result = await executeFunction(
					functionId,
					payload,
					controller.signal,
				);
				if (result.status === "OK") {
					if (showPopup(result.data.result)) {
						setConsoleOutput("Popup rendered.");
						setExitCode(result.data.exitCode);
						return;
					}
					setConsoleOutput(
						result.data.output || "Execution completed with no output.",
					);
					setExitCode(result.data.exitCode);
					if (result.data.took) recordTimings(result.data.took);
					if (result.data.result !== undefined) {
						setFunctionResult(result.data.result);
						showResult(result.data.result);
					}
				} else {
					setConsoleOutput(`Execution failed: ${result.message}`);
				}
			} catch (error) {
				if (controller.signal.aborted) return;
				console.error("Error executing code:", error);
				setConsoleOutput("An error occurred while executing the code.");
			} finally {
				finish();
			}
			return;
		}

		try {
			setConsoleOutput("");
			let popupTriggered = false;
			await executeFunctionStreaming(
				functionId,
				(data) => {
					if (controller.signal.aborted) return;
					if (data.type === "output" && data.content) {
						if (!popupTriggered && showPopup(data.content)) {
							popupTriggered = true;
							setExitCode(data.exitCode ?? null);
							stopTimer();
							setRunning(false);
							return;
						}
						const content =
							typeof data.content === "string"
								? data.content
								: JSON.stringify(data.content);
						setConsoleOutput((prev) => prev + content);
					} else if (data.type === "end") {
						setExitCode(data.exitCode);
						if (data.took) recordTimings(data.took);
						if (data.result !== undefined) {
							if (showPopup(data.result)) {
								stopTimer();
								setRunning(false);
								return;
							}
							setFunctionResult(data.result);
							showResult(data.result);
						}
					} else if (data.type === "error") {
						setConsoleOutput(
							(prev) =>
								prev +
								`\nError: ${data.error || "No additional details."}`,
						);
					}
				},
				payload,
				controller.signal,
			);
		} catch (error) {
			if (controller.signal.aborted) return;
			console.error("Error streaming execution:", error);
			setConsoleOutput(
				(prev) => prev + "\nConnection error: Failed to stream output.",
			);
		} finally {
			finish();
		}
	}, [
		functionId,
		recordTimings,
		resultModalsEnabled,
		runMode,
		runParams,
		showRunParams,
		startTimer,
		stopTimer,
	]);

	return {
		run,
		running,
		runMode,
		setRunMode,
		consoleOutput,
		exitCode,
		executionTime,
		realTimeTaken,
		tooks,
		functionResult,
		showRunParams,
		setShowRunParams,
		runParams,
		setRunParams,
		popup,
		closePopup: () => setPopup(null),
		valueResult,
		closeValueResult: () => setValueResult(null),
	};
}
