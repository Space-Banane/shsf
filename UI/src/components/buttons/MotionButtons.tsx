import { motion } from "motion/react";

type MotionButtonProps = {
	label: string;
	onClick?: () => void;
	className?: string;
	variant?: "default" | "secondary";
	onHoverStart?: () => void;
	disabled?: boolean;
	size?: "sm" | "md" | "lg";
	font?: "default" | "margarine";
	background?: "bright_fill" | "outlined";
};

const sizeClasses = {
	sm: "px-4 py-2 text-base",
	md: "px-6 py-3 text-lg",
	lg: "px-8 py-4 text-xl",
};

const backgroundClasses = {
	bright_fill: "bg-primary text-background",
	outlined: "border-2 border-primary text-primary bg-transparent",
};

const baseVariantClasses = {
	default: "rounded-xl inline-block",
	secondary: "rounded-xl hover:bg-primary/10 hover:shadow-lg",
};

function getVariantClasses(
	variant: "default" | "secondary",
	font: "default" | "margarine",
) {
	let classes = baseVariantClasses[variant];
	if (font === "margarine") {
		classes += " font-margarine";
	}
	return classes;
}

const variantHover = {
	default: {
		scale: 1.05,
		boxShadow: "0 0 30px rgba(124,131,253,0.3)",
	},
	secondary: {
		scale: 1.05,
	},
};

const variantTap = {
	default: { scale: 0.97 },
	secondary: { scale: 0.976 },
};

export function MotionButton({
	label,
	onClick,
	className = "",
	variant = "default",
	onHoverStart,
	disabled = false,
	font = "default",
	size = "lg",
	background = "bright_fill",
}: MotionButtonProps) {
	const variantClass = getVariantClasses(variant, font);

	return (
		<motion.button
			whileHover={disabled ? undefined : variantHover[variant]}
			whileTap={disabled ? undefined : variantTap[variant]}
			onHoverStart={disabled ? undefined : onHoverStart}
			className={`${sizeClasses[size]} ${backgroundClasses[background]} ${
				variantClass
			} ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
			onClick={disabled ? undefined : onClick}
			disabled={disabled}
		>
			{label}
		</motion.button>
	);
}
