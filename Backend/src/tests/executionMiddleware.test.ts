import { describe, expect, it, vi } from "vitest";
import { readRawRequestBodyFromMiddleware } from "../lib/middlewares/executionBody";

function createCtr(method: string, chunks: Array<Buffer | string>) {
	const bodyState = {
		awaiting: false,
		raw: null as Buffer | null,
		chunks: [] as Buffer[],
		callbacks: [] as Array<(body: Buffer) => void>,
	};

	return {
		url: { method },
		context: { body: bodyState },
		rawContext: {
			onBodyChunk: vi.fn(async (callback: (chunk: Uint8Array, isLast: boolean) => void) => {
				for (let i = 0; i < chunks.length; i++) {
					callback(Buffer.from(chunks[i]), i === chunks.length - 1);
				}
			}),
		},
	};
}

describe("readRawRequestBodyFromMiddleware", () => {
	it("collects the raw body before route matching and caches it", async () => {
		const ctr = createCtr("POST", ['{"hello":', '"world"}']);

		const first = await readRawRequestBodyFromMiddleware(ctr);
		const second = await readRawRequestBodyFromMiddleware(ctr);

		expect(first.toString("utf-8")).toBe('{"hello":"world"}');
		expect(second.toString("utf-8")).toBe('{"hello":"world"}');
		expect(ctr.rawContext.onBodyChunk).toHaveBeenCalledTimes(1);
	});

	it("returns an empty buffer for GET requests", async () => {
		const ctr = createCtr("GET", ["ignored"]);

		const body = await readRawRequestBodyFromMiddleware(ctr);

		expect(body).toEqual(Buffer.alloc(0));
		expect(ctr.rawContext.onBodyChunk).not.toHaveBeenCalled();
	});
});
