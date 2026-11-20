import { inputClass, ToggleRow } from "../modals/Modal";
import { SettingsField, SettingsSection } from "./FormPrimitives";
import type { FunctionSettingsDraft } from "./functionSettings";

interface AccessSectionProps {
	draft: FunctionSettingsDraft;
	onChange: (patch: Partial<FunctionSettingsDraft>) => void;
	disabled: boolean;
}

export function AccessSection({
	draft,
	onChange,
	disabled,
}: AccessSectionProps) {
	return (
		<SettingsSection
			title="Access"
			description="How callers may reach the function and authenticate."
		>
			<ToggleRow
				id="allow-http-update"
				checked={draft.allowHttp}
				onChange={(checked) => onChange({ allowHttp: checked })}
				disabled={disabled}
				label="Allow HTTP"
				description="Enable inbound HTTP/HTTPS requests"
			/>
			<SettingsField label="Secure Header">
				<input
					type="text"
					placeholder="Optional secure header for authentication"
					value={draft.secureHeader}
					onChange={(e) => onChange({ secureHeader: e.target.value })}
					className={inputClass}
					disabled={disabled}
				/>
			</SettingsField>
		</SettingsSection>
	);
}
