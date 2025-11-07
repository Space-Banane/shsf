import { TriggerLog } from "../../types/Prisma";
import { ActionButton } from "../buttons/ActionButton";

export function LogsCard({
  logs,
  isLoadingLogs,
  showDetails,
  onToggleDetails,
  onRefreshLogs,
  onViewLogs,
  disabled = false,
  disabledReason
}: {
  logs: TriggerLog[];
  isLoadingLogs: boolean;
  showDetails: boolean;
  onToggleDetails: () => void;
  onRefreshLogs: () => void;
  onViewLogs: () => void;
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
          <span>📋</span>
          Logs
          {isLoadingLogs && <div className="animate-spin text-xs">⟳</div>}
        </h2>
        <span className="text-primary text-lg">
          {showDetails ? "📂" : "📁"}
        </span>
      </div>

      {showDetails && (
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            icon="🔄"
            label="Refresh"
            variant="secondary"
            onClick={onRefreshLogs}
            disabled={disabled}
          />
          <ActionButton
            icon="👁️"
            label="View"
            variant="primary"
            onClick={onViewLogs}
            disabled={disabled}
          />
        </div>
      )}
      {disabled && disabledReason && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg z-10 pointer-events-none">
          <span className="text-xs text-white text-center px-2">{disabledReason}</span>
        </div>
      )}
    </div>
  );
}

