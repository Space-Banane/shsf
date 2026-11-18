import { describe, expect, it } from "vitest";
import { IMMUTABLE_CACHE_CONTROL, isHashedAssetPath } from "../lib/static";

describe("isHashedAssetPath", () => {
	it("marks Vite bundle paths as immutable", () => {
		expect(isHashedAssetPath("/assets/index-B3x9kQ1a.js")).toBe(true);
		expect(isHashedAssetPath("/assets/index-D7f2mZ0p.css")).toBe(true);
		expect(IMMUTABLE_CACHE_CONTROL).toBe("public, max-age=31536000, immutable");
	});

	it("leaves unhashed and non-UI paths alone", () => {
		expect(isHashedAssetPath("/")).toBe(false);
		expect(isHashedAssetPath("/index.html")).toBe(false);
		expect(isHashedAssetPath("/assets")).toBe(false);
		expect(isHashedAssetPath("/api/assets/thing")).toBe(false);
		expect(isHashedAssetPath("/SHSF.png")).toBe(false);
	});
});
