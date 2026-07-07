import React from "react";
import { TriggerLog } from "../../../types/Prisma";
import { useConfirm } from "../../modals/ConfirmModal";
import { Icon } from "../../ui/Icon";

interface TriggerLogCardProps {
	log: TriggerLog;
	expanded: boolean;
	onToggle: (logId: number) => void;
	onDelete: () => void;
}

const TriggerLogCard: React.FC<TriggerLogCardProps> = ({ log, expanded, onToggle, onDelete }) => {
	const confirm = useConfirm();

	const handleDelete = async (e: React.MouseEvent) => {
		e.stopPropagation();
		const confirmed = await confirm({
			title: "Delete Log",
			message: "Are you sure you want to delete this specific log?",
			confirmText: "Delete",
			variant: "delete",
		});
		if (confirmed) onDelete();
	};

	const detailCls =
		"bg-background/40 border border-white/[0.07] rounded-lg p-3 overflow-auto";
	const sectionHeaderCls = "text-xs font-medium text-muted uppercase tracking-wider mb-2";

	return (
		<div className="bg-surface border border-white/[0.07] rounded-lg overflow-hidden hover:border-white/[0.12] transition-colors">
			<div
				className="px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
				onClick={() => onToggle(log.id)}
			>
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium text-text">
							{new Date(log.createdAt).toLocaleString()}
						</p>
						<p className="text-xs text-muted">Execution #{log.id}</p>
					</div>
					<div className="flex items-center gap-3">
						<button
							onClick={handleDelete}
							className="p-1.5 text-muted hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
							title="Delete log"
						>
							<Icon name="trash" className="w-3.5 h-3.5" />
						</button>
						<Icon
							name="chevron-right"
							className={`w-4 h-4 text-muted transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
						/>
					</div>
				</div>
			</div>

			{expanded && (
				<div className="border-t border-white/[0.07] p-4 space-y-4">
					{log.result &&
						(() => {
							let requestData;
							try {
								requestData = JSON.parse(JSON.parse(log.result).payload);
							} catch {
								requestData = null;
							}
							if (requestData && typeof requestData === "object") {
								return (
									<div>
										<p className={sectionHeaderCls}>Request Details</p>
										<div className={detailCls}>
											<div className="flex flex-wrap gap-4 mb-2 text-xs">
												<span>
													<span className="text-muted">Method: </span>
													<span className="text-text font-mono">{requestData.method}</span>
												</span>
												<span>
													<span className="text-muted">Route: </span>
													<span className="text-text font-mono">{requestData.route}</span>
												</span>
												<span>
													<span className="text-muted">IP: </span>
													<span className="text-text font-mono">{requestData.source_ip}</span>
												</span>
											</div>
											{requestData.headers && (
												<details className="mb-1">
													<summary className="cursor-pointer text-primary text-xs font-medium">Headers</summary>
													<pre className="text-text/70 text-xs font-mono whitespace-pre-wrap bg-background/40 rounded p-2 mt-1">
														{JSON.stringify(requestData.headers, null, 2)}
													</pre>
												</details>
											)}
											{requestData.body && (
												<details>
													<summary className="cursor-pointer text-primary text-xs font-medium">Body</summary>
													<pre className="text-text/70 text-xs font-mono whitespace-pre-wrap bg-background/40 rounded p-2 mt-1">
														{JSON.stringify(requestData.body, null, 2)}
													</pre>
												</details>
											)}
										</div>
									</div>
								);
							}
							return null;
						})()}

					{log.logs && (
						<div>
							<p className={sectionHeaderCls}>Output Logs</p>
							<div className={`${detailCls} max-h-60`}>
								<pre className="text-text/80 text-xs font-mono whitespace-pre-wrap">{log.logs}</pre>
							</div>
						</div>
					)}

					{log.result && (
						<div>
							<p className={sectionHeaderCls}>Timing</p>
							<div className={detailCls}>
								{JSON.parse(log.result)?.tooks?.map((took: any, index: number) => (
									<div
										key={index}
										className="flex items-center justify-between py-1 border-b border-white/[0.04] last:border-0"
									>
										<span className="text-muted text-xs">{took.description}</span>
										<span className="text-text text-xs font-mono">{took.value} ms</span>
									</div>
								)) || (
									<p className="text-muted text-xs">No timing details available</p>
								)}
							</div>
						</div>
					)}

					{log.result && (
						<div>
							<p className={sectionHeaderCls}>Execution Result</p>
							<div className={`${detailCls} max-h-60`}>
								<pre className="text-text/80 text-xs font-mono whitespace-pre-wrap">
									{(() => {
										try {
											const parsedResult = JSON.parse(log.result);
											if (parsedResult && typeof parsedResult.output === "string") {
												const match = parsedResult.output.match(
													/SHSF_FUNCTION_RESULT_START\s*\n?([\s\S]*?)\n?SHSF_FUNCTION_RESULT_END/,
												);
												return match?.[1]?.trim() || parsedResult.output;
											}
											return "No execution result";
										} catch {
											return "Invalid JSON format in result";
										}
									})()}
								</pre>
							</div>
						</div>
					)}

					<div className="flex justify-between text-xs text-muted pt-2 border-t border-white/[0.04]">
						<span>{new Date(log.createdAt).toLocaleString()}</span>
						{log.updatedAt && <span>Updated: {new Date(log.updatedAt).toLocaleString()}</span>}
					</div>
				</div>
			)}
		</div>
	);
};

export default TriggerLogCard;
