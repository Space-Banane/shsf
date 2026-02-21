import { FunctionFile } from "../../types/Prisma";
import { ActionButton } from "../buttons/ActionButton";

export function FileManagerCard({
	files,
	activeFile,
	onFileSelect,
	onCreateFile,
	onRenameFile,
	onDeleteFile,
	onAIGenerate,
}: {
	files: FunctionFile[];
	activeFile: FunctionFile | null;
	onFileSelect: (file: FunctionFile) => void;
	onCreateFile: () => void;
	onRenameFile: (file: FunctionFile) => void;
	onDeleteFile: (file: FunctionFile) => void;
	onAIGenerate?: () => void;
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
								<span className="text-text text-sm truncate flex-1">{file.name}</span>
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
			{onAIGenerate && (
				<button
					onClick={onAIGenerate}
					className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-200"
					style={{
						background:
							"linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.12))",
						border: "1px solid rgba(99,102,241,0.3)",
						color: "#a5b4fc",
					}}
					onMouseEnter={(e) => {
						(e.currentTarget as HTMLButtonElement).style.boxShadow =
							"0 0 14px rgba(99,102,241,0.3)";
						(e.currentTarget as HTMLButtonElement).style.borderColor =
							"rgba(99,102,241,0.55)";
					}}
					onMouseLeave={(e) => {
						(e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
						(e.currentTarget as HTMLButtonElement).style.borderColor =
							"rgba(99,102,241,0.3)";
					}}
				>
					<svg className="w-3.5 h-3.5 text-orange-400 fill-orange-400" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
						<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
					</svg>
					KICKOFF
				</button>
			)}
		</div>
	);
}
