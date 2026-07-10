import type { ReactNode } from "react";

/**
 * Shared building blocks for SHSF documentation pages.
 *
 * These primitives keep every doc page visually consistent. Typography for
 * plain elements (h2, h3, p, ul, ol, pre, code, label) is handled centrally by
 * DocsContentShell's `article` styles — so inside a page you can just write
 * semantic HTML and it will be styled uniformly. Use the components below for
 * the header, callouts, code captions, and the "next step" card.
 */

type DocHeaderProps = {
	title: ReactNode;
	children: ReactNode;
};

/**
 * Page title + intro paragraph. Rendered as a fragment so the intro `<p>` stays
 * adjacent to the `<h1>` and picks up the shell's lead-paragraph styling.
 */
export function DocHeader({ title, children }: DocHeaderProps) {
	return (
		<>
			<h1>{title}</h1>
			<p>{children}</p>
		</>
	);
}

type CalloutVariant = "note" | "info" | "tip" | "success" | "warning" | "danger";

const CALLOUT_STYLES: Record<
	CalloutVariant,
	{ wrap: string; head: string; icon: string; label: string }
> = {
	note: {
		wrap: "border-blue-500/40 bg-blue-900/20",
		head: "text-blue-300",
		icon: "ℹ️",
		label: "Note",
	},
	info: {
		wrap: "border-blue-500/40 bg-blue-900/20",
		head: "text-blue-300",
		icon: "ℹ️",
		label: "Good to know",
	},
	tip: {
		wrap: "border-emerald-500/40 bg-emerald-900/20",
		head: "text-emerald-300",
		icon: "💡",
		label: "Tip",
	},
	success: {
		wrap: "border-green-500/40 bg-green-900/20",
		head: "text-green-300",
		icon: "✅",
		label: "Success",
	},
	warning: {
		wrap: "border-yellow-500/50 bg-yellow-900/20",
		head: "text-yellow-300",
		icon: "⚠️",
		label: "Warning",
	},
	danger: {
		wrap: "border-red-500/50 bg-red-900/20",
		head: "text-red-300",
		icon: "🛑",
		label: "Danger",
	},
};

type CalloutProps = {
	variant?: CalloutVariant;
	title?: ReactNode;
	children: ReactNode;
};

/**
 * A highlighted callout box. Use `warning`/`danger` for hazards placed at the
 * top of a page, and `note`/`tip`/`success` for inline guidance.
 */
export function Callout({ variant = "note", title, children }: CalloutProps) {
	const style = CALLOUT_STYLES[variant];
	return (
		<div className={`my-6 rounded-xl border-l-4 p-4 ${style.wrap}`}>
			<div className={`mb-2 flex items-center gap-2 font-semibold ${style.head}`}>
				<span aria-hidden>{style.icon}</span>
				<span>{title ?? style.label}</span>
			</div>
			<div className="space-y-2 text-sm text-text/85 [&_a]:text-blue-300 [&_code]:text-primary/95">
				{children}
			</div>
		</div>
	);
}

type CodeCaptionProps = {
	children: ReactNode;
};

/** Small muted caption shown above a code block (e.g. "Example (Python)"). */
export function CodeCaption({ children }: CodeCaptionProps) {
	return <label className="mb-2 block">{children}</label>;
}

type NextStepProps = {
	href: string;
	label: ReactNode;
	children: ReactNode;
};

/** The "Next Step" call-to-action card at the bottom of a doc page. */
export function NextStep({ href, label, children }: NextStepProps) {
	return (
		<div className="mt-12 rounded-xl border border-primary/30 bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-6">
			<div className="mb-3 text-xl font-bold text-primary">🚀 Next Step</div>
			<p className="mb-4 text-text/90">{children}</p>
			<a
				href={href}
				className="inline-flex items-center gap-2 font-medium text-blue-400 transition-colors hover:text-blue-300"
			>
				{label}
				<span className="text-lg">→</span>
			</a>
		</div>
	);
}
