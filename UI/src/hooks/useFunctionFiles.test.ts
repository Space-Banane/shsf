import { act, renderHook } from "@testing-library/react";
import { toast } from "react-toastify";
import { useFunctionFiles } from "./useFunctionFiles";
import {
	createOrUpdateFile,
	deleteFile,
	renameFile,
} from "../services/backend.files";
import type { FunctionFile } from "../types/Prisma";

vi.mock("..", () => ({ BASE_URL: "", PUBLIC_BASE_URL: "" }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../services/backend.files", () => ({
	getFiles: vi.fn(),
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

const file = (id: number, name: string, content = ""): FunctionFile =>
	({ id, name, content, functionId: 1 }) as FunctionFile;

const view = { remember: vi.fn(), forget: vi.fn() };

const setup = (options: Partial<Parameters<typeof useFunctionFiles>[0]> = {}) =>
	renderHook(() =>
		useFunctionFiles({
			functionId: 1,
			htmlOnly: false,
			readOnly: false,
			busy: false,
			editorViewState: view,
			...options,
		}),
	);

describe("useFunctionFiles", () => {
	beforeEach(() => vi.clearAllMocks());

	it("opens the startup file first, falling back to the first file", () => {
		const { result } = setup();
		act(() =>
			result.current.replaceFiles(
				[file(1, "a.py", "a"), file(2, "main.py", "m")],
				"main.py",
			),
		);
		expect(result.current.activeFile?.name).toBe("main.py");
		expect(result.current.code).toBe("m");

		const second = setup();
		act(() => second.result.current.replaceFiles([file(1, "a.py", "a")], "missing.py"));
		expect(second.result.current.activeFile?.name).toBe("a.py");
	});

	it("tracks unsaved changes and only allows saving when there are some", () => {
		const { result } = setup();
		act(() => result.current.replaceFiles([file(1, "a.py", "a")], "a.py"));
		expect(result.current.hasUnsavedChanges).toBe(false);
		expect(result.current.canSave).toBe(false);

		act(() => result.current.setCode("changed"));
		expect(result.current.hasUnsavedChanges).toBe(true);
		expect(result.current.canSave).toBe(true);
	});

	it("blocks saving while a run is in progress or the source is git-managed", () => {
		for (const options of [{ busy: true }, { readOnly: true }]) {
			const { result } = setup(options);
			act(() => result.current.replaceFiles([file(1, "a.py", "a")], "a.py"));
			act(() => result.current.setCode("changed"));
			expect(result.current.canSave).toBe(false);
		}
	});

	it("saves the open file and clears the unsaved state", async () => {
		vi.mocked(createOrUpdateFile).mockResolvedValue({
			status: "OK",
			data: file(1, "a.py", "changed"),
		});
		const { result } = setup();
		act(() => result.current.replaceFiles([file(1, "a.py", "a")], "a.py"));
		act(() => result.current.setCode("changed"));

		await act(() => result.current.saveActiveFile());

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
		act(() => result.current.replaceFiles([file(1, "a.py", "a")], "a.py"));
		act(() => result.current.setCode("changed"));

		await act(() => result.current.saveActiveFile());

		expect(toast.error).toHaveBeenCalledWith("Error saving file: denied");
		expect(result.current.hasUnsavedChanges).toBe(true);
	});

	it("asks before discarding unsaved edits when switching files", async () => {
		confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		const { result } = setup();
		const a = file(1, "a.py", "a");
		const b = file(2, "b.py", "b");
		act(() => result.current.replaceFiles([a, b], "a.py"));
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
		act(() => result.current.replaceFiles([file(1, "a.py", "a"), b], "a.py"));

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
		act(() => result.current.replaceFiles([a], "a.py"));

		await act(() => result.current.renameFileTo(a, "z.py"));

		expect(result.current.files[0].name).toBe("z.py");
		expect(result.current.activeFile?.name).toBe("z.py");
	});

	it("closes the editor and forgets its view state when the open file is deleted", async () => {
		vi.mocked(deleteFile).mockResolvedValue({ status: "OK", message: "" });
		const { result } = setup();
		const a = file(1, "a.py", "a");
		act(() => result.current.replaceFiles([a, file(2, "b.py")], "a.py"));

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

	it("keeps the user's edits when the file list is refreshed from the server", () => {
		const { result } = setup();
		act(() => result.current.replaceFiles([file(1, "a.py", "a")], "a.py"));
		act(() => result.current.setCode("edited"));

		act(() => result.current.replaceFiles([file(1, "a.py", "server")], "a.py"));
		expect(result.current.code).toBe("edited");
	});

	it("adopts the server's content on refresh when there are no unsaved edits", () => {
		const { result } = setup();
		act(() => result.current.replaceFiles([file(1, "a.py", "a")], "a.py"));

		act(() => result.current.replaceFiles([file(1, "a.py", "server")], "a.py"));
		expect(result.current.code).toBe("server");
		expect(result.current.hasUnsavedChanges).toBe(false);
	});

	it("does not reopen a file the user closed when the list is refreshed", async () => {
		vi.mocked(deleteFile).mockResolvedValue({ status: "OK", message: "" });
		const { result } = setup();
		const a = file(1, "a.py", "a");
		act(() => result.current.replaceFiles([a], "a.py"));
		await act(() => result.current.deleteFiles([a]));

		act(() => result.current.replaceFiles([file(2, "b.py", "b")], "a.py"));
		expect(result.current.activeFile).toBeNull();
	});
});
