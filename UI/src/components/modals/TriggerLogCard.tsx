import React from "react";
import { TriggerLog } from "../../types/Prisma";

interface TriggerLogCardProps {
  log: TriggerLog;
  expanded: boolean;
  onToggle: (logId: number) => void;
}

const TriggerLogCard: React.FC<TriggerLogCardProps> = ({ log, expanded, onToggle }) => {
  return (
    <div
      className="bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden hover:border-primary/30 transition-all duration-300"
    >
      {/* Log Header */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-800/70 transition-all duration-300"
        onClick={() => onToggle(log.id)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
              <span className="text-sm">📋</span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">
                {new Date(log.createdAt).toLocaleString()}
              </p>
              <p className="text-gray-400 text-xs">Execution #{log.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`transform transition-transform duration-300 ${
                expanded ? "rotate-90" : ""
              } text-primary`}
            >
              ▶
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Log Content */}
      {expanded && (
        <div className="border-t border-gray-700/50 p-4 space-y-4">

          {/* Request Details Section */}
          {log.result && (() => {
            let requestData;
            try {
              // Try to parse the payload as the example object
              requestData = JSON.parse(JSON.parse(log.result).payload);
            } catch {
              requestData = null;
            }
            if (requestData && typeof requestData === "object") {
              return (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                    <span>🌐</span> Request Details (Payload)
                  </h4>
                  <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3 overflow-auto">
                    {/* Method & Route */}
                    <div className="flex flex-wrap gap-4 mb-2">
                      <div>
                        <span className="text-gray-400 text-xs">Method:</span>{" "}
                        <span className="text-white text-xs font-mono">{requestData.method}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Route:</span>{" "}
                        <span className="text-white text-xs font-mono">{requestData.route}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Source IP:</span>{" "}
                        <span className="text-white text-xs font-mono">{requestData.source_ip}</span>
                      </div>
                    </div>
                    {/* Headers */}
                    {requestData.headers && (
                      <details className="mb-2">
                        <summary className="cursor-pointer text-primary text-xs font-semibold">Headers</summary>
                        <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap bg-gray-800/40 rounded p-2 mt-1">
                          {JSON.stringify(requestData.headers, null, 2)}
                        </pre>
                      </details>
                    )}
                    {/* Queries */}
                    {requestData.queries && (
                      <details className="mb-2">
                        <summary className="cursor-pointer text-primary text-xs font-semibold">Query Parameters</summary>
                        <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap bg-gray-800/40 rounded p-2 mt-1">
                          {JSON.stringify(requestData.queries, null, 2)}
                        </pre>
                      </details>
                    )}
                    {/* Body */}
                    {requestData.body && (
                      <details className="mb-2">
                        <summary className="cursor-pointer text-primary text-xs font-semibold">Body</summary>
                        <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap bg-gray-800/40 rounded p-2 mt-1">
                          {JSON.stringify(requestData.body, null, 2)}
                        </pre>
                      </details>
                    )}
                    {/* Raw Body */}
                    {requestData.raw_body && (
                      <div className="mb-2">
                        <span className="text-gray-400 text-xs">Raw Body:</span>
                        <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap bg-gray-800/40 rounded p-2 mt-1">
                          {requestData.raw_body}
                        </pre>
                      </div>
                    )}
                    {/* All other fields */}
                    <details>
                      <summary className="cursor-pointer text-primary text-xs font-semibold">Full Request JSON</summary>
                      <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap bg-gray-800/40 rounded p-2 mt-1">
                        {JSON.stringify(requestData, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Output Logs Section */}
          {log.logs && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                <span>📝</span> Output Logs
              </h4>
              <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3 max-h-60 overflow-auto">
                <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap">
                  {log.logs}
                </pre>
              </div>
            </div>
          )}

          {/* Timing Details */}
          {log.result && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                <span>⏱️</span> Timing Details
              </h4>
              <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3">
                {JSON.parse(log.result)?.tooks?.map(
                  (took: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-1 border-b border-gray-700/30 last:border-b-0"
                    >
                      <span className="text-gray-400 text-sm">
                        {took.description}
                      </span>
                      <span className="text-white text-sm font-mono">
                        {took.value} ms
                      </span>
                    </div>
                  )
                ) || (
                  <p className="text-gray-400 text-xs">
                    No timing details available
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Execution Result */}
          {log.result && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                <span>🎯</span> Execution Result
              </h4>
              <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3 max-h-60 overflow-auto">
                <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap">
                  {(() => {
                    try {
                      const parsedResult = JSON.parse(log.result);
                      let output = "";
                      if (parsedResult && typeof parsedResult.output === "string") {
                        // Extract between SHSF_FUNCTION_RESULT_START and SHSF_FUNCTION_RESULT_END
                        const match = parsedResult.output.match(
                          /SHSF_FUNCTION_RESULT_START\s*\n?([\s\S]*?)\n?SHSF_FUNCTION_RESULT_END/
                        );
                        if (match && match[1]) {
                          output = match[1].trim();
                        } else {
                          output = parsedResult.output;
                        }
                      }
                      return output || "No execution result";
                    } catch (error) {
                      return "Invalid JSON format in result";
                    }
                  })()}
                </pre>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-700/30">
            <span>
              Created: {new Date(log.createdAt).toLocaleString()}
            </span>
            {log.updatedAt && (
              <span>
                Updated: {new Date(log.updatedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TriggerLogCard;