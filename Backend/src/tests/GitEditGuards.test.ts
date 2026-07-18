import { describe, it, expect, vi } from "vitest";
import { getGitEditBlock } from "../lib/GitEditGuards";

describe("getGitEditBlock", () => {
	it("blocks edits when git_url is configured", async () => {
		const prisma = {
			function: {
				findUnique: vi.fn().mockResolvedValue({ git_url: "https://example.com/repo.git" }),
			},
		};

		const result = await getGitEditBlock(123, prisma as any);

		expect(result).toEqual({
			status: 400,
			message:
				"File edits are disabled while git is configured for this function. Remove git configuration to edit files.",
			cli_file_fail: "git_configured"
		});
	});

	it("allows edits when git_url is null or empty", async () => {
		const prismaNull = {
			function: {
				findUnique: vi.fn().mockResolvedValue({ git_url: null }),
			},
		};
		const prismaEmpty = {
			function: {
				findUnique: vi.fn().mockResolvedValue({ git_url: "   " }),
			},
		};

		const resultNull = await getGitEditBlock(123, prismaNull as any);
		const resultEmpty = await getGitEditBlock(123, prismaEmpty as any);

		expect(resultNull).toBeNull();
		expect(resultEmpty).toBeNull();
	});

	it("returns 404 when function does not exist", async () => {
		const prisma = {
			function: {
				findUnique: vi.fn().mockResolvedValue(null),
			},
		};

		const result = await getGitEditBlock(123, prisma as any);

		expect(result).toEqual({
			status: 404,
			message: "Function not found",
			cli_file_fail: "function_not_found"
		});
	});
});
