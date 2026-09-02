import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type MouseEvent, type ReactNode } from "react";
import { FunctionFile } from "../../types/Prisma";

type ContextMenu = { x: number; y: number; file?: FunctionFile };

function Icon({ children, className = "h-4 w-4" }: { children: ReactNode; className?: string }) {
	return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{children}</svg>;
}

function FileIcon({ name }: { name: string }) {
	const extension = name.split(".").pop()?.toLowerCase();
	const color = ["js", "ts", "tsx", "json"].includes(extension ?? "") ? "text-yellow-300" : extension === "py" ? "text-blue-300" : extension === "go" ? "text-cyan-300" : ["html", "css"].includes(extension ?? "") ? "text-orange-300" : "text-text/65";
	return <Icon className={`h-4 w-4 shrink-0 ${color}`}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></Icon>;
}

export function FileManagerCard({ files, activeFile, onFileSelect, onCreateFile, onDownloadFile, onRenameFile, onDeleteFile, onDeleteSelectedFiles, onDropFiles, onAIGenerate, aiDisabled = false, aiDisabledReason, disabled = false, disabledReason, autoUnzipFiles, onAutoUnzipFilesChange }: {
	files: FunctionFile[]; activeFile: FunctionFile | null; onFileSelect: (file: FunctionFile) => void; onCreateFile: () => void; onDownloadFile: (file: FunctionFile) => void; onRenameFile: (file: FunctionFile) => void; onDeleteFile: (file: FunctionFile) => void; onDeleteSelectedFiles?: (files: FunctionFile[]) => boolean | Promise<boolean>; nonSelectableOnSelectAllFileNames?: string[]; onDropFiles?: (files: File[], options?: { unzipArchives?: boolean }) => void | Promise<void>; onAIGenerate?: () => void; aiDisabled?: boolean; aiDisabledReason?: string; disabled?: boolean; disabledReason?: string; autoUnzipFiles: boolean; onAutoUnzipFilesChange: (enabled: boolean) => void;
}) {
	const [isDragOver, setIsDragOver] = useState(false);
	const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set());
	const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
	const uploadInputRef = useRef<HTMLInputElement>(null);
	const zipUploadInputRef = useRef<HTMLInputElement>(null);
	const selectedFiles = files.filter((file) => selectedFileIds.has(file.id));

	useEffect(() => setSelectedFileIds((previous) => new Set([...previous].filter((id) => files.some((file) => file.id === id)))), [files]);
	useEffect(() => {
		const closeMenu = () => setContextMenu(null);
		const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeMenu(); };
		window.addEventListener("click", closeMenu); window.addEventListener("keydown", closeOnEscape);
		return () => { window.removeEventListener("click", closeMenu); window.removeEventListener("keydown", closeOnEscape); };
	}, []);

	const toggleFileSelection = (id: number) => setSelectedFileIds((previous) => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
	const openMenu = (event: MouseEvent, file?: FunctionFile) => { event.preventDefault(); event.stopPropagation(); setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 210), y: Math.min(event.clientY, window.innerHeight - 250), file }); };
	const uploadFiles = (event: ChangeEvent<HTMLInputElement>, unzipArchives = autoUnzipFiles) => { const uploaded = Array.from(event.target.files || []); event.target.value = ""; if (uploaded.length) void onDropFiles?.(uploaded, { unzipArchives }); };
	const handleDrop = (event: DragEvent<HTMLDivElement>) => { if (!onDropFiles) return; event.preventDefault(); setIsDragOver(false); const dropped = Array.from(event.dataTransfer.files || []); if (dropped.length) void onDropFiles(dropped, { unzipArchives: autoUnzipFiles }); };
	const runMenuAction = (action: () => void) => { setContextMenu(null); action(); };

	return <div className={`relative overflow-hidden rounded-lg border border-primary/20 bg-[#181818] ${disabled ? "pointer-events-none select-none opacity-50 grayscale" : ""}`} onContextMenu={(event) => openMenu(event)} onDragEnter={(event) => { if (onDropFiles) { event.preventDefault(); setIsDragOver(true); } }} onDragOver={(event) => { if (onDropFiles) event.preventDefault(); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragOver(false); }} onDrop={handleDrop}>
		<div className="flex h-9 items-center justify-between border-b border-white/10 px-3 text-[11px] font-semibold tracking-[0.08em] text-text/70"><span>EXPLORER</span><div className="flex items-center gap-1 text-text/60">
			<button type="button" title="New File" aria-label="New File" onClick={onCreateFile} className="rounded p-1 hover:bg-white/10 hover:text-text"><Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M12 18v-6M9 15h6" /></Icon></button>
			<button type="button" title="Folder support is coming soon" aria-label="New Folder (coming soon)" disabled className="cursor-not-allowed rounded p-1 opacity-35"><Icon><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M12 11v5M9.5 13.5h5" /></Icon></button>
			{onDropFiles && <button type="button" title="Upload Files" aria-label="Upload Files" onClick={() => uploadInputRef.current?.click()} className="rounded p-1 hover:bg-white/10 hover:text-text"><Icon><path d="M12 16V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></Icon></button>}
		</div></div>
		<div className="flex h-8 items-center gap-1 border-b border-white/5 bg-[#202020] px-3 text-xs font-semibold text-text/80"><span className="text-[10px]">⌄</span><Icon className="h-3.5 w-3.5 text-primary"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></Icon><span>FILES</span><span className="ml-auto text-text/40">{files.length}</span></div>
		{disabled && disabledReason && <p className="border-b border-yellow-500/20 bg-yellow-900/10 px-3 py-2 text-xs text-yellow-300/80">{disabledReason}</p>}
		<div className={`min-h-28 max-h-64 overflow-y-auto py-1 ${isDragOver ? "bg-primary/10 outline outline-1 outline-primary/60 outline-inset" : ""}`}>
			{files.length ? files.map((file) => <div key={file.id} role="button" tabIndex={0} onClick={() => onFileSelect(file)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onFileSelect(file); }} onContextMenu={(event) => openMenu(event, file)} className={`group flex h-7 cursor-pointer items-center gap-2 px-3 text-sm transition-colors ${activeFile?.id === file.id ? "bg-[#37373d] text-white" : "text-text/75 hover:bg-[#2a2d2e] hover:text-text"}`}>
				<input type="checkbox" aria-label={`Select ${file.name}`} checked={selectedFileIds.has(file.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleFileSelection(file.id)} className="h-3.5 w-3.5 accent-primary" /><FileIcon name={file.name} /><span className="min-w-0 flex-1 truncate">{file.name}</span>
				<button type="button" aria-label={`More actions for ${file.name}`} title="More actions" onClick={(event) => openMenu(event, file)} className="hidden rounded p-0.5 text-text/60 hover:bg-white/10 hover:text-text group-hover:block"><Icon className="h-4 w-4"><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></Icon></button>
			</div>) : <div className="px-3 py-5 text-center text-xs text-text/45">{isDragOver ? "Drop files to add them" : "No files yet"}</div>}
		</div>
		<div className="border-t border-white/10 p-2"><button type="button" onClick={onCreateFile} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-text/75 hover:bg-white/10 hover:text-text"><Icon className="h-3.5 w-3.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M12 18v-6M9 15h6" /></Icon>New File</button>
			{selectedFiles.length > 0 && onDeleteSelectedFiles && <button type="button" onClick={() => { void onDeleteSelectedFiles(selectedFiles).then((didDelete) => { if (didDelete) setSelectedFileIds(new Set()); }); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/10"><Icon className="h-3.5 w-3.5"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7" /></Icon>Delete Selected ({selectedFiles.length})</button>}
			{onAIGenerate && <button type="button" disabled={aiDisabled} title={aiDisabled ? aiDisabledReason : undefined} onClick={onAIGenerate} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-indigo-300 hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-50"><span>⚡</span>KICKOFF</button>}
			{onDropFiles && <button type="button" onClick={() => onAutoUnzipFilesChange(!autoUnzipFiles)} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-text/60 hover:bg-white/10"><span>Auto unzip</span><span className={autoUnzipFiles ? "text-primary" : "text-text/40"}>{autoUnzipFiles ? "On" : "Off"}</span></button>}</div>
		{onDropFiles && <><input ref={uploadInputRef} type="file" multiple className="hidden" onChange={uploadFiles} /><input ref={zipUploadInputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => uploadFiles(event, true)} /></>}
		{contextMenu && <div role="menu" className="fixed z-50 w-48 rounded border border-white/15 bg-[#252526] py-1 text-sm shadow-2xl" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>{contextMenu.file ? <><button role="menuitem" type="button" onClick={() => runMenuAction(() => onFileSelect(contextMenu.file!))}>Open</button><button role="menuitem" type="button" onClick={() => runMenuAction(() => onRenameFile(contextMenu.file!))}>Rename</button><button role="menuitem" type="button" onClick={() => runMenuAction(() => onDownloadFile(contextMenu.file!))}>Download</button><div className="my-1 border-t border-white/10" /><button role="menuitem" type="button" className="text-red-300" onClick={() => runMenuAction(() => onDeleteFile(contextMenu.file!))}>Delete</button></> : <><button role="menuitem" type="button" onClick={() => runMenuAction(onCreateFile)}>New File</button>{onDropFiles && <><button role="menuitem" type="button" onClick={() => runMenuAction(() => uploadInputRef.current?.click())}>Upload Files</button><button role="menuitem" type="button" onClick={() => runMenuAction(() => zipUploadInputRef.current?.click())}>Upload from ZIP</button></>}<button role="menuitem" type="button" disabled title="Folder support is coming soon">New Folder <span className="ml-auto text-[10px] text-text/40">Soon</span></button></>}</div>}
		<style>{`[role="menuitem"] { display: flex; width: 100%; padding: 0.4rem 0.75rem; text-align: left; color: rgba(255,255,255,.8); } [role="menuitem"]:not(:disabled):hover { background: #094771; color: white; } [role="menuitem"]:disabled { cursor: not-allowed; opacity: .5; }`}</style>
	</div>;
}
