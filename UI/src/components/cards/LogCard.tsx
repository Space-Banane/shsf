import { TriggerLog } from "../../types/Prisma";

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

export function ActionButton({
  icon,
  label,
  variant = "primary",
  onClick,
  disabled = false
}: {
  icon: string;
  label: string;
  variant?: "primary" | "secondary";
  onClick: () => void;
  disabled?: boolean;
}) {
  const baseClasses = "px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100";
  const variantClasses = {
    primary: "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-[0_0_30px_rgba(124,131,253,0.3)] border border-transparent",
    secondary: "bg-background/50 border border-primary/20 text-primary hover:border-primary/40 hover:bg-primary/5"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} w-full`}
      style={{
        cursor: disabled ? "not-allowed" : "pointer"
      }}
    >
      <span className="text-sm">{icon}</span>
      <span className="text-sm">{label}</span>
    </button>
  );
}