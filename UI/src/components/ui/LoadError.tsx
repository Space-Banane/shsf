/** Inline failure surface for a panel or form whose data could not be loaded. */
export function LoadError({
	message,
	onRetry,
	className = "",
}: {
	message: string;
	onRetry: () => void;
	className?: string;
}) {
	return (
		<div
			role="alert"
			className={`rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 ${className}`}
		>
			<p className="text-sm text-red-400">{message}</p>
			<button
				type="button"
				onClick={onRetry}
				className="mt-2 text-xs font-medium text-red-300 underline hover:text-red-200"
			>
				Retry
			</button>
		</div>
	);
}
