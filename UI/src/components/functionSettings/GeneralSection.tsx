import { useEffect, useState } from "react";
import { updateFunction } from "../../services/backend.functions";
import { getNamespaces } from "../../services/backend.namespaces";
import { useConfirm } from "../modals/ConfirmModal";
import { inputClass, selectClass, textareaClass } from "../modals/Modal";
import { LoadError } from "../ui/LoadError";
import { SettingsField, SettingsSection } from "./FormPrimitives";
import type { FunctionSettingsDraft } from "./functionSettings";
import type { Namespace, XFunction } from "../../types/Prisma";

interface GeneralSectionProps {
	functionData: XFunction;
	draft: FunctionSettingsDraft;
	onChange: (patch: Partial<FunctionSettingsDraft>) => void;
	disabled: boolean;
	isOwner: boolean;
	onSourceFlagsCleared: () => void;
}

export function GeneralSection({
	functionData,
	draft,
	onChange,
	disabled,
	isOwner,
	onSourceFlagsCleared,
}: GeneralSectionProps) {
	const confirm = useConfirm();
	const [namespaces, setNamespaces] = useState<Namespace[]>([]);
	const [namespaceError, setNamespaceError] = useState<string | null>(null);
	const [namespaceReloadKey, setNamespaceReloadKey] = useState(0);
	const [isClearingSourceFlags, setIsClearingSourceFlags] = useState(false);
	const [actionError, setActionError] = useState("");

	const hasSourceFlags =
		(functionData.imported ?? false) ||
		(functionData.ai_kicked_off ?? false);

	useEffect(() => {
		let active = true;
		setNamespaceError(null);
		getNamespaces()
			.then((data) => {
				if (!active) return;
				if (data.status === "OK") setNamespaces(data.data);
				else setNamespaceError(data.message || "Could not load namespaces.");
			})
			.catch(() => {
				if (active) setNamespaceError("Could not load namespaces.");
			});
		return () => {
			active = false;
		};
	}, [namespaceReloadKey]);

	const namespaceSelectValue =
		namespaces.length > 0 ? (draft.namespaceId ?? "") : "";

	const handleClearSourceFlags = async () => {
		if (!hasSourceFlags) return;
		const confirmed = await confirm({
			title: "Clear Source Flags?",
			message:
				"This will remove the Imported and AI Kicked-Off labels from this function. It will not change the code, files, or runtime settings.",
			confirmText: "Clear Flags",
			cancelText: "Cancel",
			variant: "delete",
		});
		if (!confirmed) return;

		setIsClearingSourceFlags(true);
		setActionError("");
		try {
			const response = await updateFunction(functionData.id, {
				imported: false,
				ai_kicked_off: false,
			});
			if (response.status === "OK") {
				onSourceFlagsCleared();
			} else {
				setActionError("Error clearing source flags: " + response.message);
			}
		} catch {
			setActionError("An unexpected error occurred while clearing source flags");
		} finally {
			setIsClearingSourceFlags(false);
		}
	};

	return (
		<SettingsSection
			title="General"
			description="Identity and where the function is grouped."
		>
			{actionError && (
				<div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
					{actionError}
				</div>
			)}
			{hasSourceFlags && (
				<div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
					<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
						<div className="space-y-2">
							<h3 className="text-cyan-200 text-sm font-semibold">
								Source flags enabled
							</h3>
							<p className="text-cyan-100/80 text-xs leading-relaxed">
								This function is marked as imported or AI generated. You can
								clear those labels without changing the function itself.
							</p>
							<div className="flex flex-wrap gap-2">
								{functionData.imported && (
									<span className="rounded-full border border-blue-400/40 bg-blue-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-100">
										Imported
									</span>
								)}
								{functionData.ai_kicked_off && (
									<span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100">
										AI Kicked-Off
									</span>
								)}
							</div>
						</div>
						<button
							type="button"
							onClick={() => {
								void handleClearSourceFlags();
							}}
							disabled={disabled || isClearingSourceFlags}
							className="shrink-0 rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25 hover:border-cyan-300/50 transition-colors disabled:opacity-50"
						>
							{isClearingSourceFlags ? "Clearing..." : "Clear Flags"}
						</button>
					</div>
				</div>
			)}

			{namespaceError && (
				<LoadError
					message={namespaceError}
					onRetry={() => setNamespaceReloadKey((key) => key + 1)}
				/>
			)}

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<SettingsField label="Function Name">
					<input
						type="text"
						placeholder="my-awesome-function"
						value={draft.name}
						onChange={(e) => onChange({ name: e.target.value })}
						className={inputClass}
						disabled={disabled || !isOwner}
					/>
				</SettingsField>
				<SettingsField label="Startup File">
					<input
						type="text"
						placeholder="main.py, index.js, etc."
						value={draft.startupFile}
						onChange={(e) => onChange({ startupFile: e.target.value })}
						className={inputClass}
						disabled={disabled}
					/>
				</SettingsField>
			</div>
			<SettingsField label="Description">
				<textarea
					placeholder="Brief description of what this function does..."
					value={draft.description}
					onChange={(e) => onChange({ description: e.target.value })}
					className={textareaClass}
					rows={3}
					disabled={disabled}
				/>
			</SettingsField>
			<SettingsField label="Namespace">
				<select
					value={namespaceSelectValue}
					onChange={(e) =>
						onChange({
							namespaceId: e.target.value
								? Number(e.target.value)
								: undefined,
						})
					}
					className={selectClass}
					disabled={disabled || !isOwner || namespaces.length === 0}
				>
					{namespaces.length === 0 && (
						<option value="">Loading namespaces...</option>
					)}
					{namespaces.map((namespace) => (
						<option key={namespace.id} value={namespace.id}>
							{namespace.name}
						</option>
					))}
				</select>
			</SettingsField>
			<SettingsField label="Execution Alias">
				<input
					type="text"
					placeholder="Optional: alias for execution (e.g. big-test-1)"
					pattern="^[a-zA-Z0-9-_]+$"
					value={draft.executionAlias}
					onChange={(e) => onChange({ executionAlias: e.target.value })}
					className={inputClass}
					disabled={disabled}
				/>
			</SettingsField>
		</SettingsSection>
	);
}
