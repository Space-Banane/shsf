import { executeFunction, executeFunctionStreaming } from "./backend.functions";
import { apiFetch } from "./api";
import type { MockedFunction } from "vitest";

vi.mock("..", () => ({ BASE_URL: "" }));
vi.mock("./api", () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = apiFetch as MockedFunction<typeof apiFetch>;

describe("function execution cancellation", () => {
	beforeEach(() => mockedApiFetch.mockReset());

	it("passes a caller cancellation signal to classic and streaming executions", async () => {
		mockedApiFetch
			.mockResolvedValueOnce({ json: async () => ({ status: "OK" }) } as Response)
			.mockResolvedValueOnce({
				ok: false,
				json: async () => ({ code: "REQUEST_TIMEOUT", message: "Timed out" }),
			} as Response);
		const controller = new AbortController();

		await executeFunction(1, undefined, controller.signal);
		await executeFunctionStreaming(1, () => undefined, undefined, controller.signal);

		expect(mockedApiFetch).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining("/api/function/1/execute?stream=false"),
			expect.objectContaining({ signal: controller.signal }),
		);
		expect(mockedApiFetch).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining("/api/function/1/execute?stream=true"),
			expect.objectContaining({ signal: controller.signal }),
		);
	});
});
