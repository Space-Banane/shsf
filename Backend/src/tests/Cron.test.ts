import { describe, it, expect, vi } from "vitest";
import { validateCronExpression } from "../lib/Cron";
import { processGitPulls } from "../lib/SystemCrons";

describe("validateCronExpression", () => {
    it("returns true for a valid cron expression", async () => {
        const result = await validateCronExpression("0 0 * * *");
        expect(result).toBe(true);
    });

    it("returns false for an invalid cron expression", async () => {
        const result = await validateCronExpression("invalid-cron");
        expect(result).toBe(false);
    });
});

describe("processGitPulls", () => {
	it("passes configured git source directories to scheduled pulls", async () => {
		const performGitPull = vi.fn().mockResolvedValue({ success: true, logs: "" });
		const prisma = {
			function: {
				findMany: vi.fn().mockResolvedValue([
					{
						id: 910001,
						name: "source-dir-fn",
						git_pull_interval: 10,
						git_source_dir: "functions/api",
					},
				]),
			},
		};

		const dependencies: Parameters<typeof processGitPulls>[0] = {
			prisma: prisma as unknown as Parameters<typeof processGitPulls>[0]["prisma"],
			executeFunction: vi.fn() as unknown as Parameters<typeof processGitPulls>[0]["executeFunction"],
			performGitPull: performGitPull as unknown as Parameters<typeof processGitPulls>[0]["performGitPull"],
		};

		await processGitPulls(dependencies);

		expect(performGitPull).toHaveBeenCalledWith(910001, "functions/api");
	});
});
