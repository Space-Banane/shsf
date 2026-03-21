import { describe, it, expect } from "vitest";
import { buildAuthUrl, stripCredentialsFromUrl } from "../../lib/GitOps";

describe("buildAuthUrl", () => {
    it("injects credentials into a valid URL", () => {
        const result = buildAuthUrl("https://github.com/user/repo.git", "myuser", "mytoken");
        expect(result).toBe("https://myuser:mytoken@github.com/user/repo.git");
    });

    it("returns the original URL for malformed input", () => {
        const bad = "not-a-url";
        expect(buildAuthUrl(bad, "u", "p")).toBe(bad);
    });

    it("overwrites existing credentials in the URL", () => {
        const result = buildAuthUrl("https://old:creds@github.com/user/repo.git", "newuser", "newtoken");
        expect(result).toBe("https://newuser:newtoken@github.com/user/repo.git");
    });
});

describe("stripCredentialsFromUrl", () => {
    it("removes credentials from a URL", () => {
        const result = stripCredentialsFromUrl("https://user:token@github.com/user/repo.git");
        expect(result).toBe("https://github.com/user/repo.git");
    });

    it("leaves a clean URL unchanged", () => {
        const url = "https://github.com/user/repo.git";
        expect(stripCredentialsFromUrl(url)).toBe(url);
    });

    it("returns the original string for malformed input", () => {
        const bad = "not-a-url";
        expect(stripCredentialsFromUrl(bad)).toBe(bad);
    });

    it("round-trips with buildAuthUrl", () => {
        const original = "https://github.com/user/repo.git";
        const withCreds = buildAuthUrl(original, "myuser", "mytoken");
        expect(stripCredentialsFromUrl(withCreds)).toBe(original);
    });
});