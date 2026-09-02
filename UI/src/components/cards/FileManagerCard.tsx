import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type MouseEvent,
	type ReactNode,
} from "react";
import { FunctionFile, FunctionFolder } from "../../types/Prisma";

type ContextEntry =
	{ type: "file"; file: FunctionFile } | { type: "folder"; path: string };
type FolderNode = {
	name: string;
	path: string;
	folders: Map<string, FolderNode>;
	files: Array<{ file: FunctionFile; displayName: string }>;
};

function Icon({
	children,
	className = "h-4 w-4",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
		>
			{children}
		</svg>
	);
}

function FileIcon({ name }: { name: string }) {
	const extension = name.split(".").pop()?.toLowerCase();
	const color = ["js", "ts", "tsx", "json"].includes(extension ?? "")
		? "text-yellow-300"
		: extension === "py"
			? "text-blue-300"
			: extension === "go"
				? "text-cyan-300"
				: ["html", "css"].includes(extension ?? "")
					? "text-orange-300"
					: "text-text/65";
	return (
		<Icon className={`h-4 w-4 shrink-0 ${color}`}>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
			<path d="M14 2v6h6M8 13h8M8 17h5" />
		</Icon>
	);
}

function allFolderPaths(files: FunctionFile[], folders: FunctionFolder[]) {
	const result = new Set(folders.map((folder) => folder.name));
	for (const file of files) {
		const parts = file.name.split("/");
		for (let index = 1; index < parts.length; index++)
			result.add(parts.slice(0, index).join("/"));
	}
	return result;
}

function buildTree(files: FunctionFile[], folders: FunctionFolder[]) {
	const root: FolderNode = {
		name: "",
		path: "",
		folders: new Map(),
		files: [],
	};
	for (const folderPath of [...allFolderPaths(files, folders)].sort()) {
		let parent = root;
		for (const part of folderPath.split("/")) {
			const childPath = parent.path ? `${parent.path}/${part}` : part;
			let child = parent.folders.get(part);
			if (!child) {
				child = {
					name: part,
					path: childPath,
					folders: new Map(),
					files: [],
				};
				parent.folders.set(part, child);
			}
			parent = child;
		}
	}
	for (const file of files) {
		const parts = file.name.split("/");
		const basename = parts.pop() ?? file.name;
		let parent = root;
		for (const part of parts) parent = parent.folders.get(part) ?? parent;
		parent.files.push({ file, displayName: basename });
	}
	return root;
}

