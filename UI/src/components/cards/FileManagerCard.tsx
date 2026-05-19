import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type DragEvent,
} from "react";
import { FunctionFile } from "../../types/Prisma";
import { ActionButton } from "../buttons/ActionButton";

function SelectionToggle({
	checked,
	indeterminate = false,
	disabled = false,
	onClick,
}: {
	checked: boolean;
	indeterminate?: boolean;
	disabled?: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={checked}
			aria-label={indeterminate ? "Partially selected" : checked ? "Selected" : "Select"}
			disabled={disabled}
			onClick={(event) => {
				event.stopPropagation();
				if (!disabled) onClick();
			}}
			className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-200 ${
				disabled
					? "cursor-not-allowed border-white/10 bg-white/5 opacity-40"
					: checked || indeterminate
						? "border-primary/60 bg-primary text-white shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
						: "border-white/15 bg-white/5 text-white/30 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
			}`}
		>
			{indeterminate ? (
				<span className="h-0.5 w-2.5 rounded-full bg-current" />
			) : checked ? (
				<svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
					<path
						d="M4.5 10.5L8.2 14.2L15.5 5.8"
						stroke="currentColor"
						strokeWidth="2.2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			) : null}
		</button>
	);
}

export function FileManagerCard({
	files,
	activeFile,
	onFileSelect,
	onCreateFile,
	onDownloadFile,
	onRenameFile,
	onDeleteFile,
	onDeleteSelectedFiles,
	nonSelectableOnSelectAllFileNames = [],
	onDropFiles,
	onAIGenerate,
	aiDisabled = false,
	aiDisabledReason,
	disabled = false,
	disabledReason,
}: {
	files: FunctionFile[];
	activeFile: FunctionFile | null;
	onFileSelect: (file: FunctionFile) => void;
	onCreateFile: () => void;
	onDownloadFile: (file: FunctionFile) => void;
	onRenameFile: (file: FunctionFile) => void;
	onDeleteFile: (file: FunctionFile) => void;
	onDeleteSelectedFiles?: (files: FunctionFile[]) => boolean | Promise<boolean>;
	nonSelectableOnSelectAllFileNames?: string[];
	onDropFiles?: (files: File[]) => void | Promise<void>;
	onAIGenerate?: () => void;
	aiDisabled?: boolean;
	aiDisabledReason?: string;
	disabled?: boolean;
	disabledReason?: string;
}) {
	const [isDragOver, setIsDragOver] = useState(false);
	const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set());
	const uploadInputRef = useRef<HTMLInputElement>(null);
	const selectAllExcludedFileNames = useMemo(
		() => new Set(nonSelectableOnSelectAllFileNames),
		[nonSelectableOnSelectAllFileNames],
	);

	const selectableFiles = useMemo(
		() => files.filter((file) => !selectAllExcludedFileNames.has(file.name)),
		[files, selectAllExcludedFileNames],
	);
	const selectableFileIds = useMemo(
		() => selectableFiles.map((file) => file.id),
		[selectableFiles],
	);

	const selectedFiles = useMemo(
		() => files.filter((file) => selectedFileIds.has(file.id)),
		[files, selectedFileIds],
	);
	const selectedSelectableCount = selectedFiles.filter((file) =>
		selectableFileIds.includes(file.id),
	).length;
	const allSelectableFilesSelected =
		selectableFileIds.length > 0 && selectedSelectableCount === selectableFileIds.length;
	const hasPartialSelection =
		selectedSelectableCount > 0 && selectedSelectableCount < selectableFileIds.length;
	const hasSelectedFiles = selectedFiles.length > 0;

	useEffect(() => {
		setSelectedFileIds((prev) => {
			const availableIds = new Set(files.map((file) => file.id));
			const next = new Set(Array.from(prev).filter((id) => availableIds.has(id)));
			if (
				next.size === prev.size &&
				Array.from(next).every((id) => prev.has(id))
			) {
				return prev;
			}
			return next;
		});
	}, [files]);

	const toggleFileSelection = (fileId: number) => {
		setSelectedFileIds((prev) => {
			const next = new Set(prev);
			if (next.has(fileId)) {
				next.delete(fileId);
			} else {
				next.add(fileId);
			}
			return next;
		});
	};

	const handleSelectAll = () => {
		setSelectedFileIds((prev) => {
			const next = new Set(prev);
			if (allSelectableFilesSelected) {
				selectableFileIds.forEach((id) => next.delete(id));
			} else {
				selectableFileIds.forEach((id) => next.add(id));
			}
			return next;
		});
	};

	const clearSelection = () => {
		setSelectedFileIds(new Set());
	};

	const handleUploadClick = () => {
		uploadInputRef.current?.click();
	};

	const handleUploadChange = (event: ChangeEvent<HTMLInputElement>) => {
		if (!onDropFiles) return;
		const uploadedFiles = Array.from(event.target.files || []);
		event.target.value = "";
		if (uploadedFiles.length === 0) {
			return;
		}
		void onDropFiles(uploadedFiles);
	};

	const handleDeleteSelected = async () => {
		if (!onDeleteSelectedFiles || !hasSelectedFiles) return;
		const shouldDelete = await onDeleteSelectedFiles(selectedFiles);
		if (shouldDelete) {
			clearSelection();
		}
	};

	const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
		if (!onDropFiles) return;
		event.preventDefault();
		setIsDragOver(true);
	};

	const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
		if (!onDropFiles) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
		if (!isDragOver) {
			setIsDragOver(true);
		}
	};

	const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
		if (!onDropFiles) return;
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
			return;
		}
		setIsDragOver(false);
	};

	const handleDrop = (event: DragEvent<HTMLDivElement>) => {
		if (!onDropFiles) return;
		event.preventDefault();
		setIsDragOver(false);
		const droppedFiles = Array.from(event.dataTransfer.files || []);
		if (droppedFiles.length === 0) {
			return;
		}
		void onDropFiles(droppedFiles);
	};

	return (
		<div
			className={`bg-gradient-to-br from-gray-900/50 to-gray-800/50 border rounded-lg p-4 relative transition-all duration-200 ${
				isDragOver
					? "border-primary shadow-[0_0_0_1px_rgba(34,211,238,0.5),0_0_24px_rgba(34,211,238,0.18)] bg-primary/5"
					: "border-primary/20"
			} ${
				disabled ? "opacity-50 pointer-events-none select-none grayscale" : ""
			}`}
			onDragEnter={handleDragEnter}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<h2 className="text-lg font-bold text-primary mb-3 flex items-center gap-2">
				<span>📁</span>
				Files
			</h2>
			{disabled && disabledReason && (
				<div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-2 mb-3">
					<p className="text-yellow-300/80 text-xs">{disabledReason}</p>
				</div>
			)}

			<div className="mb-3 flex items-center justify-between gap-3 text-xs text-text/60">
				{files.length > 0 ? (
					<div className="flex items-center gap-2 select-none">
						<SelectionToggle
							checked={allSelectableFilesSelected}
							indeterminate={hasPartialSelection}
							disabled={selectableFileIds.length === 0}
							onClick={handleSelectAll}
						/>
						<button
							type="button"
							disabled={selectableFileIds.length === 0}
							onClick={handleSelectAll}
							className={`text-left transition-colors ${
								selectableFileIds.length === 0
									? "cursor-not-allowed text-text/35"
									: "text-text/70 hover:text-text"
							}`}
						>
							Select all
						</button>
					</div>
				) : (
					<span />
				)}
				{hasSelectedFiles ? (
					<button
						type="button"
						onClick={clearSelection}
						className="text-primary hover:text-primary/80 transition-colors"
					>
						Clear {selectedFiles.length}
					</button>
				) : (
					<span />
				)}
			</div>

			<div className="space-y-1 mb-3 max-h-64 overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-primary/30">
				{files.length > 0 ? (
					files.map((file) => (
						<div
							key={file.id}
							className={`bg-background/30 border rounded-lg p-2 cursor-pointer transition-all duration-200 ${
								selectedFileIds.has(file.id)
									? "border-primary/50 bg-primary/10"
									: activeFile?.id === file.id
										? "border-primary/40 bg-primary/5"
										: "border-primary/10 hover:border-primary/30 hover:bg-primary/5"
							}`}
							onClick={() => onFileSelect(file)}
						>
							<div className="flex items-center justify-between gap-2">
								<div className="flex min-w-0 flex-1 items-center gap-2">
									<SelectionToggle
										checked={selectedFileIds.has(file.id)}
										onClick={() => {
											toggleFileSelection(file.id);
										}}
									/>
									<span className="text-text text-sm truncate flex-1">
										{file.name}
									</span>
								</div>
								<div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
									<button
										className="p-1 text-blue-400 hover:bg-blue-400/10 rounded transition-all duration-200 text-xs"
										onClick={(e) => {
											e.stopPropagation();
											onDownloadFile(file);
										}}
									>
										⬇️
									</button>
									<button
										className="p-1 text-yellow-400 hover:bg-yellow-400/10 rounded transition-all duration-200 text-xs"
										onClick={(e) => {
											e.stopPropagation();
											onRenameFile(file);
										}}
									>
										✏️
									</button>
									<button
										className="p-1 text-red-400 hover:bg-red-400/10 rounded transition-all duration-200 text-xs"
										onClick={(e) => {
											e.stopPropagation();
											onDeleteFile(file);
										}}
									>
										🗑️
									</button>
								</div>
							</div>
						</div>
					))
				) : (
					<div className="text-center py-4">
						<div className="text-3xl mb-1">📦</div>
						<p className="text-text/60 text-xs">No files</p>
					</div>
				)}
			</div>

			{onDropFiles && (
				<div
					className={`mb-3 rounded-lg border border-dashed px-3 py-2 text-center text-xs transition-all duration-200 ${
						isDragOver
							? "border-primary/60 bg-primary/10 text-primary"
							: "border-primary/20 bg-background/20 text-text/60"
					}`}
				>
					{isDragOver ? "Drop files to create them here" : "Drag files here to add them"}
				</div>
			)}

			<ActionButton
				icon="➕"
				label="New File"
				variant="primary"
				onClick={onCreateFile}
			/>
			{onDropFiles && (
				<>
					<input
						ref={uploadInputRef}
						type="file"
						multiple
						className="hidden"
						onChange={handleUploadChange}
					/>
					<button
						type="button"
						onClick={handleUploadClick}
						className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-200 bg-background/50 border border-primary/20 text-primary hover:border-primary/40 hover:bg-primary/5"
					>
						📤 Upload Files
					</button>
				</>
			)}
			{onDeleteSelectedFiles && hasSelectedFiles && (
				<button
					type="button"
					onClick={() => {
						void handleDeleteSelected();
					}}
					className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-200 bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-500/20 hover:border-red-400/40"
				>
					🗑️ Delete Selected ({selectedFiles.length})
				</button>
			)}
			{onAIGenerate && (
				<button
					disabled={aiDisabled}
					onClick={onAIGenerate}
					className={`w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-200 ${
						aiDisabled ? "opacity-50 cursor-not-allowed" : ""
					}`}
					style={{
						background:
							"linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.12))",
						border: "1px solid rgba(99,102,241,0.3)",
						color: "#a5b4fc",
					}}
					onMouseEnter={(e) => {
						(e.currentTarget as HTMLButtonElement).style.boxShadow =
							"0 0 14px rgba(99,102,241,0.3)";
						(e.currentTarget as HTMLButtonElement).style.borderColor =
							"rgba(99,102,241,0.55)";
					}}
					onMouseLeave={(e) => {
						(e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
						(e.currentTarget as HTMLButtonElement).style.borderColor =
							"rgba(99,102,241,0.3)";
					}}
					>
						<svg className="w-3.5 h-3.5 text-orange-400 fill-orange-400" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
							<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
						</svg>
						KICKOFF
					</button>
				)}
			{aiDisabled && aiDisabledReason && (
				<p className="mt-2 text-xs text-yellow-300/80">{aiDisabledReason}</p>
			)}
		</div>
	);
}
