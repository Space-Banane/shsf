import { useCallback, useEffect, useRef } from "react";
import type { OnMount } from "@monaco-editor/react";

type MonacoEditor = Parameters<OnMount>[0];
type ViewState = ReturnType<MonacoEditor["saveViewState"]>;

/**
 * Remembers each file's cursor/scroll position so switching files in the
 * editor restores where the user left off.
 */
export function useEditorViewState() {
	const editorRef = useRef<MonacoEditor | null>(null);
	const viewStates = useRef(new Map<number, ViewState>());

	useEffect(() => {
		const states = viewStates.current;
		return () => {
			states.clear();
			editorRef.current = null;
		};
	}, []);

	const remember = useCallback((fileId: number) => {
		if (editorRef.current) {
			viewStates.current.set(fileId, editorRef.current.saveViewState());
		}
	}, []);

	const forget = useCallback((fileId: number) => {
		viewStates.current.delete(fileId);
	}, []);

	const restore = useCallback((fileId: number) => {
		const editor = editorRef.current;
		if (!editor) return;
		const saved = viewStates.current.get(fileId);
		if (saved) editor.restoreViewState(saved);
		editor.focus();
	}, []);

	return { editorRef, remember, forget, restore };
}

export type EditorViewState = ReturnType<typeof useEditorViewState>;