export function FileManagerCard({
	files,
	folders,
	activeFile,
	onFileSelect,
	onCreateFile,
	onCreateFolder,
	onRenameFolder,
	onDeleteFolder,
	onDownloadFile,
	onRenameFile,
	onDeleteFile,
	onDeleteSelectedFiles,
	onDropFiles,
	onAIGenerate,
	aiDisabled = false,
	aiDisabledReason,
	disabled = false,
	disabledReason,
	autoUnzipFiles,
	onAutoUnzipFilesChange,
}: {
	files: FunctionFile[];
	folders: FunctionFolder[];
	activeFile: FunctionFile | null;
	onFileSelect: (file: FunctionFile) => void;
	onCreateFile: (parentPath?: string) => void;
	onCreateFolder: (parentPath?: string) => void;
	onRenameFolder: (path: string) => void;
	onDeleteFolder: (path: string) => void;
	onDownloadFile: (file: FunctionFile) => void;
	onRenameFile: (file: FunctionFile) => void;
	onDeleteFile: (file: FunctionFile) => void;
	onDeleteSelectedFiles?: (
		files: FunctionFile[],
	) => boolean | Promise<boolean>;
	onDropFiles?: (
		files: File[],
		options?: { unzipArchives?: boolean },
	) => void | Promise<void>;
	onAIGenerate?: () => void;
	aiDisabled?: boolean;
	aiDisabledReason?: string;
	disabled?: boolean;
	disabledReason?: string;
	autoUnzipFiles: boolean;
	onAutoUnzipFilesChange: (enabled: boolean) => void;
}) {
	const [isDragOver, setIsDragOver] = useState(false);
	const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(
		new Set(),
	);
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() =>
		allFolderPaths(files, folders),
	);
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		entry?: ContextEntry;
	} | null>(null);
	const uploadInputRef = useRef<HTMLInputElement>(null);
	const zipUploadInputRef = useRef<HTMLInputElement>(null);
	const tree = useMemo(() => buildTree(files, folders), [files, folders]);
	const selectedFiles = files.filter((file) => selectedFileIds.has(file.id));
	useEffect(
		() =>
			setSelectedFileIds(
				(previous) =>
					new Set(
						[...previous].filter((id) =>
							files.some((file) => file.id === id),
						),
					),
			),
		[files],
	);
	useEffect(
		() =>
			setExpandedFolders(
				(previous) =>
					new Set([...previous, ...allFolderPaths(files, folders)]),
			),
		[files, folders],
	);
	useEffect(() => {
		const close = () => setContextMenu(null);
		const esc = (event: KeyboardEvent) => {
			if (event.key === "Escape") close();
		};
		window.addEventListener("click", close);
		window.addEventListener("keydown", esc);
		return () => {
			window.removeEventListener("click", close);
			window.removeEventListener("keydown", esc);
		};
	}, []);
	const openMenu = (event: MouseEvent, entry?: ContextEntry) => {
		event.preventDefault();
		event.stopPropagation();
		setContextMenu({
			x: Math.min(event.clientX, window.innerWidth - 210),
			y: Math.min(event.clientY, window.innerHeight - 250),
			entry,
		});
	};
	const toggleFolder = (path: string) =>
		setExpandedFolders((previous) => {
			const next = new Set(previous);
			next.has(path) ? next.delete(path) : next.add(path);
			return next;
		});
	const toggleSelection = (id: number) =>
		setSelectedFileIds((previous) => {
			const next = new Set(previous);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	const uploadFiles = (
		event: ChangeEvent<HTMLInputElement>,
		unzipArchives = autoUnzipFiles,
	) => {
		const uploaded = Array.from(event.target.files || []);
		event.target.value = "";
		if (uploaded.length) void onDropFiles?.(uploaded, { unzipArchives });
	};
	const runMenuAction = (action: () => void) => {
		setContextMenu(null);
		action();
	};
	const fileRow = (file: FunctionFile, depth: number, displayName = file.name) => (
		<div
			key={file.id}
			role="button"
			tabIndex={0}
			onClick={() => onFileSelect(file)}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ")
					onFileSelect(file);
			}}
			onContextMenu={(event) => openMenu(event, { type: "file", file })}
			className={`group flex h-7 cursor-pointer items-center gap-2 pr-3 text-sm transition-colors ${activeFile?.id === file.id ? "bg-[#37373d] text-white" : "text-text/75 hover:bg-[#2a2d2e] hover:text-text"}`}
			style={{ paddingLeft: `${12 + depth * 14}px` }}
		>
			<input
				type="checkbox"
				aria-label={`Select ${file.name}`}
				checked={selectedFileIds.has(file.id)}
				onClick={(event) => event.stopPropagation()}
				onChange={() => toggleSelection(file.id)}
				className="h-3.5 w-3.5 accent-primary"
			/>
			<FileIcon name={displayName} />
			<span className="min-w-0 flex-1 truncate">{displayName}</span>
			<button
				type="button"
				aria-label={`More actions for ${file.name}`}
				title="More actions"
				onClick={(event) => openMenu(event, { type: "file", file })}
				className="hidden rounded p-0.5 text-text/60 hover:bg-white/10 hover:text-text group-hover:block"
			>
				<Icon className="h-4 w-4">
					<circle cx="5" cy="12" r="1" fill="currentColor" />
					<circle cx="12" cy="12" r="1" fill="currentColor" />
					<circle cx="19" cy="12" r="1" fill="currentColor" />
				</Icon>
			</button>
		</div>
	);
	const renderFolder = (folder: FolderNode, depth: number): ReactNode => {
		const expanded = expandedFolders.has(folder.path);
		return (
			<div key={folder.path}>
				<div
					role="button"
					tabIndex={0}
					onClick={() => toggleFolder(folder.path)}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ")
							toggleFolder(folder.path);
					}}
					onContextMenu={(event) =>
						openMenu(event, { type: "folder", path: folder.path })
					}
					className="group flex h-7 cursor-pointer items-center gap-1.5 pr-3 text-sm text-text/75 hover:bg-[#2a2d2e] hover:text-text"
					style={{ paddingLeft: `${12 + depth * 14}px` }}
				>
					<span className="w-3 text-[10px] text-text/50">
						{expanded ? "⌄" : "›"}
					</span>
					<Icon className="h-4 w-4 shrink-0 text-primary/80">
						<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
					</Icon>
					<span className="min-w-0 flex-1 truncate">
						{folder.name}
					</span>
					<button
						type="button"
						aria-label={`More actions for ${folder.path}`}
						title="More actions"
						onClick={(event) =>
							openMenu(event, {
								type: "folder",
								path: folder.path,
							})
						}
						className="hidden rounded p-0.5 text-text/60 hover:bg-white/10 hover:text-text group-hover:block"
					>
						<Icon className="h-4 w-4">
							<circle cx="5" cy="12" r="1" fill="currentColor" />
							<circle cx="12" cy="12" r="1" fill="currentColor" />
							<circle cx="19" cy="12" r="1" fill="currentColor" />
						</Icon>
					</button>
				</div>
				{expanded && (
					<>
						{[...folder.folders.values()]
							.sort((left, right) =>
								left.name.localeCompare(right.name),
							)
							.map((child) => renderFolder(child, depth + 1))}
						{folder.files
							.sort((left, right) =>
								left.displayName.localeCompare(right.displayName),
							)
							.map(({ file, displayName }) =>
								fileRow(file, depth + 1, displayName),
							)}
					</>
				)}
			</div>
		);
	};
	const menu = contextMenu?.entry;
	return (
		<div
			className={`relative overflow-hidden rounded-lg border border-primary/20 bg-[#181818] ${disabled ? "pointer-events-none select-none opacity-50 grayscale" : ""}`}
			onContextMenu={(event) => openMenu(event)}
			onDragEnter={(event) => {
				if (onDropFiles) {
					event.preventDefault();
					setIsDragOver(true);
				}
			}}
			onDragOver={(event) => {
				if (onDropFiles) event.preventDefault();
			}}
			onDragLeave={(event) => {
				if (
					!event.currentTarget.contains(
						event.relatedTarget as Node | null,
					)
				)
					setIsDragOver(false);
			}}
			onDrop={(event) => {
				if (!onDropFiles) return;
				event.preventDefault();
				setIsDragOver(false);
				const dropped = Array.from(event.dataTransfer.files || []);
				if (dropped.length)
					void onDropFiles(dropped, {
						unzipArchives: autoUnzipFiles,
					});
			}}
		>
			<div className="flex h-9 items-center justify-between border-b border-white/10 px-3 text-[11px] font-semibold tracking-[0.08em] text-text/70">
				<span>EXPLORER</span>
				<div className="flex items-center gap-1 text-text/60">
					<button
						type="button"
						title="New File"
						aria-label="New File"
						onClick={() => onCreateFile()}
						className="rounded p-1 hover:bg-white/10 hover:text-text"
					>
						<Icon>
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
							<path d="M14 2v6h6M12 18v-6M9 15h6" />
						</Icon>
					</button>
					<button
						type="button"
						title="New Folder"
						aria-label="New Folder"
						onClick={() => onCreateFolder()}
						className="rounded p-1 hover:bg-white/10 hover:text-text"
					>
						<Icon>
							<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
							<path d="M12 11v5M9.5 13.5h5" />
						</Icon>
					</button>
					{onDropFiles && (
						<button
							type="button"
							title="Upload Files"
							aria-label="Upload Files"
							onClick={() => uploadInputRef.current?.click()}
							className="rounded p-1 hover:bg-white/10 hover:text-text"
						>
							<Icon>
								<path d="M12 16V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
							</Icon>
						</button>
					)}
				</div>
			</div>
			<div className="flex h-8 items-center gap-1 border-b border-white/5 bg-[#202020] px-3 text-xs font-semibold text-text/80">
				<span className="text-[10px]">⌄</span>
				<Icon className="h-3.5 w-3.5 text-primary">
					<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
				</Icon>
				<span>FILES</span>
				<span className="ml-auto text-text/40">{files.length}</span>
			</div>
			{disabled && disabledReason && (
				<p className="border-b border-yellow-500/20 bg-yellow-900/10 px-3 py-2 text-xs text-yellow-300/80">
					{disabledReason}
				</p>
			)}
			<div
				className={`min-h-28 max-h-64 overflow-y-auto py-1 ${isDragOver ? "bg-primary/10 outline outline-1 outline-primary/60 outline-inset" : ""}`}
			>
				{files.length || folders.length ? (
					<>
						{[...tree.folders.values()]
							.sort((left, right) =>
								left.name.localeCompare(right.name),
							)
							.map((folder) => renderFolder(folder, 0))}
						{tree.files
							.sort((left, right) =>
								left.displayName.localeCompare(right.displayName),
							)
							.map(({ file, displayName }) =>
								fileRow(file, 0, displayName),
							)}
					</>
				) : (
					<div className="px-3 py-5 text-center text-xs text-text/45">
						{isDragOver ? "Drop files to add them" : "No files yet"}
					</div>
				)}
			</div>
			<div className="border-t border-white/10 p-2">
				<button
					type="button"
					onClick={() => onCreateFile()}
					className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-text/75 hover:bg-white/10 hover:text-text"
				>
					<FileIcon name="new" />
					New File
				</button>
				<button
					type="button"
					onClick={() => onCreateFolder()}
					className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-text/75 hover:bg-white/10 hover:text-text"
				>
					<Icon className="h-3.5 w-3.5">
						<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
						<path d="M12 11v5M9.5 13.5h5" />
					</Icon>
					New Folder
				</button>
				{selectedFiles.length > 0 && onDeleteSelectedFiles && (
					<button
						type="button"
						onClick={() =>
							void onDeleteSelectedFiles(selectedFiles).then(
								(didDelete) => {
									if (didDelete)
										setSelectedFileIds(new Set());
								},
							)
						}
						className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
					>
						<Icon className="h-3.5 w-3.5">
							<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7" />
						</Icon>
						Delete Selected ({selectedFiles.length})
					</button>
				)}
				{onAIGenerate && (
					<button
						type="button"
						disabled={aiDisabled}
						title={aiDisabled ? aiDisabledReason : undefined}
						onClick={onAIGenerate}
						className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-indigo-300 hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<span>⚡</span>KICKOFF
					</button>
				)}
				{onDropFiles && (
					<button
						type="button"
						onClick={() => onAutoUnzipFilesChange(!autoUnzipFiles)}
						className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-text/60 hover:bg-white/10"
					>
						<span>Auto unzip</span>
						<span
							className={
								autoUnzipFiles ? "text-primary" : "text-text/40"
							}
						>
							{autoUnzipFiles ? "On" : "Off"}
						</span>
					</button>
				)}
			</div>
			{onDropFiles && (
				<>
					<input
						ref={uploadInputRef}
						type="file"
						multiple
						className="hidden"
						onChange={uploadFiles}
					/>
					<input
						ref={zipUploadInputRef}
						type="file"
						accept=".zip,application/zip"
						className="hidden"
						onChange={(event) => uploadFiles(event, true)}
					/>
				</>
			)}
			{contextMenu && (
				<div
					role="menu"
					className="fixed z-50 w-48 rounded border border-white/15 bg-[#252526] py-1 text-sm shadow-2xl"
					style={{ left: contextMenu.x, top: contextMenu.y }}
					onClick={(event) => event.stopPropagation()}
				>
					{menu?.type === "file" ? (
						<>
							<button
								role="menuitem"
								type="button"
								onClick={() =>
									runMenuAction(() => onFileSelect(menu.file))
								}
							>
								Open
							</button>
							<button
								role="menuitem"
								type="button"
								onClick={() =>
									runMenuAction(() => onRenameFile(menu.file))
								}
							>
								Rename
							</button>
							<button
								role="menuitem"
								type="button"
								onClick={() =>
									runMenuAction(() =>
										onDownloadFile(menu.file),
									)
								}
							>
								Download
							</button>
							<div className="my-1 border-t border-white/10" />
							<button
								role="menuitem"
								type="button"
								className="text-red-300"
								onClick={() =>
									runMenuAction(() => onDeleteFile(menu.file))
								}
							>
								Delete
							</button>
						</>
					) : menu?.type === "folder" ? (
						<>
							<button
								role="menuitem"
								type="button"
								onClick={() =>
									runMenuAction(() => onCreateFile(menu.path))
								}
							>
								New File
							</button>
							<button
								role="menuitem"
								type="button"
								onClick={() =>
									runMenuAction(() =>
										onCreateFolder(menu.path),
									)
								}
							>
								New Folder
							</button>
							<button
								role="menuitem"
								type="button"
								onClick={() =>
									runMenuAction(() =>
										onRenameFolder(menu.path),
									)
								}
							>
								Rename
							</button>
							<div className="my-1 border-t border-white/10" />
							<button
								role="menuitem"
								type="button"
								className="text-red-300"
								onClick={() =>
									runMenuAction(() =>
										onDeleteFolder(menu.path),
									)
								}
							>
								Delete Folder
							</button>
						</>
					) : (
						<>
							<button
								role="menuitem"
								type="button"
								onClick={() =>
									runMenuAction(() => onCreateFile())
								}
							>
								New File
							</button>
							<button
								role="menuitem"
								type="button"
								onClick={() =>
									runMenuAction(() => onCreateFolder())
								}
							>
								New Folder
							</button>
							{onDropFiles && (
								<>
									<button
										role="menuitem"
										type="button"
										onClick={() =>
											runMenuAction(() =>
												uploadInputRef.current?.click(),
											)
										}
									>
										Upload Files
									</button>
									<button
										role="menuitem"
										type="button"
										onClick={() =>
											runMenuAction(() =>
												zipUploadInputRef.current?.click(),
											)
										}
									>
										Upload from ZIP
									</button>
								</>
							)}
						</>
					)}
				</div>
			)}
			<style>{`[role="menuitem"] { display: flex; width: 100%; padding: 0.4rem 0.75rem; text-align: left; color: rgba(255,255,255,.8); } [role="menuitem"]:not(:disabled):hover { background: #094771; color: white; }`}</style>
		</div>
	);
}
