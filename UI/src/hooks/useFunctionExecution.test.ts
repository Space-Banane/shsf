import { act, renderHook, waitFor } from "@testing-library/react";
import { useFunctionExecution } from "./useFunctionExecution";
import { apiFetch } from "../services/api";

vi.mock("..", () => ({ BASE_URL: "", PUBLIC_BASE_URL: "" }));
vi.mock("../services/api", () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);
const encoder = new TextEncoder();

const htmlResult = {
	_shsf: "v2",
	_headers: { "content-type": "text/html" },
	_res: "<p>page</p>",
	_code: 200,
};

function jsonResponse(body: unknown): Response {
	return { ok: true, status: 200, json: async () => body } as Response;
}

function streamResponse(events: unknown[]): Response {
	const payload = encoder.encode(
		events.map((event) => JSON.stringify(event)).join(""),
	);
	return {
		ok: true,
		status: 200,
		body: new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(payload);
				controller.close();
			},
		}),
	} as Response;
}

const setup = (resultModalsEnabled = true) =>
	renderHook(
		({ enabled }) =>
			useFunctionExecution({ functionId: 4, resultModalsEnabled: enabled }),
		{ initialProps: { enabled: resultModalsEnabled } },
	);

describe("useFunctionExecution", () => {
	beforeEach(() => {
		mockedApiFetch.mockReset();
	});

	it("streams output chunks, then records exit code, timings and a value result", async () => {
		mockedApiFetch.mockResolvedValue(
			streamResponse([
				{ type: "output", content: "hello " },
				{ type: "output", content: "world" },
				{
					type: "end",
					exitCode: 0,
					result: { ok: true },
					took: [{ timestamp: 1, value: 12, description: "Total execution time" }],
				},
			]),
		);
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
		mockedApiFetch.mockResolvedValue(streamResponse([]));
		const { result } = setup();

		act(() => result.current.setRunParams('{"n":2}'));
		await act(() => result.current.run());
		expect(mockedApiFetch.mock.calls[0][1]?.body).toBeUndefined();

		act(() => result.current.setShowRunParams(true));
		await act(() => result.current.run());
		expect(JSON.parse(String(mockedApiFetch.mock.calls[1][1]?.body))).toEqual({
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
		expect(mockedApiFetch).not.toHaveBeenCalled();
	});

	it("renders HTML results as a popup in classic mode instead of a value modal", async () => {
		mockedApiFetch.mockResolvedValue(
			jsonResponse({
				status: "OK",
				data: { output: "", exitCode: 0, result: htmlResult },
			}),
		);
		const { result } = setup();
		act(() => result.current.setRunMode("classic"));

		await act(() => result.current.run());

		expect(result.current.popup).toMatchObject({ kind: "html", html: "<p>page</p>" });
		expect(result.current.valueResult).toBeNull();
		expect(result.current.consoleOutput).toBe("Popup rendered.");
	});

	it("shows no result modals when they are turned off", async () => {
		mockedApiFetch.mockResolvedValue(
			jsonResponse({
				status: "OK",
				data: { output: "out", exitCode: 0, result: htmlResult },
			}),
		);
		const { result } = setup(false);
		act(() => result.current.setRunMode("classic"));

		await act(() => result.current.run());

		expect(result.current.popup).toBeNull();
		expect(result.current.valueResult).toBeNull();
		expect(result.current.consoleOutput).toBe("out");
	});

	it("closes open result modals when they get turned off", async () => {
		mockedApiFetch.mockResolvedValue(
			jsonResponse({
				status: "OK",
				data: { output: "", exitCode: 0, result: "plain" },
			}),
		);
		const { result, rerender } = setup();
		act(() => result.current.setRunMode("classic"));
		await act(() => result.current.run());
		expect(result.current.valueResult).not.toBeNull();

		rerender({ enabled: false });
		await waitFor(() => expect(result.current.valueResult).toBeNull());
	});

	it("reports streamed errors and connection failures", async () => {
		mockedApiFetch.mockResolvedValueOnce(
			streamResponse([{ type: "error", error: "boom" }]),
		);
		const { result } = setup();
		await act(() => result.current.run());
		expect(result.current.consoleOutput).toBe("\nError: boom");

		mockedApiFetch.mockRejectedValueOnce(new Error("net"));
		await act(() => result.current.run());
		expect(result.current.consoleOutput).toContain("Connection error");
		expect(result.current.running).toBe(false);
	});

	it("aborts the in-flight execution on unmount without touching state", async () => {
		let signal: AbortSignal | undefined;
		mockedApiFetch.mockImplementation((_input, init) => {
			signal = init?.signal ?? undefined;
			return new Promise((_resolve, reject) => {
				signal?.addEventListener("abort", () =>
					reject(new DOMException("The operation was aborted.", "AbortError")),
				);
			});
		});
		const { result, unmount } = setup();

		let execution: Promise<void> | undefined;
		act(() => {
			execution = result.current.run();
		});
		expect(signal).toBeDefined();
		unmount();

		expect(signal?.aborted).toBe(true);
		await expect(execution).resolves.toBeUndefined();
	});
});
