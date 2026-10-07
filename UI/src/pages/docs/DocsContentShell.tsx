import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";
import { getDocumentationNavigation } from "./docsRegistry";

type DocsContentShellProps = {
	children: ReactNode;
};

export function DocsContentShell({ children }: DocsContentShellProps) {
	const { pathname } = useLocation();
	const { previous, next, related } = getDocumentationNavigation(pathname);

	return (
		<div className="min-h-screen bg-background px-6 py-8 text-text sm:px-8">
			<div className="mx-auto max-w-5xl">
				<div className="mb-6">
					<a
						href="/docs"
						className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
					>
						<span className="text-base">←</span>
						Back to docs
					</a>
				</div>

				<ScrollProgressbar />

				<article
					className="
						space-y-4
						[&_a]:text-blue-400
						[&_a]:transition-colors
						[&_a:hover]:text-blue-300
						[&_a:hover]:underline
						[&_code]:font-mono
						[&_code]:text-primary/95
						[&_pre_code]:text-text/85
						[&_h1]:mb-3
						[&_h1]:text-3xl
						[&_h1]:font-bold
						[&_h1]:tracking-tight
						[&_h1]:text-primary
						md:[&_h1]:text-4xl
						[&_h1+p]:mb-8
						[&_h1+p]:max-w-3xl
						[&_h1+p]:text-lg
						[&_h1+p]:leading-8
						[&_h1+p]:text-text/90
						[&_h2]:mt-10
						[&_h2]:border-b
						[&_h2]:border-primary/15
						[&_h2]:pb-3
						[&_h2]:text-2xl
						[&_h2]:font-bold
						[&_h2]:text-primary
						[&_h3]:mt-8
						[&_h3]:text-xl
						[&_h3]:font-semibold
						[&_h3]:text-primary
						[&_label]:text-sm
						[&_label]:font-medium
						[&_label]:text-muted
						[&_li]:leading-7
						[&_ol]:mb-6
						[&_ol]:space-y-2
						[&_ol]:text-text/90
						[&_ol]:pl-6
						[&_p]:text-text/90
						[&_p]:leading-7
						[&_pre]:mb-6
						[&_pre]:overflow-x-auto
						[&_pre]:rounded-xl
						[&_pre]:border
						[&_pre]:border-primary/15
						[&_pre]:bg-surface-raised
						[&_pre]:p-4
						[&_pre]:text-sm
						[&_strong]:text-primary
						[&_ul]:mb-6
						[&_ul]:space-y-2
						[&_ul]:text-text/90
						[&_ul]:pl-6
					"
				>
					{children}
				</article>

				<nav className="mt-12 border-t border-primary/20 pt-6" aria-label="Documentation navigation">
					<div className="grid gap-3 sm:grid-cols-2">
						{previous ? (
							<a href={previous.path} className="rounded-lg border border-primary/20 p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
								<span className="block text-xs text-muted">Previous</span>
								<span className="mt-1 block font-medium text-text">← {previous.title}</span>
							</a>
						) : <span />}
						{next ? (
							<a href={next.path} className="rounded-lg border border-primary/20 p-4 text-right transition-colors hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
								<span className="block text-xs text-muted">Next</span>
								<span className="mt-1 block font-medium text-text">{next.title} →</span>
							</a>
						) : <span />}
					</div>
					{related.length > 0 && (
						<div className="mt-6">
							<h2 className="text-sm font-semibold text-muted">Related guides</h2>
							<ul className="mt-3 flex flex-wrap gap-2">
								{related.map((entry) => (
									<li key={entry.key}>
										<a href={entry.path} className="inline-flex rounded-full border border-primary/20 px-3 py-1.5 text-sm text-blue-400 transition-colors hover:border-primary/60 hover:text-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
											{entry.title}
										</a>
									</li>
								))}
							</ul>
						</div>
					)}
				</nav>
			</div>
		</div>
	);
}
