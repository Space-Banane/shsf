import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import "./monaco";

describe("monaco setup", () => {
	it("hands the locally bundled Monaco instance to the loader without network access", async () => {
		const fetchSpy = vi.fn(() => {
			throw new Error("network access is not allowed");
		});
		vi.stubGlobal("fetch", fetchSpy);

		await expect(loader.init()).resolves.toBe(monaco);
		expect(fetchSpy).not.toHaveBeenCalled();

		vi.unstubAllGlobals();
	});
});
