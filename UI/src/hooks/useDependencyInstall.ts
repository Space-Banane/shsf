import { useState } from "react";
import { installDependencies } from "../services/backend.functions";

export interface DependencyInstallResult {
	title: string;
	message: string;
	success: boolean;
}

/** Runs the runtime's dependency install and keeps the outcome for display. */
export function useDependencyInstall(
	functionId: number | null,
	{ onFinished }: { onFinished?: () => void } = {},
) {
	const [installing, setInstalling] = useState(false);
	const [result, setResult] = useState<DependencyInstallResult | null>(null);
	const [resultOpen, setResultOpen] = useState(false);

	const show = (next: DependencyInstallResult) => {
		setResult(next);
		setResultOpen(true);
	};

	const install = async () => {
		if (functionId === null) return;

		setInstalling(true);
		try {
			const response = await installDependencies(functionId);
			if (response && typeof response === "object" && response.status === "OK") {
				show({
					title: "Dependencies Installed",
					message: "Dependencies installed successfully.",
					success: true,
				});
			} else {
				show({
					title: "Install Error",
					message:
						response && typeof response === "object" && "message" in response
							? String(response.message)
							: "Dependencies could not be installed. Check the function logs and try again.",
					success: false,
				});
			}
		} catch (error) {
			console.error("Error installing dependencies:", error);
			show({
				title: "Install Error",
				message: "An error occurred while installing dependencies.",
				success: false,
			});
		} finally {
			onFinished?.();
			setInstalling(false);
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
