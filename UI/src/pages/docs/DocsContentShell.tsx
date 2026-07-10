import type { ReactNode } from "react";
import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

type DocsContentShellProps = {
	children: ReactNode;
};

export function DocsContentShell({ children }: DocsContentShellProps) {
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
			</div>
		</div>
	);
}
