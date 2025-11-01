import { TimingEntry } from "../../pages/functions/FunctionDetail";

export function TimingCard({
  tooks,
  showDetails,
  onToggleDetails,
  disabled = false,
  disabledReason
}: {
  tooks: TimingEntry[];
  showDetails: boolean;
  onToggleDetails: () => void;
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
        className="flex justify-between items-center cursor-pointer"
        onClick={onToggleDetails}
      >
        <h2 className="text-lg font-bold text-primary flex items-center gap-2">
          <span>⏱️</span>
          Timing
        </h2>
        <span className="text-primary text-lg">
          {showDetails ? "📂" : "📁"}
        </span>
      </div>

      {showDetails && (
        <div className="mt-3">
          {tooks.length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-primary/30">
              {tooks.map((entry, index) => (
                <div
                  key={index}
                  className={`flex justify-between items-center py-1 px-2 bg-background/30 rounded text-xs ${
                    entry.description === "Total execution time"
                      ? "border border-primary/20 font-semibold"
                      : ""
                  }`}
                >
                  <span className="text-text truncate">{String(entry.description)}</span>
                  <span className="text-primary font-mono ml-2 flex-shrink-0">
                    {typeof entry.value === "number" ? entry.value.toFixed(3) : String(entry.value)}s
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-text/60 text-xs">Run to see timing</p>
            </div>
          )}
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