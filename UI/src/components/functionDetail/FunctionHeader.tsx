interface FunctionHeaderProps {
	namespaceName?: string;
	functionName: string;
	fileCount: number;
	triggerCount: number;
	httpEnabled: boolean;
}

export function FunctionHeader({
	namespaceName,
	functionName,
	fileCount,
	triggerCount,
	httpEnabled,
}: FunctionHeaderProps) {
	return (
		<div className="w-full border-b border-white/[0.07] mb-6 pb-4 pt-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm">
					<span className="text-muted">{namespaceName}</span>
					<span className="text-muted/40">/</span>
					<span className="text-text font-semibold">{functionName}</span>
				</div>
				<div className="flex items-center gap-4 text-xs text-muted">
					<span>
						{fileCount} {fileCount === 1 ? "file" : "files"}
					</span>
					<span>{triggerCount} triggers</span>
					<span className={httpEnabled ? "text-green-400" : "text-muted/50"}>
						{httpEnabled ? "HTTP on" : "HTTP off"}
					</span>
				</div>
			</div>
		</div>
	);
}
