import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

function describeRouteError(error: unknown): string {
	if (isRouteErrorResponse(error)) {
		return error.statusText || `Request failed with status ${error.status}.`;
	}
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return "An unexpected error occurred while rendering this page.";
}

/** Root router error boundary: keeps a render failure from leaving a blank page. */
export function RouteError() {
	const error = useRouteError();

	return (
		<div role="alert" className="mx-auto mt-16 max-w-xl">
			<div className="rounded-xl border border-red-500/20 bg-surface px-5 py-4">
				<h1 className="text-base font-semibold text-text">Something went wrong</h1>
				<p className="mt-1 break-words text-sm text-red-400">{describeRouteError(error)}</p>
				<div className="mt-4 flex items-center gap-3">
					<button
						type="button"
						className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-background"
						onClick={() => window.location.reload()}
					>
						Reload
					</button>
					<Link to="/" className="text-sm font-medium text-muted hover:text-text">
						Go home
					</Link>
				</div>
			</div>
		</div>
	);
}
