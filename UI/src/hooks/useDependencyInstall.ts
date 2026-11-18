import { useEffect, useRef, useState } from "react";
import {
	getDependencyInstallStatus,
	installDependencies,
	type DependencyInstallJob,
} from "../services/backend.functions";

const POLL_INTERVAL_MS = 2_000;

export interface DependencyInstallResult {
	title: string;
	message: string;
	success: boolean;
}

const defaultErrorMessage =
	"Dependencies could not be installed. Check the function logs and try again.";

/**
 * Starts the runtime's dependency install and polls its job until it finishes,
 * keeping the outcome for display.
 */
export function useDependencyInstall(
	functionId: number | null,
	{ onFinished }: { onFinished?: () => void } = {},
) {
	const [installing, setInstalling] = useState(false);
	const [result, setResult] = useState<DependencyInstallResult | null>(null);
	const [resultOpen, setResultOpen] = useState(false);
	const cancelled = useRef(false);

	useEffect(() => {
		cancelled.current = false;
		return () => {
			cancelled.current = true;
		};
	}, []);

	const show = (next: DependencyInstallResult) => {
		setResult(next);
		setResultOpen(true);
	};

	const waitForInstall = async (job: DependencyInstallJob, id: number) => {
		let current = job;
		while (current.status === "running") {
			await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
			if (cancelled.current) return null;
			const response = await getDependencyInstallStatus(id);
			if (response.status !== "OK") throw new Error(response.message);
			if (!response.job) throw new Error("The install job is no longer available.");
			current = response.job;
		}
		return current;
	};

	const install = async () => {
		if (functionId === null || installing) return;

		setInstalling(true);
		try {
			const response = await installDependencies(functionId);
			if (response.status !== "OK") {
				show({ title: "Install Error", message: response.message, success: false });
				return;
			}

			const job = await waitForInstall(response.job, functionId);
			if (!job) return;

			if (job.status === "succeeded") {
				show({
					title: "Dependencies Installed",
					message: job.message ?? "Dependencies installed successfully.",
					success: true,
				});
			} else {
				show({
					title: "Install Error",
					message: job.message ?? defaultErrorMessage,
					success: false,
				});
			}
		} catch (error) {
			console.error("Error installing dependencies:", error);
			show({
				title: "Install Error",
				message: error instanceof Error ? error.message : defaultErrorMessage,
				success: false,
			});
		} finally {
			if (!cancelled.current) {
				onFinished?.();
				setInstalling(false);
			}
		}
	};

	return {
		installing,
		install,
		result,
		resultOpen,
		closeResult: () => setResultOpen(false),
	};
}
