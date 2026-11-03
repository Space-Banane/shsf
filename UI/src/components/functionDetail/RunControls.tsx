import { useState } from "react";
import type { RunMode } from "../../types/FunctionExecution";

interface RunControlsProps {
	runMode: RunMode;
	onRunModeChange: (mode: RunMode) => void;
	showRunParams: boolean;
	onToggleRunParams: () => void;
	resultModalsEnabled: boolean;
	onToggleResultModals: () => void;
	/** Running, saving or HTML-only: the run settings can't change right now. */
	locked: boolean;
	htmlOnly: boolean;
}

const lockedClass =
	"opacity-30 cursor-not-allowed bg-slate-800 text-gray-400";

export function RunControls({
	runMode,
	onRunModeChange,
	showRunParams,
	onToggleRunParams,
	resultModalsEnabled,
	onToggleResultModals,
	locked,
	htmlOnly,
}: RunControlsProps) {
	return (
		<div className="flex flex-wrap items-center gap-2 xl:justify-end">
			<select
				aria-label="Run mode"
				className={`h-9 min-w-[110px] bg-background/45 border border-primary/20 text-primary px-3 text-sm rounded-lg transition-all duration-300 hover:border-primary/40 ${
					locked ? lockedClass : ""
				}`}
				value={runMode}
				onChange={(e) => onRunModeChange(e.target.value as RunMode)}
				disabled={locked}
			>
				<option value="streaming">Stream</option>
				<option value="classic">Classic</option>
			</select>
			<button
				className={[
					"h-9 px-3 text-sm rounded-lg transition-all duration-300 border",
					showRunParams
						? "bg-primary border-transparent text-background"
						: "bg-background/45 border-primary/20 text-primary hover:border-primary/40",
					locked ? `${lockedClass} border-primary/20` : "",
				].join(" ")}
				style={{ cursor: htmlOnly ? "not-allowed" : "pointer" }}
				onClick={onToggleRunParams}
				disabled={locked}
			>
				Run Params
			</button>
			<button
				className={`h-9 px-3 text-sm rounded-lg transition-all duration-300 border ${
					resultModalsEnabled
						? "bg-emerald-500/10 border-emerald-400/30 text-emerald-300 hover:border-emerald-300/40"
						: "bg-red-500/10 border-red-400/30 text-red-300 hover:border-red-300/40"
				}`}
				onClick={onToggleResultModals}
				title={
					resultModalsEnabled
						? "Result modals are enabled"
						: "Result modals are disabled"
				}
			>
				{resultModalsEnabled ? "Modals On" : "Modals Off"}
			</button>
		</div>
	);
}

/** JSON textarea for run parameters; tints red while the text isn't valid JSON. */
export function RunParamsInput({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	const [valid, setValid] = useState(true);

	return (
		<div className="mt-3">
			<textarea
				className={`w-full h-20 bg-background/30 border border-primary/20 rounded-lg p-2 text-sm ${
					valid ? "text-text" : "text-red-400"
				} placeholder-text/50 resize-none`}
				placeholder="Enter JSON run parameters..."
				value={value}
				onChange={(e) => {
					onChange(e.target.value);
					try {
						JSON.parse(e.target.value);
						setValid(true);
					} catch {
						setValid(false);
					}
				}}
				spellCheck={false}
			/>
		</div>
	);
}
