import React, { useEffect, useState } from "react";
import { BASE_URL, VERSION } from "../..";

const FOOTER_CONFIG = {
	brand: {
		name: "SHSF",
		tagline: "Self-Hostable Serverless Functions",
		author: "Space",
		authorUrl: "https://space.reversed.dev",
	},
	columns: [
		{
			title: "Resources",
			links: [
				{ label: "Documentation", href: "/docs" },
				{ label: "GitHub", href: "https://github.com/Space-Banane/shsf", external: true },
				{ label: "Report a Bug", href: "https://github.com/Space-Banane/shsf/issues", external: true },
			],
		},
		{
			title: "Platform",
			links: [
				{ label: "Functions", href: "/functions" },
				{ label: "Storage", href: "/storage" },
				{ label: "Account", href: "/account" },
			],
		},
	],
	socials: [
		{
			label: "Discord Community",
			href: "https://discord.gg/c7b8JXbC5X",
			icon: "discord",
		},
		{
			label: "GitHub",
			href: "https://github.com/Space-Banane/shsf",
			icon: "github",
		},
	],
};
// ─────────────────────────────────────────────

const icons: Record<string, React.ReactElement> = {
	discord: (
		<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
			<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
		</svg>
	),
	github: (
		<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
			<path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
		</svg>
	),
};

export function Footer() {
	const { brand, columns, socials } = FOOTER_CONFIG;

	const uiVersion = `${VERSION.major}.${VERSION.minor}.${VERSION.patch}`;
	const [apiVersion, setApiVersion] = useState<string | null>(null);
	const [versionError, setVersionError] = useState(false);

	useEffect(() => {
		fetch(`${BASE_URL}/version`)
			.then((r) => r.json())
			.then((data) => {
				if (data?.version?.raw) setApiVersion(data.version.raw);
				else setVersionError(true);
			})
			.catch(() => setVersionError(true));
	}, []);

	const versionStatus: "loading" | "ok" | "ui-behind" | "api-behind" | "error" = (() => {
		if (versionError) return "error";
		if (apiVersion === null) return "loading";
		if (apiVersion === uiVersion) return "ok";
		const parse = (v: string) => v.split(".").map(Number);
		const [aMaj, aMin, aPat] = parse(apiVersion);
		const [uMaj, uMin, uPat] = parse(uiVersion);
		const apiNewer =
			aMaj > uMaj || (aMaj === uMaj && aMin > uMin) || (aMaj === uMaj && aMin === uMin && aPat > uPat);
		return apiNewer ? "ui-behind" : "api-behind";
	})();

	return (
		<footer className="bg-footer border-t border-blue-700/30 text-base">
			{/* Main grid */}
			<div className="container mx-auto px-6 pt-10 pb-6">
				<div className="grid grid-cols-1 gap-8 md:grid-cols-[2fr_1fr_1fr]">
					{/* Brand column */}
					<div className="flex flex-col gap-3 max-w-xs">
						<a href="/" className="flex items-center gap-2">
							<span className="text-primary font-extrabold text-2xl">{"{}"}</span>
							<span className="text-primary font-bold text-xl">{brand.name}</span>
						</a>
						<p className="text-grayed text-sm leading-relaxed">{brand.tagline}</p>
						{/* Socials */}
						<div className="flex items-center gap-3 mt-1">
							{socials.map((s) => (
								<a
									key={s.href}
									href={s.href}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={s.label}
									className="text-grayed hover:text-primary transition-colors duration-200"
								>
									{icons[s.icon]}
								</a>
							))}
						</div>
						{/* Discord call-to-action */}
						{socials.find((s) => s.icon === "discord") && (
							<a
								href={socials.find((s) => s.icon === "discord")!.href}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 mt-1 px-3 py-1.5 rounded-md bg-[#5865F2]/15 border border-[#5865F2]/30 text-[#96aaf8] hover:bg-[#5865F2]/25 hover:border-[#5865F2]/50 transition-all duration-200 text-sm font-medium w-fit"
							>
								{icons["discord"]}
								Join the Community
							</a>
						)}
					</div>

					{/* Link columns */}
					{columns.map((col) => (
						<div key={col.title} className="flex flex-col gap-3">
							<h4 className="text-text font-semibold text-sm uppercase tracking-wider">
								{col.title}
							</h4>
							<ul className="flex flex-col gap-2">
								{col.links.map((link) => (
									<li key={link.href}>
										<a
											href={link.href}
											{...(link.external
												? { target: "_blank", rel: "noopener noreferrer" }
												: {})}
											className="text-grayed hover:text-secondary text-sm transition-colors duration-200"
										>
											{link.label}
										</a>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				{/* Bottom bar */}
				<div className="mt-8 pt-4 border-t border-blue-700/20 flex flex-col sm:flex-row items-center justify-between gap-2 text-grayed text-sm">
					<p>
						Made with{" "}
						<span className="text-red-500">♥</span>{" "}
						by{" "}
						<a
							href={brand.authorUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-secondary hover:text-primary transition-colors duration-200"
						>
							{brand.author}
						</a>
					</p>
					<div className="flex items-center gap-2">
						<span>UI v{uiVersion}</span>
						{versionStatus === "error" ? (
							<span className="text-grayed/50" title="Could not reach API">· API unavailable</span>
						) : versionStatus === "loading" ? (
							<span className="text-grayed/50">· checking API…</span>
						) : versionStatus === "ok" ? (
							<span className="text-green-500/70">· API v{apiVersion} ✓</span>
						) : versionStatus === "ui-behind" ? (
							<span
								title={`API is v${apiVersion}, UI is v${uiVersion} — update the UI`}
								className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-xs font-medium"
							>
								<svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
									<path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" />
								</svg>
								UI out of date (v{uiVersion} → v{apiVersion})
							</span>
						) : (
							<span
								title={`UI is v${uiVersion}, API is v${apiVersion} — update the backend`}
								className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-medium"
							>
								<svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
									<path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" />
								</svg>
								Backend out of date (v{apiVersion} → v{uiVersion})
							</span>
						)}
					</div>
				</div>
			</div>
		</footer>
	);
}
