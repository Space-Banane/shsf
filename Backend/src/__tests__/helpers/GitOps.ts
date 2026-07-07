import fs from "fs/promises";
import path from "path";
import { afterEach, describe, it, expect } from "vitest";
import {
	buildAuthUrl,
	listGitAppFiles,
	removeGitMetadata,
	stripCredentialsFromUrl,
} from "../../lib/GitOps";
import { getFunctionBaseDir, getFunctionAppDir } from "../../lib/StoragePaths";

const testFunctionIds = new Set<number>();

afterEach(async () => {
	await Promise.all(
		Array.from(testFunctionIds).map((id) =>
			fs.rm(getFunctionBaseDir(id), { recursive: true, force: true }),
		),
	);
	testFunctionIds.clear();
});

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

describe("git app file helpers", () => {
	it("lists files from the app directory without exposing .git contents", async () => {
		const functionId = 900001;
		testFunctionIds.add(functionId);
		const appDir = getFunctionAppDir(functionId);
		await fs.mkdir(path.join(appDir, ".git"), { recursive: true });
		await fs.mkdir(path.join(appDir, "src"), { recursive: true });
		await fs.writeFile(path.join(appDir, "main.py"), "print('hi')");
		await fs.writeFile(path.join(appDir, "src", "helper.py"), "value = 1");
		await fs.writeFile(path.join(appDir, ".git", "config"), "secret");

		const files = await listGitAppFiles(functionId);

		expect(files.map((file) => file.name).sort()).toEqual([
			"main.py",
			"src/helper.py",
		]);
		expect(files.find((file) => file.name === "main.py")?.content).toBe("print('hi')");
		expect(files.some((file) => file.name.includes(".git"))).toBe(false);
	});

	it("removes git metadata while leaving app files in place", async () => {
		const functionId = 900002;
		testFunctionIds.add(functionId);
		const appDir = getFunctionAppDir(functionId);
		await fs.mkdir(path.join(appDir, ".git"), { recursive: true });
		await fs.writeFile(path.join(appDir, "main.py"), "print('kept')");
		await fs.writeFile(path.join(appDir, ".git", "config"), "url = https://token@example.com/repo.git");

		await removeGitMetadata(appDir);

		await expect(fs.stat(path.join(appDir, "main.py"))).resolves.toBeTruthy();
		await expect(fs.stat(path.join(appDir, ".git"))).rejects.toMatchObject({
			code: "ENOENT",
		});
	});
});
