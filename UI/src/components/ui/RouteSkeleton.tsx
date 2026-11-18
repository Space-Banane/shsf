export function RouteSkeleton() {
	return (
		<div role="status" aria-label="Loading page" className="space-y-6 py-4 animate-pulse">
			<div className="h-8 w-1/3 rounded-lg bg-white/10" />
			<div className="h-4 w-2/3 rounded bg-white/5" />
			<div className="h-64 rounded-xl bg-white/5" />
		</div>
	);
}
