import { act, renderHook } from "@testing-library/react";
import { toast } from "react-toastify";
import { useFunctionFiles } from "./useFunctionFiles";
import {
	createOrUpdateFile,
	deleteFile,
	deleteFolder,
	getFileContent,
	getFiles,
	getFolders,
	renameFile,
	renameFolder,
} from "../services/backend.files";
import type { FunctionFile } from "../types/Prisma";

vi.mock("..", () => ({ BASE_URL: "", PUBLIC_BASE_URL: "" }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../services/backend.files", () => ({
	getFiles: vi.fn(),
	getFileContent: vi.fn(),
	getFolders: vi.fn(),
	createOrUpdateFile: vi.fn(),
	createFolder: vi.fn(),
	deleteFile: vi.fn(),
	deleteFolder: vi.fn(),
	renameFile: vi.fn(),
	renameFolder: vi.fn(),
	loadDefaultContent: vi.fn(),
}));
const confirm = vi.fn();
vi.mock("../components/modals/ConfirmModal", () => ({ useConfirm: () => confirm }));

const fileContents = new Map<string, string>();
const file = (id: number, name: string, content = ""): FunctionFile => {
	fileContents.set(name, content);
	return { id, name, content, functionId: 1 } as FunctionFile;
};

const view = { remember: vi.fn(), forget: vi.fn() };

const setup = (options: Partial<Parameters<typeof useFunctionFiles>[0]> = {}) =>
	renderHook(() =>
		useFunctionFiles({
			functionId: 1,
			htmlOnly: false,
			readOnly: false,
			editorViewState: view,
			...options,
		}),
	);

/** Replace the list and wait for the selected file's content to arrive. */
const openFiles = async (
	result: ReturnType<typeof setup>["result"],
	files: FunctionFile[],
	startupFile?: string,
) => {
	await act(async () => {
		result.current.replaceFiles(files, startupFile);
	});
};

