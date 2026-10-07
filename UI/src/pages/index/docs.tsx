import { documentation } from "../docs/docsRegistry";

export const DocsPage = () => (
	<div className="min-h-screen bg-background px-6 py-10 text-text sm:px-8">
		<div className="mx-auto max-w-5xl">
			<header className="mb-10 max-w-3xl">
				<p className="text-sm font-semibold uppercase tracking-widest text-primary">SHSF documentation</p>
				<h1 className="mt-3 text-4xl font-bold tracking-tight text-text sm:text-5xl">Build and run serverless functions</h1>
				<p className="mt-4 text-lg leading-8 text-text/80">Start with the basics, then follow the guides in order or jump to a related topic.</p>
			</header>

			{(["Getting started", "Building functions", "Advanced"] as const).map((category) => (
				<section key={category} className="mb-12" aria-labelledby={`${category}-heading`}>
					<h2 id={`${category}-heading`} className="mb-4 text-xl font-semibold text-primary">{category}</h2>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{documentation.filter((entry) => entry.category === category).map((entry, index) => (
							<a key={entry.key} href={entry.path} className="group rounded-xl border border-primary/20 bg-surface p-5 transition-colors hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
								<p className="text-xs font-medium text-muted">{String(index + 1).padStart(2, "0")}</p>
								<h3 className="mt-2 text-lg font-semibold text-text group-hover:text-primary">{entry.title}</h3>
								<p className="mt-2 text-sm leading-6 text-text/75">{entry.description}</p>
							</a>
						))}
					</div>
				</section>
			))}
		</div>
	</div>
);
