import {
	classifyPopupResult,
	findTotalExecutionTime,
	parseRunParams,
} from "./functionExecution";

describe("classifyPopupResult", () => {
	it("ignores plain values and non-v2 objects", () => {
		expect(classifyPopupResult("hello")).toBeNull();
		expect(classifyPopupResult(null)).toBeNull();
		expect(classifyPopupResult({ _res: "<p>hi</p>", _headers: {} })).toBeNull();
	});

	it("treats a v2 string response as an HTML popup with its status code", () => {
		expect(
			classifyPopupResult({
				_shsf: "v2",
				_headers: { "Content-Type": "text/html" },
				_res: "<p>hi</p>",
				_code: 201,
			}),
		).toEqual({
			kind: "html",
			headers: { "Content-Type": "text/html" },
			html: "<p>hi</p>",
			code: 201,
		});
	});

	it("defaults the status code to 200", () => {
		const popup = classifyPopupResult({
			_shsf: "v2",
			_headers: {},
			_res: "ok",
		});
		expect(popup).toMatchObject({ kind: "html", code: 200 });
	});

	it("builds a data URL for base64 image responses, even when the body is a JSON string", () => {
		const popup = classifyPopupResult({
			_shsf: "v2",
			_headers: { "content-type": "image/png" },
			_res: JSON.stringify({ __shsf_transport: "base64-bytes-v1", data: "AAAA" }),
		});
		expect(popup).toMatchObject({
			kind: "image",
			src: "data:image/png;base64,AAAA",
			contentType: "image/png",
		});
	});

	it("does not treat an image content type without a base64 body as an image", () => {
		expect(
			classifyPopupResult({
				_shsf: "v2",
				_headers: { "content-type": "image/png" },
				_res: { not: "transport" },
			}),
		).toBeNull();
	});
});

describe("parseRunParams", () => {
	it("returns null when params are hidden or blank", () => {
		expect(parseRunParams(false, '{"a":1}')).toEqual({ ok: true, value: null });
		expect(parseRunParams(true, "   ")).toEqual({ ok: true, value: null });
	});

	it("parses valid JSON and rejects invalid JSON", () => {
		expect(parseRunParams(true, '{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
		expect(parseRunParams(true, "{nope")).toEqual({ ok: false });
	});
});

describe("findTotalExecutionTime", () => {
	it("finds the total entry or returns null", () => {
		const took = [
			{ timestamp: 1, value: 3, description: "Setup" },
			{ timestamp: 2, value: 9, description: "Total execution time" },
		];
		expect(findTotalExecutionTime(took)).toBe(9);
		expect(findTotalExecutionTime(took.slice(0, 1))).toBeNull();
	});
});
