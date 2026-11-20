import { useEffect, useMemo, useState } from "react";
import { getLogsByFuncId } from "../../services/backend.functions";
import { inputClass, primaryBtnClass, ToggleRow } from "../modals/Modal";
import { SettingsField, SettingsSection } from "./FormPrimitives";
import {
	splitCorsOrigins,
	type FunctionSettingsDraft,
} from "./functionSettings";
import type { TriggerLog } from "../../types/Prisma";

interface NetworkSectionProps {
	functionId: number;
	draft: FunctionSettingsDraft;
	onChange: (patch: Partial<FunctionSettingsDraft>) => void;
	disabled: boolean;
	htmlOnly: boolean;
}

export function NetworkSection({
	functionId,
	draft,
	onChange,
	disabled,
	htmlOnly,
}: NetworkSectionProps) {
	const [logs, setLogs] = useState<TriggerLog[]>([]);
	const [corsOriginInput, setCorsOriginInput] = useState("");

	useEffect(() => {
		let active = true;
		getLogsByFuncId(functionId)
			.then((result) => {
				if (!active) return;
				if (result.status === "OK") setLogs(result.data);
			})
			.catch(() => {
				// CORS suggestions are optional; a failed log load stays silent.
			});
		return () => {
			active = false;
		};
	}, [functionId]);

	const corsOrigins = useMemo(
		() => splitCorsOrigins(draft.corsOrigins),
		[draft.corsOrigins],
	);

	const loggedUrls = useMemo(() => {
		return logs
			.flatMap((log) => {
				try {
					const payload = JSON.parse(JSON.parse(log.result!).payload);
					return payload?.headers?.host ? [payload.headers.host] : [];
				} catch {
					return [];
				}
			})
			.filter((url, index, self) => self.indexOf(url) === index)
			.filter(
				(url) =>
					!corsOrigins.includes(`https://${url}`) &&
					!corsOrigins.includes(`http://${url}`),
			)
			.slice(0, 5);
	}, [logs, corsOrigins]);

	const addCorsOrigin = () => {
		const value = corsOriginInput.trim();
		if (value && !corsOrigins.includes(value)) {
			onChange({ corsOrigins: [...corsOrigins, value].join(", ") });
			setCorsOriginInput("");
		}
	};

	const removeCorsOrigin = (origin: string) => {
		onChange({
			corsOrigins: corsOrigins
				.filter((candidate) => candidate !== origin)
				.join(", "),
		});
	};

	return (
		<SettingsSection
			title="Network/CORS"
			description="Container networking and which browser origins may call this function."
		>
			<div className={htmlOnly ? "opacity-50 pointer-events-none" : ""}>
				<ToggleRow
					id="network-restricted-update"
					checked={draft.networkRestricted}
					onChange={(checked) => onChange({ networkRestricted: checked })}
					disabled={disabled || htmlOnly}
					label="Restrict Network"
					description="Run the container with Docker network disabled"
				/>
				{htmlOnly && (
					<p className="text-xs text-muted mt-1">
						Network restrictions are disabled for HTML startup files
					</p>
				)}
			</div>

			<SettingsField label="CORS Origins">
				{corsOrigins.length > 0 && (
					<div className="flex flex-wrap gap-2 mb-2">
						{corsOrigins.map((origin) => (
							<span
								key={origin}
								className="flex items-center gap-1.5 bg-background/60 border border-white/[0.07] text-text text-xs px-2.5 py-1 rounded-full"
							>
								{origin}
								<button
									type="button"
									className="text-muted hover:text-red-400 transition-colors"
									onClick={() => removeCorsOrigin(origin)}
									disabled={disabled}
									aria-label={`Remove ${origin}`}
								>
									×
								</button>
							</span>
						))}
					</div>
				)}
				<div className="flex gap-2">
					<input
						type="text"
						placeholder="Add origin (e.g. https://example.com)"
						value={corsOriginInput}
						onChange={(e) => setCorsOriginInput(e.target.value)}
						className={`${inputClass} flex-1`}
						disabled={disabled}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								addCorsOrigin();
							}
						}}
					/>
					<button
						type="button"
						onClick={addCorsOrigin}
						className={primaryBtnClass}
						disabled={disabled || !corsOriginInput.trim()}
					>
						Add
					</button>
				</div>
				<p className="text-xs text-muted mt-1">
					Leave empty to allow only default origins.
				</p>

				{loggedUrls.length > 0 && (
					<div className="mt-3 space-y-2">
						<p className="text-xs text-muted">
							Possible origins from recent logs:
						</p>
						<div className="flex flex-wrap gap-2">
							{loggedUrls.map((url) => (
								<div
									key={url}
									className="bg-background/40 border border-white/[0.07] rounded-lg px-3 py-2 flex items-center gap-2"
								>
									<span className="text-xs text-muted/80 break-all font-mono">
										{url}
									</span>
									{["https://", "http://"].map((protocol) => {
										const origin = `${protocol}${url}`;
										const alreadyAdded = corsOrigins.includes(origin);
										return (
											<button
												key={protocol}
												type="button"
												className="text-xs px-2 py-0.5 border border-white/[0.07] text-muted hover:text-text hover:bg-white/[0.04] rounded transition-colors disabled:opacity-50"
												onClick={() => {
													if (!alreadyAdded) {
														onChange({
															corsOrigins: [...corsOrigins, origin].join(
																", ",
															),
														});
													}
												}}
												disabled={disabled || alreadyAdded}
											>
												{protocol.replace("://", "")}
											</button>
										);
									})}
								</div>
							))}
						</div>
					</div>
				)}
			</SettingsField>
		</SettingsSection>
	);
}
