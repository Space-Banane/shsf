/** Marks a resource someone else owns and shows who and at what level. */
export default function SharedBadge({ owner, access }: { owner?: string; access?: string }) {
	return (
		<span
			title={owner ? `Shared by ${owner}` : "Shared with you"}
			className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-yellow-500/15 text-yellow-300 border-yellow-500/20 shrink-0"
		>
			{`Shared${owner ? ` by ${owner}` : ""}${access ? ` · ${access}` : ""}`}
		</span>
	);
}
