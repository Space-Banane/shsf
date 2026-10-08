import { parseRunTriggerResponse } from "./backend.triggers";

jest.mock("..", () => ({ BASE_URL: "" }));

describe("trigger run response parsing", () => {
	it("accepts the documented response envelope", () => {
		expect(
			parseRunTriggerResponse({
				status: "OK",
				data: { result: { completed: true }, exit_code: 0, logs: "done" },
			}),
		).toEqual({
			status: "OK",
			data: { result: { completed: true }, exit_code: 0, logs: "done" },
		});
	});

	it("turns malformed successful responses into a safe failure", () => {
		expect(parseRunTriggerResponse({ status: "OK", data: { exit_code: "0" } }))
			.toMatchObject({ status: "FAILED", code: "SERVER_ERROR" });
	});
});
