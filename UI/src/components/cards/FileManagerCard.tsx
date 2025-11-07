import { FunctionFile } from "../../types/Prisma";
import { ActionButton } from "../buttons/ActionButton";


export function FileManagerCard({
  files,
  activeFile,
  onFileSelect,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
}: {
  files: FunctionFile[];
  activeFile: FunctionFile | null;
  onFileSelect: (file: FunctionFile) => void;
  onCreateFile: () => void;
  onRenameFile: (file: FunctionFile) => void;
  onDeleteFile: (file: FunctionFile) => void;
}) {
  return (
    <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-lg p-4">
      <h2 className="text-lg font-bold text-primary mb-3 flex items-center gap-2">
        <span>📁</span>
        Files
      </h2>

      <div className="space-y-1 mb-3 max-h-64 overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-primary/30">
        {files.length > 0 ? (
          files.map((file) => (
            <div
              key={file.id}
              className={`bg-background/30 border rounded-lg p-2 cursor-pointer transition-all duration-200 ${
                activeFile?.id === file.id
                  ? "border-primary/40 bg-primary/5"
                  : "border-primary/10 hover:border-primary/30 hover:bg-primary/5"
              }`}
              onClick={() => onFileSelect(file)}
            >
              <div className="flex items-center justify-between">
                <span className="text-text text-sm truncate flex-1">
                  {file.name}
                </span>
                <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
                  <button
                    className="p-1 text-yellow-400 hover:bg-yellow-400/10 rounded transition-all duration-200 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRenameFile(file);
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    className="p-1 text-red-400 hover:bg-red-400/10 rounded transition-all duration-200 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile(file);
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4">
            <div className="text-3xl mb-1">📦</div>
            <p className="text-text/60 text-xs">No files</p>
          </div>
        )}
      </div>

      <ActionButton
        icon="➕"
        label="New File"
        variant="primary"
        onClick={onCreateFile}
      />
    </div>
  );
}
