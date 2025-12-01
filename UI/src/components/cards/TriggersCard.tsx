import { Trigger } from "../../types/Prisma";
import { ActionButton } from "../buttons/ActionButton";

export function TriggersCard({
	triggers,
	showDetails,
	onToggleDetails,
	onCreateTrigger,
	onEditTrigger,
	onDeleteTrigger,
	disabled = false,
	disabledReason,
}: {
	triggers: Trigger[];
	showDetails: boolean;
	onToggleDetails: () => void;
	onCreateTrigger: () => void;
	onEditTrigger: (trigger: Trigger) => void;
	onDeleteTrigger: (trigger: Trigger) => void;
	disabled?: boolean;
	disabledReason?: string;
}) {
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
					<span>⏰</span>
					Triggers
				</h2>
				<span className="text-primary text-lg">{showDetails ? "📂" : "📁"}</span>
			</div>

			{showDetails && (
				<div className="space-y-3">
					{triggers.length > 0 ? (
						<div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-primary/30">
							{triggers.map((trigger) => (
								<div
									key={trigger.id}
									className="bg-background/30 border border-primary/10 rounded-lg p-2"
								>
									<div className="flex justify-between items-start">
										<div className="flex-1 min-w-0">
											<h3
												className={`font-semibold text-sm ${!trigger.enabled ? "text-gray-400" : "text-text"}`}
											>
												{trigger.name}
											</h3>
											<p className="text-text/60 text-xs">{trigger.cron}</p>
										</div>
										<div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
											<button
												className="p-1 text-yellow-400 hover:bg-yellow-400/10 rounded transition-all duration-200 text-xs"
												onClick={() => onEditTrigger(trigger)}
												disabled={disabled}
											>
												✏️
											</button>
											<button
												className="p-1 text-red-400 hover:bg-red-400/10 rounded transition-all duration-200 text-xs"
												onClick={() => onDeleteTrigger(trigger)}
												disabled={disabled}
											>
												🗑️
											</button>
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="text-center py-4">
							<div className="text-3xl mb-1">⏰</div>
							<p className="text-text/60 text-xs">No triggers</p>
						</div>
					)}

					<ActionButton
						icon="➕"
						label="New Trigger"
						variant="primary"
						onClick={onCreateTrigger}
						disabled={disabled}
					/>
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
