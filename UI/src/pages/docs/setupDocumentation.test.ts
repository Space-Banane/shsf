import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryUrl = "https://gitea.reversed.dev/shsf/shsf.git";
const environmentTemplate = "example.env";

describe("setup documentation", () => {
	it("uses the shipped environment template and canonical repository URL", () => {
		const repositoryRoot = resolve(process.cwd(), "..");
		const readme = readFileSync(resolve(repositoryRoot, "README.md"), "utf8");
		const gettingStartedGuide = readFileSync(resolve(__dirname, "getting-started.tsx"), "utf8");

		expect(existsSync(resolve(repositoryRoot, environmentTemplate))).toBe(true);
		expect(readme).toContain("git clone " + repositoryUrl);
		expect(readme).toContain("cp " + environmentTemplate + " .env");
		expect(readme).toContain("cp " + environmentTemplate + " Backend/.env");
		expect(gettingStartedGuide).toContain("git clone " + repositoryUrl);
		expect(gettingStartedGuide).toContain("cp " + environmentTemplate + " .env");
	});

	it("documents the bundled database profile and portable sed in both places", () => {
		const repositoryRoot = resolve(process.cwd(), "..");
		const readme = readFileSync(resolve(repositoryRoot, "README.md"), "utf8");
		const gettingStartedGuide = readFileSync(resolve(__dirname, "getting-started.tsx"), "utf8");

		for (const doc of [readme, gettingStartedGuide]) {
			expect(doc).toContain("docker compose --profile db up -d");
			expect(doc).toMatch(/v2\.20 or newer/);
			expect(doc).not.toMatch(/sed -i\s+["']/);
		}
	});
});
