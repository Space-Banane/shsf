import Editor, { type OnMount } from "@monaco-editor/react";

interface CodeEditorPanelProps {
	hasActiveFile: boolean;
	gitManaged: boolean;
	language: string;
	code: string | null;
	onChange: (value: string) => void;
	onMount: OnMount;
	onOpenVersionControl: () => void;
	readOnly?: boolean;
}

export function CodeEditorPanel({
	hasActiveFile,
	gitManaged,
	language,
	code,
	onChange,
	onMount,
	onOpenVersionControl,
	readOnly = false,
}: CodeEditorPanelProps) {
	return (
		<div className="bg-surface border border-white/[0.07] rounded-xl overflow-hidden">
			<div className="h-[600px] relative">
				{gitManaged ? (
					<div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm text-center z-10">
						<div className="space-y-4 px-6">
							<div className="text-5xl">🔀</div>
							<h3 className="text-lg font-bold text-primary">Editor Disabled</h3>
							<p className="text-text/70 text-sm max-w-xs">
								This function uses a git repository as its source. Manage files
								through version control.
							</p>
							<button
								onClick={onOpenVersionControl}
								className="mt-1 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-background hover:bg-primary/90 transition-all duration-300"
							>
								Open Version Control
							</button>
						</div>
					</div>
				) : !hasActiveFile ? (
					<div className="absolute inset-0 flex items-center justify-center bg-background/50 text-center">
						<div className="space-y-3">
							<div className="text-5xl">📝</div>
							<h3 className="text-lg font-bold text-primary">No File Selected</h3>
							<p className="text-text/70 text-sm">Select a file from the sidebar</p>
						</div>
					</div>
				) : null}
				{hasActiveFile && (
					<Editor
						theme="vs-dark"
						height="100%"
						language={language}
						value={code || ""}
						onChange={(value) => onChange(value || "")}
						onMount={onMount}
						options={{
							readOnly: gitManaged || readOnly,
							minimap: { enabled: true },
							scrollBeyondLastLine: false,
							fontSize: 13,
							tabSize: 4,
							"semanticHighlighting.enabled": true,
							codeLens: true,
							automaticLayout: true,
							smoothScrolling: true,
							overviewRulerBorder: false,
						}}
					/>
				)}
			</div>
		</div>
	);
}
