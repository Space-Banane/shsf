import React, { useEffect } from "react";
import { Icon } from "../ui/Icon";

export const inputClass =
	"w-full px-3 py-2 bg-background border border-white/[0.07] rounded-lg text-text text-sm focus:border-primary/50 focus:outline-none placeholder:text-muted/60 disabled:opacity-50";

export const selectClass =
	"w-full px-3 py-2 bg-background border border-white/[0.07] rounded-lg text-text text-sm focus:border-primary/50 focus:outline-none disabled:opacity-50";

export const textareaClass =
	"w-full px-3 py-2 bg-background border border-white/[0.07] rounded-lg text-text text-sm focus:border-primary/50 focus:outline-none resize-none disabled:opacity-50 placeholder:text-muted/60";

export const labelClass = "block text-xs font-medium text-muted mb-1.5";

export const cancelBtnClass =
	"px-4 py-2 border border-white/[0.07] text-text/70 text-sm font-medium rounded-lg hover:bg-white/[0.04] hover:text-text transition-colors disabled:opacity-50";

export const primaryBtnClass =
	"px-4 py-2 bg-primary text-background text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const deleteBtnClass =
	"px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium rounded-lg hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export function ModalSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-3">
			<h3 className="text-xs font-medium text-muted uppercase tracking-wider">{title}</h3>
			{children}
		</div>
	);
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.07] mt-6">
			{children}
		</div>
	);
}

export function ModalError({ message }: { message?: string | null }) {
	if (!message) return null;
	return (
		<div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
			{message}
		</div>
	);
}

interface ToggleRowProps {
	id: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	label: string;
	description?: string;
}

export function ToggleRow({ id, checked, onChange, disabled, label, description }: ToggleRowProps) {
	return (
		<div className="flex items-center justify-between py-3 px-4 bg-background/40 border border-white/[0.07] rounded-lg">
			<div>
				<p className="text-sm font-medium text-text">{label}</p>
				{description && <p className="text-xs text-muted mt-0.5">{description}</p>}
			</div>
			<input
				type="checkbox"
				id={id}
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				disabled={disabled}
				className="sr-only peer"
			/>
			<label
				htmlFor={id}
				className="w-9 h-5 bg-white/10 rounded-full peer-checked:bg-primary cursor-pointer relative flex items-center transition-colors shrink-0 ml-4"
			>
				<div
					className={`absolute w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
						checked ? "translate-x-4" : "translate-x-0.5"
					}`}
				/>
			</label>
		</div>
	);
}

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	maxWidth?: "sm" | "md" | "lg" | "xl";
	isLoading?: boolean;
}

function Modal({
	isOpen,
	onClose,
	title,
	children,
	maxWidth = "md",
	isLoading = false,
}: ModalProps) {
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isLoading) onClose();
		};
		if (isOpen) document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isOpen, onClose, isLoading]);

	if (!isOpen) return null;

	const maxWidthClass = {
		sm: "max-w-sm",
		md: "max-w-md",
		lg: "max-w-2xl",
		xl: "max-w-4xl",
	}[maxWidth];

	return (
		<div
			className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
			onClick={() => !isLoading && onClose()}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				className={`bg-surface-raised border border-white/[0.07] rounded-xl shadow-2xl ${maxWidthClass} w-full flex flex-col max-h-[90vh] relative overflow-hidden`}
			>
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
					<h2 className="text-base font-semibold text-text">{title}</h2>
					{!isLoading && (
						<button
							onClick={onClose}
							className="p-1.5 text-muted hover:text-text hover:bg-white/[0.06] rounded transition-colors"
						>
							<Icon name="x-mark" className="w-4 h-4" />
						</button>
					)}
				</div>
				<div className="overflow-y-auto p-6 flex-1 relative" style={{ scrollbarWidth: "thin" }}>
					{isLoading && (
						<div className="absolute inset-0 bg-surface-raised/80 backdrop-blur-sm flex items-center justify-center z-10">
							<div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
						</div>
					)}
					{children}
				</div>
			</div>
		</div>
	);
}

export default Modal;
