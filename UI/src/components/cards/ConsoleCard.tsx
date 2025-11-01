import { XFunction } from "../../types/Prisma";

export function ConsoleCard({
  consoleOutput,
  exitCode,
  executionTime,
  realTimeTaken,
  functionResult,
  functionData,
  autoScroll,
  consoleOutputRef,
  onConsoleScroll,
  onResumeAutoScroll,
  disabled = false,
  disabledReason
}: {
  consoleOutput: string;
  exitCode: number | null;
  executionTime: number | null;
  realTimeTaken: number | null;
  functionResult: any;
  functionData: XFunction;
  autoScroll: boolean;
  consoleOutputRef: React.RefObject<HTMLDivElement>;
  onConsoleScroll: () => void;
  onResumeAutoScroll: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <div
      className={`bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-lg p-4 relative ${
        disabled ? "opacity-50 pointer-events-none select-none grayscale" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-primary flex items-center gap-2">
          <span>💻</span>
          Console
        </h2>
        
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-text/60">Exit:</span>
            <span className={`font-mono px-1.5 py-0.5 rounded ${
              exitCode === null ? "text-gray-400 bg-gray-800" :
              exitCode === 0 ? "text-green-400 bg-green-900/20" : "text-red-400 bg-red-900/20"
            }`}>
              {exitCode !== null ? exitCode : "N/A"}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className="text-text/60">Time:</span>
            <span className={`font-mono px-1.5 py-0.5 rounded ${
              executionTime !== null && executionTime > functionData.timeout
                ? "text-red-400 bg-red-900/20"
                : "text-text bg-background/30"
            }`}>
              {executionTime !== null ? `${executionTime.toFixed(2)}s` : "N/A"}
            </span>
          </div>
          
          {realTimeTaken !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-text/60">Run:</span>
              <span className="font-mono px-1.5 py-0.5 rounded bg-background/30 text-text">
                {realTimeTaken.toFixed(3)}s
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${
              functionResult !== null ? "bg-green-500" : "bg-gray-500"
            }`}></span>
            <span className="text-text/60">
              {functionResult !== null ? "Returned" : "No Data"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div
          className="bg-gray-950 border border-primary/10 rounded-lg p-3 h-40 overflow-auto font-mono text-xs scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-primary/30"
          ref={consoleOutputRef}
          onScroll={onConsoleScroll}
        >
          <pre className="whitespace-pre-wrap text-gray-100">
            {consoleOutput || "No output to display"}
          </pre>
        </div>

        {!autoScroll && consoleOutput && (
          <div className="flex justify-end">
            <button
              className="text-xs text-text/60 hover:text-primary transition-colors duration-300"
              onClick={onResumeAutoScroll}
            >
              ↓ Resume auto-scroll
            </button>
          </div>
        )}

        {functionResult !== null && (
          <div className="bg-background/30 border border-primary/10 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
              <span>📤</span>
              Result
            </h3>
            <pre className="whitespace-pre-wrap text-green-400 font-mono text-xs overflow-auto max-h-32 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-primary/30">
              {typeof functionResult === "object"
                ? JSON.stringify(functionResult, null, 2)
                : String(functionResult)}
            </pre>
          </div>
        )}
      </div>

      {disabled && disabledReason && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg z-10 pointer-events-none">
          <span className="text-xs text-white text-center px-2">{disabledReason}</span>
        </div>
      )}
    </div>
  );
}