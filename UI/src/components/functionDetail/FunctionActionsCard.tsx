import type { XFunction } from "../../types/Prisma";
import { ActionButton } from "../buttons/ActionButton";

interface FunctionActionsCardProps {
	functionData: Pick<XFunction, "git_url">;
	envDisabled: boolean;
	onOpenSettings: () => void;
	onOpenEnv: () => void;
	onOpenGuests: () => void;
	onOpenVersionControl: () => void;
}

export function FunctionActionsCard({
	functionData,
	envDisabled,
	onOpenSettings,
	onOpenEnv,
	onOpenGuests,
	onOpenVersionControl,
}: FunctionActionsCardProps) {
	return (
		<div className="bg-surface border border-white/[0.07] rounded-xl p-4">
			<h2 className="text-lg font-bold text-primary mb-3 flex items-center gap-2">
				<span>⚡</span>
				Actions
			</h2>
			<div className="grid grid-cols-2 gap-2">
				<ActionButton
					icon="⚙️"
					label="Settings"
					variant="secondary"
					onClick={onOpenSettings}
				/>
				<ActionButton
					disabled={envDisabled}
					icon="🌍"
					label="Env"
					variant="secondary"
					onClick={onOpenEnv}
				/>
				<ActionButton
					icon="👥"
					label="Guests"
					variant="secondary"
					onClick={onOpenGuests}
				/>
				<ActionButton
					icon="🔀"
					label="Version Control"
					variant={functionData.git_url ? "primary" : "secondary"}
					onClick={onOpenVersionControl}
				/>
			</div>
		</div>
	);
}
