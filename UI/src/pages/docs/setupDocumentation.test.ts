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
		expect(readme).toContain("cp ../" + environmentTemplate + " .env");
		expect(gettingStartedGuide).toContain("git clone " + repositoryUrl);
		expect(gettingStartedGuide).toContain("cp " + environmentTemplate + " .env");
	});
});
