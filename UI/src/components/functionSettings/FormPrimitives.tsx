import type { ReactNode } from "react";
import { labelClass } from "../modals/Modal";

/** Card that frames one section of the routed function settings page. */
export function SettingsSection({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<section className="space-y-4 rounded-xl border border-white/[0.07] bg-surface p-5">
			<div>
				<h2 className="text-sm font-semibold text-text">{title}</h2>
				{description && (
					<p className="mt-1 text-xs text-muted">{description}</p>
				)}
			</div>
			<div className="space-y-4">{children}</div>
		</section>
	);
}

/** Labelled form control with an optional hint, shared by all settings sections. */
export function SettingsField({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: ReactNode;
}) {
	return (
		<div>
			<label className={labelClass}>{label}</label>
			{children}
			{hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
		</div>
	);
}
