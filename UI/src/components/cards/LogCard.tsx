import { useEffect, useState } from "react";
import {
	deleteAllLogs,
	getLoggingConfig,
	updateLoggingConfig,
} from "../../services/backend.function.logs";
import { TriggerLog } from "../../types/Prisma";
import { ActionButton } from "../buttons/ActionButton";

export function LogsCard({
	logs,
	isLoadingLogs,
	showDetails,
	onToggleDetails,
	onRefreshLogs,
	onViewLogs,
	functionId,
	disabled = false,
	disabledReason,
}: {
	logs: TriggerLog[];
	isLoadingLogs: boolean;
	showDetails: boolean;
	onToggleDetails: () => void;
	onRefreshLogs: () => void;
	onViewLogs: () => void;
	functionId: number;
	disabled?: boolean;
	disabledReason?: string;
}) {
	const [loggingEnabled, setLoggingEnabled] = useState(true);
	const [hidePayloadHeaders, setHidePayloadHeaders] = useState(false);
	const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

	useEffect(() => {
		if (!functionId || disabled) return;

		let mounted = true;
		getLoggingConfig(functionId).then((res) => {
			if (!mounted) return;
			if (res.status === "OK") {
				setLoggingEnabled(res.data.enabled);
				setHidePayloadHeaders(Boolean(res.data.hide_payload_headers));
			}
		});

		return () => {
			mounted = false;
		};
	}, [functionId, disabled]);

	const handleToggleLogging = async (checked: boolean) => {
		if (!functionId || disabled || isUpdatingConfig) return;
		setIsUpdatingConfig(true);
		const res = await updateLoggingConfig(functionId, { enabled: checked });
		if (res.status === "OK") {
			setLoggingEnabled(checked);
		}
		setIsUpdatingConfig(false);
	};

	const handleToggleHidePayloadHeaders = async (checked: boolean) => {
		if (!functionId || disabled || isUpdatingConfig || !loggingEnabled) return;
		setIsUpdatingConfig(true);
		const res = await updateLoggingConfig(functionId, {
			hide_payload_headers: checked,
		});
		if (res.status === "OK") {
			setHidePayloadHeaders(checked);
		}
		setIsUpdatingConfig(false);
	};

	const handleClearAll = async () => {
		if (!functionId || disabled) return;
		if (!window.confirm("Are you sure you want to clear all logs?")) return;

		const res = await deleteAllLogs(functionId);
		if (res.status === "OK") {
			onRefreshLogs();
		}
	};

	const disableLogActions = disabled || !loggingEnabled;
	const actionButtons = [
		{
			icon: "🔄",
			label: "Refresh",
			variant: "secondary" as const,
			onClick: onRefreshLogs,
			disabled: disableLogActions,
		},
		{
			icon: "👁️",
			label: "View",
			variant: "primary" as const,
			onClick: onViewLogs,
			disabled: disableLogActions,
		},
		{
			icon: "🗑️",
			label: "Clear",
			variant: "delete" as const,
			onClick: handleClearAll,
			disabled: logs.length === 0,
		},
	];
	const shouldCenterLastAction = actionButtons.length % 2 !== 0;

	return (
		<div
			className={`bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-lg p-4 relative ${
				disabled ? "opacity-50 pointer-events-none select-none grayscale" : ""
			}`}
		>
			<div
				className="flex justify-between items-center cursor-pointer mb-3"
				onClick={onToggleDetails}
			>
				<h2 className="text-lg font-bold text-primary flex items-center gap-2">
					<span>📋</span>
					Logs
					{isLoadingLogs && <div className="animate-spin text-xs">⟳</div>}
				</h2>
				<span className="text-primary text-lg">{showDetails ? "📂" : "📁"}</span>
			</div>

			{showDetails && (
				<div className="space-y-3">
					<div className="flex items-center justify-between rounded-lg border border-gray-700/50 bg-gray-900/40 px-3 py-2">
						<span className="text-sm text-gray-300">Logging</span>
						<label className="relative inline-flex items-center cursor-pointer">
							<input
								type="checkbox"
								className="sr-only peer"
								checked={loggingEnabled}
								disabled={disabled || isUpdatingConfig}
								onChange={(e) => handleToggleLogging(e.target.checked)}
							/>
							<div className="w-10 h-5 bg-gray-700 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
						</label>
					</div>
					<div className="flex items-center justify-between rounded-lg border border-gray-700/50 bg-gray-900/40 px-3 py-2">
						<span className="text-sm text-gray-300">Hide Payload Headers</span>
						<label className="relative inline-flex items-center cursor-pointer">
							<input
								type="checkbox"
								className="sr-only peer"
								checked={hidePayloadHeaders}
								disabled={disabled || isUpdatingConfig || !loggingEnabled}
								onChange={(e) => handleToggleHidePayloadHeaders(e.target.checked)}
							/>
							<div className="w-10 h-5 bg-gray-700 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
						</label>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
						{actionButtons.map((button, index) => {
							const isLastOddButton =
								shouldCenterLastAction && index === actionButtons.length - 1;

							return (
								<div
									key={button.label}
									className={
										isLastOddButton
											? "sm:col-span-2 sm:flex sm:justify-center"
											: ""
									}
								>
									<div className={isLastOddButton ? "sm:w-1/2" : "w-full"}>
										<ActionButton
											icon={button.icon}
											label={button.label}
											variant={button.variant}
											onClick={button.onClick}
											disabled={button.disabled}
										/>
									</div>
								</div>
							);
						})}
					</div>
					{!loggingEnabled && (
						<p className="text-xs text-gray-400">
							Logging is disabled. Enable it to refresh, view, or clear logs.
						</p>
					)}
				</div>
			)}
			{disabled && disabledReason && (
				<div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg z-10 pointer-events-none">
					<span className="text-xs text-white text-center px-2">
						{disabledReason}
					</span>
				</div>
			)}
		</div>
	);
}
