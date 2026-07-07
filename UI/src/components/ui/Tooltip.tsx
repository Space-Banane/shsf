import { ReactNode } from "react";

interface TooltipProps {
	content: ReactNode;
	children: ReactNode;
	placement?: "top" | "bottom" | "left" | "right";
	className?: string;
}

const placements: Record<string, string> = {
	top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
	bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
	left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
	right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

export function Tooltip({
	content,
	children,
	placement = "top",
	className,
}: TooltipProps) {
	return (
		<span
			className={`relative group/tt inline-flex items-center${className ? ` ${className}` : ""}`}
		>
			{children}
			<span
				role="tooltip"
				className={`pointer-events-none absolute ${placements[placement]} z-[60] hidden group-hover/tt:block`}
			>
				<span className="block bg-[#1a1b2e] border border-primary/30 text-text text-xs px-2.5 py-1.5 rounded-lg shadow-xl w-max max-w-[240px] break-words leading-relaxed">
					{content}
				</span>
			</span>
		</span>
	);
}

export function HelpTooltip({
	content,
	placement = "top",
}: {
	content: ReactNode;
	placement?: "top" | "bottom" | "left" | "right";
}) {
	return (
		<Tooltip content={content} placement={placement}>
			<span
				aria-label="Help"
				className="inline-flex items-center justify-center w-[1.05rem] h-[1.05rem] rounded-full border border-primary/30 bg-primary/10 text-primary/60 hover:text-primary hover:border-primary/50 hover:bg-primary/20 text-[10px] font-bold cursor-help transition-all duration-150 select-none"
			>
				?
			</span>
		</Tooltip>
	);
}
