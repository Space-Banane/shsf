import { describe, expect, it, vi } from "vitest";
import { makeResponse } from "../lib/response";

function createCtr() {
	const ctr: any = {
		print: vi.fn((body) => body),
	};
	ctr.status = vi.fn(() => ctr);
	return ctr;
}

describe("makeResponse", () => {
	it("adds a stable validation code while preserving safe client guidance", async () => {
		const ctr = createCtr();

		await makeResponse({
			ctr,
			content: { code: 400, message: "Function name is required" },
		});

		expect(ctr.status).toHaveBeenCalledWith(400);
		expect(ctr.print).toHaveBeenCalledWith({
			status: "FAILED",
			code: "VALIDATION_ERROR",
			message: "Function name is required",
		});
	});

	it("masks internal details and emits the server error code", async () => {
		const ctr = createCtr();

		await makeResponse({
			ctr,
			content: { code: 500, message: "database password=secret" },
		});

		expect(ctr.print).toHaveBeenCalledWith({
			status: "FAILED",
			code: "SERVER_ERROR",
			message: "An unexpected server error has occurred.",
		});
	});
});
