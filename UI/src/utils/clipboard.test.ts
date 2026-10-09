import { copyTextToClipboard } from "./clipboard";

describe("copyTextToClipboard", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: undefined,
		});
	});

	it("uses the Clipboard API when available", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});

		await copyTextToClipboard("copy me");

		expect(writeText).toHaveBeenCalledWith("copy me");
	});

	it("falls back to execCommand when Clipboard API writes are unavailable", async () => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: vi.fn().mockRejectedValue(new Error("insecure origin")) },
		});
		const execCommand = vi.fn().mockReturnValue(true);
		Object.defineProperty(document, "execCommand", {
			configurable: true,
			value: execCommand,
		});

		await copyTextToClipboard("fallback copy");

		expect(execCommand).toHaveBeenCalledWith("copy");
		expect(document.querySelector("textarea")).not.toBeInTheDocument();
	});
});
