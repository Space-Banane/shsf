import { useCallback, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useConfirm } from "../components/modals/ConfirmModal";
import {
	createFolder,
	createOrUpdateFile,
	deleteFile,
	deleteFolder,
	getFileContent,
	getFiles,
	getFolders,
	loadDefaultContent,
	renameFile,
	renameFolder,
} from "../services/backend.files";
import type { FunctionFile, FunctionFolder } from "../types/Prisma";
import { downloadTextFile, isHtmlFilename } from "../utils/functionFiles";
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
	editorViewState: EditorViewStateStore;
}

export type FolderMode = "create" | "rename";

/**
 * Content is transferred separately from the file list, so the editor has to
 * track whether the open file's text is in the client already.
 */
export type FileContentState = "idle" | "loading" | "ready" | "error";

/**
 * Owns the function's files and folders together with the editor buffer: which
 * file is open, its unsaved text, and every create/rename/delete/save flow that
 * has to keep those three in sync.
 */
export function useFunctionFiles({
	functionId,
	htmlOnly,
	readOnly,
	editorViewState,
}: Options) {
	const confirm = useConfirm();
	const [files, setFiles] = useState<FunctionFile[]>([]);
	const [folders, setFolders] = useState<FunctionFolder[]>([]);
	const [activeFile, setActiveFile] = useState<FunctionFile | null>(null);
	const [code, setCode] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [contentState, setContentState] = useState<FileContentState>("idle");
	const [contentError, setContentError] = useState<string | null>(null);

	// Async flows outlive the render that started them, so they read the open
	// file through a ref instead of a stale closure.
	const activeFileRef = useRef(activeFile);
	activeFileRef.current = activeFile;
	const filesRef = useRef(files);
	filesRef.current = files;
	const codeRef = useRef(code);
	codeRef.current = code;
	const contentStateRef = useRef(contentState);
	contentStateRef.current = contentState;
	// Each content load gets a token so a slow response for a file the user
	// already left cannot overwrite the open editor.
	const contentRequestRef = useRef(0);
	const initialSelectionDone = useRef(false);

	const savedActiveFile = activeFile
		? (files.find((file) => file.id === activeFile.id) ?? activeFile)
		: null;
	const hasUnsavedChanges = Boolean(
		activeFile &&
			contentState === "ready" &&
			code !== (savedActiveFile?.content ?? ""),
	);
	const canSave = Boolean(
		activeFile && hasUnsavedChanges && !saving && !readOnly,
	);

	const applyContent = useCallback((file: FunctionFile, content: string) => {
		setFiles((previous) =>
			previous.map((entry) =>
				entry.id === file.id ? { ...entry, content } : entry,
			),
		);
		setActiveFile((current) =>
			current && current.id === file.id ? { ...current, content } : current,
		);
		setCode(content);
		setContentState("ready");
	}, []);

	const loadContent = useCallback(
		async (file: FunctionFile) => {
			if (functionId === null) return false;
			const token = ++contentRequestRef.current;
			setContentState("loading");
			setContentError(null);
			setCode(null);

			try {
				const data = await getFileContent(functionId, file.name);
				if (token !== contentRequestRef.current) return false;
				if (data.status !== "OK") {
					setContentState("error");
					setContentError(data.message);
					return false;
				}
				applyContent(file, data.data.content ?? "");
				return true;
			} catch (error) {
				if (token !== contentRequestRef.current) return false;
				console.error("Error loading file:", error);
				setContentState("error");
				setContentError("An error occurred while loading the file.");
				return false;
			}
		},
		[applyContent, functionId],
	);

	const openFile = useCallback(
		(file: FunctionFile | null) => {
			contentRequestRef.current += 1;
			setActiveFile(file);
			setContentError(null);
			if (!file) {
				setCode(null);
				setContentState("idle");
				return;
			}
			void loadContent(file);
		},
		[loadContent],
	);

	/**
	 * Replaces the file list from the server. Content that was already loaded
	 * is kept, so a metadata refresh never blanks the editor. The open file
	 * stays open; if it no longer exists, or nothing was ever opened, the
	 * startup file is selected and its content is fetched.
	 */
	const replaceFiles = useCallback(
		(next: FunctionFile[], startupFile?: string | null) => {
			const previous = filesRef.current;
			const merged = next.map((file) => {
				const existing = previous.find((entry) => entry.id === file.id);
				return {
					...file,
					content: file.content ?? existing?.content ?? "",
				};
			});
			setFiles(merged);

			const current = activeFileRef.current;
			const updated = current && merged.find((file) => file.id === current.id);
			if (updated) {
				setActiveFile(updated);
				if (contentStateRef.current === "ready") {
					const previousSaved =
						previous.find((file) => file.id === current.id) ?? current;
					if (codeRef.current === (previousSaved.content ?? "")) {
						setCode(updated.content || "");
					}
				}
				return;
			}
			if (!current && initialSelectionDone.current) return;

			initialSelectionDone.current = true;
			const selected =
				merged.find((file) => file.name === startupFile) ?? merged[0] ?? null;
			openFile(selected);
		},
		[openFile],
	);

	const refreshExplorer = useCallback(async () => {
		if (functionId === null) return null;
		const [filesData, foldersData] = await Promise.all([
			getFiles(functionId),
			getFolders(functionId),
		]);
		let merged: FunctionFile[] | null = null;
		if (filesData.status === "OK") {
			const previous = filesRef.current;
			merged = filesData.data.map((file) => {
				const existing = previous.find((entry) => entry.id === file.id);
				return {
					...file,
					content: file.content ?? existing?.content ?? "",
				};
			});
			setFiles(merged);
			const current = activeFileRef.current;
			const updated = current && merged.find((file) => file.id === current.id);
			if (updated) setActiveFile(updated);
		}
		if (foldersData.status === "OK") setFolders(foldersData.data);
		return merged;
	}, [functionId]);

	const selectFile = useCallback(
		async (file: FunctionFile) => {
			const current = activeFileRef.current;
			if (file.id === current?.id) {
				// Retrying the same file is how a failed content load recovers.
				if (contentStateRef.current === "error") await loadContent(file);
				return;
			}

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
			openFile(
				filesRef.current.find((entry) => entry.id === file.id) ?? file,
			);
		},
		[confirm, editorViewState, hasUnsavedChanges, loadContent, openFile],
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
		if (
			functionId === null ||
			!activeFileRef.current ||
			contentStateRef.current !== "ready"
		) {
			return false;
		}

		setSaving(true);
		try {
			// The editor stays editable while the request is in flight, so keep
			// persisting until the saved text matches what the user sees.
			for (;;) {
				const file = activeFileRef.current;
				if (!file) return false;

				const content = codeRef.current ?? "";
				const data = await createOrUpdateFile(functionId, {
					filename: file.name,
					code: content,
				});
				if (data.status !== "OK") {
					toast.error("Error saving file: " + data.message);
					return false;
				}

				setFiles((prev) =>
					prev.map((entry) =>
						entry.id === data.data.id ? { ...entry, content } : entry,
					),
				);
				if (codeRef.current === content) return true;
			}
		} catch (error) {
			console.error("Error saving file:", error);
			toast.error("An error occurred while saving the file.");
			return false;
		} finally {
			setSaving(false);
		}
	}, [functionId]);

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

				if (mode === "create") {
					await refreshExplorer();
					return true;
				}

				// Renaming moves every descendant and the open file, so patch the
				// tree locally instead of refetching every file's metadata.
				const renamedPath = (value: string) =>
					value === targetPath
						? fullName
						: value.startsWith(`${targetPath}/`)
							? `${fullName}${value.slice(targetPath.length)}`
							: value;
				setFiles((previous) =>
					previous.map((file) => ({ ...file, name: renamedPath(file.name) })),
				);
				setFolders((previous) =>
					previous.map((folder) => ({
						...folder,
						name: renamedPath(folder.name),
					})),
				);
				setActiveFile((current) =>
					current ? { ...current, name: renamedPath(current.name) } : current,
				);
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

				// The server deleted the folder and its files; drop the same
				// entries locally instead of refetching every remaining file.
				const current = activeFileRef.current;
				const closesOpenFile =
					current !== null && current.name.startsWith(`${folderName}/`);

				for (const file of filesRef.current) {
					if (file.name.startsWith(`${folderName}/`)) {
						editorViewState.forget(file.id);
					}
				}
				setFiles((previous) =>
					previous.filter(
						(file) => !file.name.startsWith(`${folderName}/`),
					),
				);
				setFolders((previous) =>
					previous.filter(
						(folder) =>
							folder.name !== folderName &&
							!folder.name.startsWith(`${folderName}/`),
					),
				);
				if (closesOpenFile) openFile(null);
				toast.success(`Deleted ${folderName}.`);
			} catch (error) {
				console.error("Error deleting folder:", error);
				toast.error("An error occurred while deleting the folder.");
			}
		},
		[confirm, editorViewState, functionId, openFile],
	);

	const loadDefaultInto = useCallback(
		async (defaultToLoad: string) => {
			if (
				functionId === null ||
				!activeFile ||
				contentStateRef.current !== "ready"
			) {
				return false;
			}

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

	/** Fetch one file's text without changing the open editor. */
	const readFileContent = useCallback(
		async (file: FunctionFile) => {
			if (functionId === null) return null;
			try {
				const data = await getFileContent(functionId, file.name);
				return data.status === "OK" ? data.data.content ?? "" : null;
			} catch (error) {
				console.error("Error reading file:", error);
				return null;
			}
		},
		[functionId],
	);

	const downloadFile = useCallback(
		async (file: FunctionFile) => {
			const content = await readFileContent(file);
			if (content === null) {
				toast.error(`Error downloading ${file.name}.`);
				return;
			}
			downloadTextFile(file.name, content);
		},
		[readFileContent],
	);

	/** Load every file's content for an export; `null` if any file failed. */
	const readAllFileContents = useCallback(async () => {
		const loaded = await Promise.all(
			filesRef.current.map(async (file) => {
				const content = await readFileContent(file);
				return content === null ? null : { ...file, content };
			}),
		);
		return loaded.some((file) => file === null)
			? null
			: (loaded as FunctionFile[]);
	}, [readFileContent]);

	return {
		files,
		folders,
		setFolders,
		activeFile,
		code,
		setCode,
		saving,
		contentState,
		contentError,
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
		downloadFile,
		readFileContent,
		readAllFileContents,
	};
}
