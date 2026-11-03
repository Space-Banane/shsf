import { act, renderHook, waitFor } from "@testing-library/react";
import { useFunctionExecution } from "./useFunctionExecution";
import {
	executeFunction,
	executeFunctionStreaming,
} from "../services/backend.functions";

vi.mock("..", () => ({ BASE_URL: "", PUBLIC_BASE_URL: "" }));
vi.mock("../services/backend.functions", () => ({
	executeFunction: vi.fn(),
	executeFunctionStreaming: vi.fn(),
}));

const htmlResult = {
	_shsf: "v2",
	_headers: { "content-type": "text/html" },
	_res: "<p>page</p>",
	_code: 200,
};

const setup = (resultModalsEnabled = true) =>
	renderHook(
		({ enabled }) =>
			useFunctionExecution({ functionId: 4, resultModalsEnabled: enabled }),
		{ initialProps: { enabled: resultModalsEnabled } },
	);

describe("useFunctionExecution", () => {
	beforeEach(() => vi.clearAllMocks());

	it("streams output chunks, then records exit code, timings and a value result", async () => {
		vi.mocked(executeFunctionStreaming).mockImplementation(async (_id, onChunk) => {
			onChunk({ type: "output", content: "hello " });
			onChunk({ type: "output", content: "world" });
			onChunk({
				type: "end",
				exitCode: 0,
				result: { ok: true },
				took: [{ timestamp: 1, value: 12, description: "Total execution time" }],
			});
		});
		const { result } = setup();

		await act(() => result.current.run());

		expect(result.current.consoleOutput).toBe("hello world");
		expect(result.current.exitCode).toBe(0);
		expect(result.current.realTimeTaken).toBe(12);
		expect(result.current.valueResult).toMatchObject({
			title: "Function Result",
			value: { ok: true },
			type: "object",
		});
		expect(result.current.running).toBe(false);
	});

	it("passes run params to the backend only when they are enabled", async () => {
		vi.mocked(executeFunctionStreaming).mockResolvedValue(undefined);
		const { result } = setup();

		act(() => result.current.setRunParams('{"n":2}'));
		await act(() => result.current.run());
		expect(vi.mocked(executeFunctionStreaming).mock.calls[0][2]).toBeUndefined();

		act(() => result.current.setShowRunParams(true));
		await act(() => result.current.run());
		expect(vi.mocked(executeFunctionStreaming).mock.calls[1][2]).toEqual({
			run: { n: 2 },
		});
	});

	it("refuses to run with invalid JSON params and never calls the backend", async () => {
		const { result } = setup();
		act(() => {
			result.current.setShowRunParams(true);
			result.current.setRunParams("{nope");
		});

		await act(() => result.current.run());

		expect(result.current.consoleOutput).toBe(
			"Error parsing run parameters: Invalid JSON",
		);
		expect(result.current.running).toBe(false);
		expect(executeFunctionStreaming).not.toHaveBeenCalled();
	});

	it("renders HTML results as a popup in classic mode instead of a value modal", async () => {
		vi.mocked(executeFunction).mockResolvedValue({
			status: "OK",
			data: { output: "", exitCode: 0, result: htmlResult },
		});
		const { result } = setup();
		act(() => result.current.setRunMode("classic"));

		await act(() => result.current.run());

		expect(result.current.popup).toMatchObject({ kind: "html", html: "<p>page</p>" });
		expect(result.current.valueResult).toBeNull();
		expect(result.current.consoleOutput).toBe("Popup rendered.");
	});

	it("shows no result modals when they are turned off", async () => {
		vi.mocked(executeFunction).mockResolvedValue({
			status: "OK",
			data: { output: "out", exitCode: 0, result: htmlResult },
		});
		const { result } = setup(false);
		act(() => result.current.setRunMode("classic"));

		await act(() => result.current.run());

		expect(result.current.popup).toBeNull();
		expect(result.current.valueResult).toBeNull();
		expect(result.current.consoleOutput).toBe("out");
	});

	it("closes open result modals when they get turned off", async () => {
		vi.mocked(executeFunction).mockResolvedValue({
			status: "OK",
			data: { output: "", exitCode: 0, result: "plain" },
		});
		const { result, rerender } = setup();
		act(() => result.current.setRunMode("classic"));
		await act(() => result.current.run());
		expect(result.current.valueResult).not.toBeNull();

		rerender({ enabled: false });
		await waitFor(() => expect(result.current.valueResult).toBeNull());
	});

	it("reports streamed errors and connection failures", async () => {
		vi.mocked(executeFunctionStreaming).mockImplementationOnce(async (_id, onChunk) => {
			onChunk({ type: "error", error: "boom" });
		});
		const { result } = setup();
		await act(() => result.current.run());
		expect(result.current.consoleOutput).toBe("\nError: boom");

		vi.mocked(executeFunctionStreaming).mockRejectedValueOnce(new Error("net"));
		await act(() => result.current.run());
		expect(result.current.consoleOutput).toContain("Connection error");
		expect(result.current.running).toBe(false);
	});

	it("aborts the in-flight execution on unmount without touching state", async () => {
		let signal: AbortSignal | undefined;
		vi.mocked(executeFunctionStreaming).mockImplementation(
			(_id, _onChunk, _data, abortSignal) => {
				signal = abortSignal;
				return new Promise(() => {});
			},
		);
		const { result, unmount } = setup();

		act(() => void result.current.run());
		await waitFor(() => expect(signal).toBeDefined());
		unmount();

		expect(signal?.aborted).toBe(true);
	});
});
