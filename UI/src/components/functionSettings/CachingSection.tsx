import { inputClass, ToggleRow } from "../modals/Modal";
import { SettingsField, SettingsSection } from "./FormPrimitives";
import type { FunctionSettingsDraft } from "./functionSettings";

interface CachingSectionProps {
	draft: FunctionSettingsDraft;
	onChange: (patch: Partial<FunctionSettingsDraft>) => void;
	disabled: boolean;
}

export function CachingSection({
	draft,
	onChange,
	disabled,
}: CachingSectionProps) {
	return (
		<SettingsSection
			title="Caching"
			description="Store function responses to serve repeated calls faster."
		>
			<ToggleRow
				id="cache-enabled-update"
				checked={draft.cacheEnabled}
				onChange={(checked) => onChange({ cacheEnabled: checked })}
				disabled={disabled}
				label="Response Caching"
				description="Cache function responses to improve performance"
			/>
			{draft.cacheEnabled && (
				<div className="mt-3 bg-background/40 border border-white/[0.07] rounded-lg p-3">
					<SettingsField
						label="Cache TTL (seconds)"
						hint="How long to store the result (1 to 86400 seconds)"
					>
						<input
							type="number"
							min="1"
							max="86400"
							value={draft.cacheTtl}
							onChange={(e) =>
								onChange({ cacheTtl: parseInt(e.target.value) || 60 })
							}
							className={inputClass}
							placeholder="60"
							disabled={disabled}
						/>
					</SettingsField>
				</div>
			)}
		</SettingsSection>
	);
}
