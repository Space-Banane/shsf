export function ActionButton({
	icon,
	label,
	variant = "primary",
	onClick,
	disabled = false,
}: {
	icon: string;
	label: string;
	variant?: "primary" | "secondary" | "delete";
	onClick: () => void;
	disabled?: boolean;
}) {
	const baseClasses =
		"px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100";
	const variantClasses = {
		primary:
			"bg-blue-600 text-white border border-blue-700 hover:bg-blue-700 hover:border-blue-800",
		secondary:
			"bg-background/50 border border-primary/20 text-primary hover:border-primary/40 hover:bg-primary/5",
		delete:
			"bg-red-600 text-white border border-red-700 hover:bg-red-700 hover:border-red-800",
	};

	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={`${baseClasses} ${variantClasses[variant]} w-full`}
			style={{
				cursor: disabled ? "not-allowed" : "pointer",
			}}
		>
			<span className="text-sm">{icon}</span>
			<span className="text-sm">{label}</span>
		</button>
	);
}
