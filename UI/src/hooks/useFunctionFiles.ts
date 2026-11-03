import { useCallback, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useConfirm } from "../components/modals/ConfirmModal";
import {
	createFolder,
	createOrUpdateFile,
	deleteFile,
	deleteFolder,
	getFiles,
	getFolders,
	loadDefaultContent,
	renameFile,
	renameFolder,
} from "../services/backend.files";
import type { FunctionFile, FunctionFolder } from "../types/Prisma";
import { isHtmlFilename } from "../utils/functionFiles";
import type { PersistFile } from "../utils/functionUpload";

export interface EditorViewStateStore {
	remember: (fileId: number) => void;
	forget: (fileId: number) => void;
}

interface Options {
	functionId: number | null;
	/** The function only serves a single .html file, so other types are refused. */
	htmlOnly: boolean;
	/** Files come from a git repository and can't be edited here. */
	readOnly: boolean;
	/** A run is in progress; saving is paused until it finishes. */
	busy: boolean;
	editorViewState: EditorViewStateStore;
}

export type FolderMode = "create" | "rename";

/**
 * Owns the function's files and folders together with the editor buffer: which
 * file is open, its unsaved text, and every create/rename/delete/save flow that
 * has to keep those three in sync.
 */
export function useFunctionFiles({
	functionId,
	htmlOnly,
	readOnly,
	busy,
	editorViewState,
}: Options) {
	const confirm = useConfirm();
	const [files, setFiles] = useState<FunctionFile[]>([]);
	const [folders, setFolders] = useState<FunctionFolder[]>([]);
	const [activeFile, setActiveFile] = useState<FunctionFile | null>(null);
	const [code, setCode] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	// Async flows outlive the render that started them, so they read the open
	// file through a ref instead of a stale closure.
	const activeFileRef = useRef(activeFile);
	activeFileRef.current = activeFile;
	const filesRef = useRef(files);
	filesRef.current = files;
	const codeRef = useRef(code);
	codeRef.current = code;
	const initialSelectionDone = useRef(false);

	const savedActiveFile = activeFile
		? (files.find((file) => file.id === activeFile.id) ?? activeFile)
		: null;
	const hasUnsavedChanges = Boolean(
		activeFile && code !== (savedActiveFile?.content ?? ""),
	);
	const canSave = Boolean(
		activeFile && hasUnsavedChanges && !saving && !busy && !readOnly,
	);

	const openFile = useCallback((file: FunctionFile | null) => {
		setActiveFile(file);
		setCode(file ? file.content || "" : null);
	}, []);

	/**
	 * Replaces the file list from the server. The open file stays open (and takes
	 * the server's content unless the user has unsaved edits); if it no longer
	 * exists, or nothing was ever opened, the startup file is selected.
	 */
	const replaceFiles = useCallback(
		(next: FunctionFile[], startupFile?: string | null) => {
			const current = activeFileRef.current;
			const updated = current && next.find((file) => file.id === current.id);
			const previousSaved = current
				? (filesRef.current.find((file) => file.id === current.id) ?? current)
				: null;
			setFiles(next);

			if (updated) {
				if (codeRef.current === (previousSaved?.content ?? "")) {
					setCode(updated.content || "");
				}
				setActiveFile(updated);
				return;
			}
			if (!current && initialSelectionDone.current) return;

			initialSelectionDone.current = true;
			openFile(next.find((file) => file.name === startupFile) ?? next[0] ?? null);
		},
		[openFile],
	);

	const refreshExplorer = useCallback(async () => {
		if (functionId === null) return null;
		const [filesData, foldersData] = await Promise.all([
			getFiles(functionId),
			getFolders(functionId),
		]);
		if (filesData.status === "OK") setFiles(filesData.data);
		if (foldersData.status === "OK") setFolders(foldersData.data);
		return filesData.status === "OK" ? filesData.data : null;
	}, [functionId]);

	const selectFile = useCallback(
		async (file: FunctionFile) => {
			const current = activeFileRef.current;
			if (file.id === current?.id) return;

			if (hasUnsavedChanges) {
				const shouldSwitch = await confirm({
					title: "Unsaved Changes",
					message:
						"You have unsaved changes in this file. Switch files and discard them?",
					confirmText: "Switch File",
					cancelText: "Stay Here",
					variant: "delete",
				});
				if (!shouldSwitch) return;
			}

			if (current) editorViewState.remember(current.id);
			openFile(file);
		},
		[confirm, editorViewState, hasUnsavedChanges, openFile],
	);

	const persistFile: PersistFile = useCallback(
		async (filename, content) => {
			if (functionId === null) {
				return { success: false, message: "Function ID is missing." };
			}
			if (htmlOnly && !isHtmlFilename(filename)) {
				return {
					success: false,
					message: "Only .html files are allowed for this function.",
				};
			}

			try {
				const data = await createOrUpdateFile(functionId, {
					filename,
					code: content,
				});
				if (data.status !== "OK") {
					return { success: false, message: data.message };
				}

				setFiles((prev) =>
					prev.some((file) => file.id === data.data.id)
						? prev.map((file) =>
								file.id === data.data.id ? { ...file, content } : file,
							)
						: [...prev, { ...data.data, content }],
				);
				if (activeFileRef.current?.id === data.data.id) setCode(content);
				return { success: true, name: filename };
			} catch (error) {
				console.error("Error creating file:", error);
				return {
					success: false,
					message: "An error occurred while creating the file.",
				};
			}
		},
		[functionId, htmlOnly],
	);

	const createFile = useCallback(
		async (filename: string, content: string) => {
			const result = await persistFile(filename, content);
			if (!result.success) {
				toast.error(`Error creating file: ${result.message}`);
				return false;
			}
			return true;
		},
		[persistFile],
	);

	const saveActiveFile = useCallback(async () => {
		if (functionId === null || !activeFile) return;

		setSaving(true);
		try {
			const data = await createOrUpdateFile(functionId, {
				filename: activeFile.name,
				code: code || "",
			});
			if (data.status === "OK") {
				setFiles((prev) =>
					prev.map((file) =>
						file.id === activeFile.id
							? { ...file, content: code || "" }
							: file,
					),
				);
			} else {
				toast.error("Error saving file: " + data.message);
			}
		} catch (error) {
			console.error("Error saving file:", error);
			toast.error("An error occurred while saving the file.");
		} finally {
			setSaving(false);
		}
	}, [activeFile, code, functionId]);

	const renameFileTo = useCallback(
		async (file: FunctionFile, newFilename: string) => {
			if (functionId === null) return false;
			if (htmlOnly && !isHtmlFilename(newFilename)) {
				toast.error("Only .html files are allowed for this function.");
				return false;
			}

			try {
				const data = await renameFile(functionId, file.id, newFilename);
				if (data.status !== "OK") {
					toast.error("Error renaming file: " + data.message);
					return false;
				}
				const rename = <T extends FunctionFile>(entry: T): T =>
					entry.id === file.id ? { ...entry, name: newFilename } : entry;
				setFiles((prev) => prev.map(rename));
				setActiveFile((current) => (current ? rename(current) : current));
				return true;
			} catch (error) {
				console.error("Error renaming file:", error);
				toast.error("An error occurred while renaming the file.");
				return false;
			}
		},
		[functionId, htmlOnly],
	);

	const removeFileFromState = useCallback(
		(fileId: number) => {
			editorViewState.forget(fileId);
			setFiles((prev) => prev.filter((file) => file.id !== fileId));
			if (activeFileRef.current?.id === fileId) openFile(null);
		},
		[editorViewState, openFile],
	);

	const deleteFiles = useCallback(
		async (filesToDelete: FunctionFile[]) => {
			if (functionId === null || filesToDelete.length === 0) return false;

			let deletedCount = 0;
			let hadError = false;

			for (const file of filesToDelete) {
				try {
					const data = await deleteFile(functionId, file.id);
					if (data.status === "OK") {
						removeFileFromState(file.id);
						deletedCount++;
					} else {
						hadError = true;
						toast.error(`Error deleting ${file.name}: ${data.message}`);
					}
				} catch (error) {
					hadError = true;
					console.error("Error deleting file:", error);
					toast.error(`An error occurred while deleting ${file.name}.`);
				}
			}

			if (deletedCount > 0) {
				toast.success(
					deletedCount === 1
						? `Deleted ${filesToDelete[0].name}.`
						: `Deleted ${deletedCount} files.`,
				);
			}
			return deletedCount > 0 && !hadError;
		},
		[functionId, removeFileFromState],
	);

	const confirmAndDeleteFiles = useCallback(
		async (filesToDelete: FunctionFile[]) => {
			if (functionId === null || filesToDelete.length === 0) return false;

			const previewNames = filesToDelete
				.slice(0, 5)
				.map((file) => file.name)
				.join(", ");
			const summary =
				filesToDelete.length === 1
					? `This will permanently delete "${filesToDelete[0].name}".`
					: `This will permanently delete ${filesToDelete.length} files: ${previewNames}${
							filesToDelete.length > 5
								? `, and ${filesToDelete.length - 5} more`
								: ""
						}.`;
			const shouldDelete = await confirm({
				title: "Delete Files",
				message: summary,
				confirmText: "Delete Files",
				cancelText: "Cancel",
				variant: "delete",
			});
			if (!shouldDelete) return false;

			return deleteFiles(filesToDelete);
		},
		[confirm, deleteFiles, functionId],
	);

	const submitFolder = useCallback(
		async (
			mode: FolderMode,
			{ parentPath, targetPath }: { parentPath: string; targetPath: string },
			leafName: string,
		) => {
			if (functionId === null) return false;

			const fullName =
				mode === "create"
					? parentPath
						? `${parentPath}/${leafName}`
						: leafName
					: targetPath.includes("/")
						? `${targetPath.slice(0, targetPath.lastIndexOf("/"))}/${leafName}`
						: leafName;

			try {
				const response =
					mode === "create"
						? await createFolder(functionId, fullName)
						: await renameFolder(functionId, targetPath, fullName);
				if (response.status !== "OK") {
					toast.error(
						`Error ${mode === "create" ? "creating" : "renaming"} folder: ${response.message}`,
					);
					return false;
				}

				const refreshedFiles = await refreshExplorer();
				const current = activeFileRef.current;
				if (mode === "rename" && current?.name.startsWith(`${targetPath}/`)) {
					const renamed = refreshedFiles?.find((file) => file.id === current.id);
					if (renamed) setActiveFile(renamed);
				}
				return true;
			} catch (error) {
				console.error("Error updating folder:", error);
				toast.error("An error occurred while updating the folder.");
				return false;
			}
		},
		[functionId, refreshExplorer],
	);

	const removeFolder = useCallback(
		async (folderName: string) => {
			if (functionId === null) return;

			const shouldDelete = await confirm({
				title: "Delete Folder",
				message: `This will permanently delete "${folderName}" and every file inside it.`,
				confirmText: "Delete Folder",
				cancelText: "Cancel",
				variant: "delete",
			});
			if (!shouldDelete) return;

			try {
				const response = await deleteFolder(functionId, folderName);
				if (response.status !== "OK") {
					toast.error(`Error deleting folder: ${response.message}`);
					return;
				}
				await refreshExplorer();
				if (activeFileRef.current?.name.startsWith(`${folderName}/`)) {
					openFile(null);
				}
				toast.success(`Deleted ${folderName}.`);
			} catch (error) {
				console.error("Error deleting folder:", error);
				toast.error("An error occurred while deleting the folder.");
			}
		},
		[confirm, functionId, openFile, refreshExplorer],
	);

	const loadDefaultInto = useCallback(
		async (defaultToLoad: string) => {
			if (functionId === null || !activeFile) return false;

			setSaving(true);
			try {
				const response = await loadDefaultContent(
					functionId,
					activeFile.id,
					defaultToLoad,
				);
				if (response.status !== "OK") {
					toast.error("Error loading default: " + response.message);
					return false;
				}
				const updatedContent = response.data.content;
				setCode(updatedContent);
				setFiles((prev) =>
					prev.map((file) =>
						file.id === activeFile.id
							? { ...file, content: updatedContent }
							: file,
					),
				);
				return true;
			} catch (error) {
				console.error("Error loading default content:", error);
				toast.error("An error occurred while loading the default template.");
				return false;
			} finally {
				setSaving(false);
			}
		},
		[activeFile, functionId],
	);

	return {
		files,
		folders,
		setFolders,
		activeFile,
		code,
		setCode,
		saving,
		hasUnsavedChanges,
		canSave,
		replaceFiles,
		refreshExplorer,
		selectFile,
		persistFile,
		createFile,
		saveActiveFile,
		renameFileTo,
		deleteFiles,
		confirmAndDeleteFiles,
		submitFolder,
		removeFolder,
		loadDefaultInto,
	};
}
