import { executeFunction, executeFunctionStreaming } from "./backend.functions";

vi.mock("..", () => ({ BASE_URL: "" }));

const encoder = new TextEncoder();
const fetchMock = vi.fn<typeof fetch>();

function streamedResponse(chunks: Uint8Array[]): Response {
	return new Response(
		new ReadableStream<Uint8Array>({
			start(controller) {
				for (const chunk of chunks) controller.enqueue(chunk);
				controller.close();
			},
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("function execution cancellation", () => {
	it("passes a caller cancellation to classic and streaming executions", async () => {
		const signals: AbortSignal[] = [];
		fetchMock.mockImplementation((_input, init) => {
			const signal = init?.signal;
			if (signal) signals.push(signal);
			return new Promise((_resolve, reject) => {
				signal?.addEventListener("abort", () =>
					reject(new DOMException("The operation was aborted.", "AbortError")),
				);
			});
		});
		const controller = new AbortController();

		const classic = executeFunction(1, undefined, controller.signal);
		const streaming = executeFunctionStreaming(
			1,
			() => undefined,
			undefined,
			controller.signal,
		);
		await Promise.resolve();

		expect(signals).toHaveLength(2);
		expect(signals.every((signal) => !signal.aborted)).toBe(true);

		controller.abort();

		await expect(classic).rejects.toMatchObject({ name: "AbortError" });
		await expect(streaming).rejects.toMatchObject({ name: "AbortError" });
	});
});

describe("function execution streaming", () => {
	it("parses an object split across chunk boundaries", async () => {
		const payload = encoder.encode(
			JSON.stringify({ type: "output", content: "split object" }),
		);
		fetchMock.mockResolvedValue(
			streamedResponse([
				payload.slice(0, 7),
				payload.slice(7, 20),
				payload.slice(20),
			]),
		);
		const onChunk = vi.fn();

		await executeFunctionStreaming(1, onChunk);

		expect(onChunk).toHaveBeenCalledTimes(1);
		expect(onChunk).toHaveBeenCalledWith({
			type: "output",
			content: "split object",
		});
	});

	it("frames objects at a } { boundary and ignores braces inside strings", async () => {
		const first = JSON.stringify({ type: "output", content: "a}{b" });
		const second = JSON.stringify({ type: "output", content: "c" });
		fetchMock.mockResolvedValue(
			streamedResponse([encoder.encode(first), encoder.encode(second)]),
		);
		const onChunk = vi.fn();

		await executeFunctionStreaming(1, onChunk);

		expect(onChunk).toHaveBeenCalledTimes(2);
		expect(onChunk.mock.calls.map(([data]) => data.content)).toEqual([
			"a}{b",
			"c",
		]);
	});

	it("decodes a multi-byte character split across chunks", async () => {
		const content = "👋🏽 日本語";
		const payload = encoder.encode(
			JSON.stringify({ type: "output", content }),
		);
		const emojiStart = payload.indexOf(0xf0);
		expect(emojiStart).toBeGreaterThan(-1);

		fetchMock.mockResolvedValue(
			streamedResponse([
				payload.slice(0, emojiStart + 2),
				payload.slice(emojiStart + 2),
			]),
		);
		const onChunk = vi.fn();

		await executeFunctionStreaming(1, onChunk);

		expect(onChunk).toHaveBeenCalledWith({ type: "output", content });
	});

	it("surfaces error responses", async () => {
		fetchMock.mockResolvedValue(
			new Response(
				JSON.stringify({
					status: "FAILED",
					code: "REQUEST_TIMEOUT",
					message: "Timed out",
				}),
				{ status: 408, headers: { "Content-Type": "application/json" } },
			),
		);
		const onChunk = vi.fn();

		await executeFunctionStreaming(1, onChunk);

		expect(onChunk).toHaveBeenCalledWith(
			expect.objectContaining({ type: "error", code: "REQUEST_TIMEOUT" }),
		);
	});

	it("aborts a stalled body once the execution timeout expires", async () => {
		vi.useFakeTimers();
		const first = encoder.encode(
			JSON.stringify({ type: "output", content: "start" }),
		);
		fetchMock.mockResolvedValue(
			new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(first);
					},
				}),
				{ status: 200 },
			),
		);
		const onChunk = vi.fn();

		const execution = executeFunctionStreaming(1, onChunk);
		const rejection = expect(execution).rejects.toMatchObject({
			name: "AbortError",
		});
		await vi.advanceTimersByTimeAsync(0);
		expect(onChunk).toHaveBeenCalledWith({
			type: "output",
			content: "start",
		});

		await vi.advanceTimersByTimeAsync(15 * 60_000);

		await rejection;
	});
});