describe("useFunctionFiles", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		fileContents.clear();
		vi.mocked(getFileContent).mockImplementation(async (_functionId, name) => {
			const content = fileContents.get(name);
			return content === undefined
				? { status: "FAILED", code: "NOT_FOUND", message: "File not found" }
				: { status: "OK", data: { name, content } };
		});
	});

	it("opens the startup file first, falling back to the first file", async () => {
		const { result } = setup();
		await openFiles(
			result,
			[file(1, "a.py", "a"), file(2, "main.py", "m")],
			"main.py",
		);
		expect(result.current.activeFile?.name).toBe("main.py");
		expect(result.current.code).toBe("m");

		const second = setup();
		await openFiles(second.result, [file(1, "a.py", "a")], "missing.py");
		expect(second.result.current.activeFile?.name).toBe("a.py");
		expect(second.result.current.code).toBe("a");
	});

	it("tracks unsaved changes and only allows saving when there are some", async () => {
		const { result } = setup();
		await openFiles(result, [file(1, "a.py", "a")], "a.py");
		expect(result.current.hasUnsavedChanges).toBe(false);
		expect(result.current.canSave).toBe(false);

		act(() => result.current.setCode("changed"));
		expect(result.current.hasUnsavedChanges).toBe(true);
		expect(result.current.canSave).toBe(true);
	});

	it("blocks saving when the source is git-managed", async () => {
		const { result } = setup({ readOnly: true });
		await openFiles(result, [file(1, "a.py", "a")], "a.py");
		act(() => result.current.setCode("changed"));
		expect(result.current.canSave).toBe(false);
	});

	it("saves the open file and clears the unsaved state", async () => {
		vi.mocked(createOrUpdateFile).mockResolvedValue({
			status: "OK",
			data: file(1, "a.py", "changed"),
		});
		const { result } = setup();
		await openFiles(result, [file(1, "a.py", "a")], "a.py");
		act(() => result.current.setCode("changed"));

		let saved = false;
		await act(async () => {
			saved = await result.current.saveActiveFile();
		});

		expect(saved).toBe(true);
		expect(createOrUpdateFile).toHaveBeenCalledWith(1, { filename: "a.py", code: "changed" });
		expect(result.current.hasUnsavedChanges).toBe(false);
		expect(result.current.files[0].content).toBe("changed");
	});

	it("keeps unsaved text when a save fails", async () => {
		vi.mocked(createOrUpdateFile).mockResolvedValue({
			status: 500,
			message: "denied",
		} as never);
		const { result } = setup();
		await openFiles(result, [file(1, "a.py", "a")], "a.py");
		act(() => result.current.setCode("changed"));

		let saved = true;
		await act(async () => {
			saved = await result.current.saveActiveFile();
		});

		expect(saved).toBe(false);
		expect(toast.error).toHaveBeenCalledWith("Error saving file: denied");
		expect(result.current.hasUnsavedChanges).toBe(true);
	});

	it("persists edits typed while a save is in flight", async () => {
		let resolveFirst: (value: unknown) => void = () => {};
		vi.mocked(createOrUpdateFile)
			.mockImplementationOnce(
				() => new Promise((resolve) => (resolveFirst = resolve)) as never,
			)
			.mockResolvedValueOnce({
				status: "OK",
				data: file(1, "a.py", "second"),
			});
		const { result } = setup();
		await openFiles(result, [file(1, "a.py", "a")], "a.py");
		act(() => result.current.setCode("first"));

		let pending!: Promise<boolean>;
		act(() => {
			pending = result.current.saveActiveFile();
		});
		act(() => result.current.setCode("second"));
		resolveFirst({ status: "OK", data: file(1, "a.py", "first") });
		await act(async () => {
			await pending;
		});

		expect(createOrUpdateFile).toHaveBeenLastCalledWith(1, {
			filename: "a.py",
			code: "second",
		});
		expect(result.current.hasUnsavedChanges).toBe(false);
	});

	it("asks before discarding unsaved edits when switching files", async () => {
		confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		const { result } = setup();
		const a = file(1, "a.py", "a");
		const b = file(2, "b.py", "b");
		await openFiles(result, [a, b], "a.py");
		act(() => result.current.setCode("edited"));

		await act(() => result.current.selectFile(b));
		expect(result.current.activeFile?.id).toBe(1);
		expect(result.current.code).toBe("edited");

		await act(() => result.current.selectFile(b));
		expect(view.remember).toHaveBeenCalledWith(1);
		expect(result.current.activeFile?.id).toBe(2);
		expect(result.current.code).toBe("b");
	});

	it("switches files without a prompt when nothing is unsaved", async () => {
		const { result } = setup();
		const b = file(2, "b.py", "b");
		await openFiles(result, [file(1, "a.py", "a"), b], "a.py");

		await act(() => result.current.selectFile(b));

		expect(confirm).not.toHaveBeenCalled();
		expect(result.current.activeFile?.id).toBe(2);
	});

	it("refuses non-html files for html-only functions", async () => {
		const { result } = setup({ htmlOnly: true });

		const outcome = await result.current.persistFile("main.py", "x");

		expect(outcome).toEqual({
			success: false,
			message: "Only .html files are allowed for this function.",
		});
		expect(createOrUpdateFile).not.toHaveBeenCalled();
	});

	it("renames the open file everywhere", async () => {
		vi.mocked(renameFile).mockResolvedValue({ status: "OK", message: "" });
		const { result } = setup();
		const a = file(1, "a.py", "a");
		await openFiles(result, [a], "a.py");

		await act(() => result.current.renameFileTo(a, "z.py"));

		expect(result.current.files[0].name).toBe("z.py");
		expect(result.current.activeFile?.name).toBe("z.py");
	});

	it("closes the editor and forgets its view state when the open file is deleted", async () => {
		vi.mocked(deleteFile).mockResolvedValue({ status: "OK", message: "" });
		const { result } = setup();
		const a = file(1, "a.py", "a");
		await openFiles(result, [a, file(2, "b.py")], "a.py");

		await act(() => result.current.deleteFiles([a]));

		expect(view.forget).toHaveBeenCalledWith(1);
		expect(result.current.activeFile).toBeNull();
		expect(result.current.code).toBeNull();
		expect(result.current.files.map((f) => f.id)).toEqual([2]);
	});

	it("does not delete when the confirmation is declined", async () => {
		confirm.mockResolvedValue(false);
		const { result } = setup();

		const deleted = await result.current.confirmAndDeleteFiles([file(1, "a.py")]);

		expect(deleted).toBe(false);
		expect(deleteFile).not.toHaveBeenCalled();
	});

	it("keeps the user's edits when the file list is refreshed from the server", async () => {
		const { result } = setup();
		await openFiles(result, [file(1, "a.py", "a")], "a.py");
		act(() => result.current.setCode("edited"));

		act(() => result.current.replaceFiles([file(1, "a.py", "server")], "a.py"));
		expect(result.current.code).toBe("edited");
	});

	it("adopts the server's content on refresh when there are no unsaved edits", async () => {
		const { result } = setup();
		await openFiles(result, [file(1, "a.py", "a")], "a.py");

		act(() => result.current.replaceFiles([file(1, "a.py", "server")], "a.py"));
		expect(result.current.code).toBe("server");
		expect(result.current.hasUnsavedChanges).toBe(false);
	});

	it("does not reopen a file the user closed when the list is refreshed", async () => {
		vi.mocked(deleteFile).mockResolvedValue({ status: "OK", message: "" });
		const { result } = setup();
		const a = file(1, "a.py", "a");
		await openFiles(result, [a], "a.py");
		await act(() => result.current.deleteFiles([a]));

		act(() => result.current.replaceFiles([file(2, "b.py", "b")], "a.py"));
		expect(result.current.activeFile).toBeNull();
	});

	it("fetches content only when a file is opened", async () => {
		const { result } = setup();
		await openFiles(
			result,
			[file(1, "a.py", "a"), file(2, "b.py", "b")],
			"a.py",
		);
		expect(getFileContent).toHaveBeenCalledTimes(1);
		expect(getFileContent).toHaveBeenCalledWith(1, "a.py");

		await act(() => result.current.selectFile(result.current.files[1]));

		expect(getFileContent).toHaveBeenCalledTimes(2);
		expect(getFileContent).toHaveBeenLastCalledWith(1, "b.py");
		expect(result.current.code).toBe("b");
		expect(result.current.contentState).toBe("ready");
	});

	it("surfaces a load error and retries when the same file is selected again", async () => {
		vi.mocked(getFileContent).mockResolvedValueOnce({
			status: "FAILED",
			code: "NOT_FOUND",
			message: "File not found",
		});
		const { result } = setup();
		await openFiles(result, [file(1, "a.py", "a")], "a.py");

		expect(result.current.contentState).toBe("error");
		expect(result.current.contentError).toBe("File not found");

		await act(() => result.current.selectFile(result.current.files[0]));

		expect(result.current.contentState).toBe("ready");
		expect(result.current.code).toBe("a");
	});

	it("renames a folder in the tree without refetching files", async () => {
		vi.mocked(renameFolder).mockResolvedValue({ status: "OK", message: "" });
		const { result } = setup();
		await openFiles(
			result,
			[file(1, "src/a.py", "a"), file(2, "lib/b.py", "b")],
			"src/a.py",
		);
		act(() =>
			result.current.setFolders([
				{ id: 5, name: "src", functionId: 1 },
				{ id: 6, name: "src/nested", functionId: 1 },
			] as never),
		);

		let renamed = false;
		await act(async () => {
			renamed = await result.current.submitFolder(
				"rename",
				{ parentPath: "", targetPath: "src" },
				"app",
			);
		});

		expect(renamed).toBe(true);
		expect(getFiles).not.toHaveBeenCalled();
		expect(getFolders).not.toHaveBeenCalled();
		expect(result.current.files.map((entry) => entry.name)).toEqual([
			"app/a.py",
			"lib/b.py",
		]);
		expect(result.current.folders.map((entry) => entry.name)).toEqual([
			"app",
			"app/nested",
		]);
		expect(result.current.activeFile?.name).toBe("app/a.py");
	});

	it("deletes a folder locally without refetching files", async () => {
		vi.mocked(deleteFolder).mockResolvedValue({ status: "OK", message: "" });
		confirm.mockResolvedValue(true);
		const { result } = setup();
		await openFiles(
			result,
			[file(1, "src/a.py", "a"), file(2, "lib/b.py", "b")],
			"src/a.py",
		);
		act(() =>
			result.current.setFolders([
				{ id: 5, name: "src", functionId: 1 },
				{ id: 6, name: "src/nested", functionId: 1 },
			] as never),
		);

		await act(() => result.current.removeFolder("src"));

		expect(getFiles).not.toHaveBeenCalled();
		expect(getFolders).not.toHaveBeenCalled();
		expect(result.current.files.map((entry) => entry.name)).toEqual(["lib/b.py"]);
		expect(result.current.folders).toEqual([]);
		expect(result.current.activeFile).toBeNull();
	});
});
