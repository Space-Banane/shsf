import { PrismaClient } from "@prisma/client";


export async function getGitEditBlock(
	functionId: number,
	prisma: PrismaClient,
): Promise<{ status: number; message: string, cli_file_fail: string } | null> {
	const functionData = await prisma.function.findUnique({
		where: { id: functionId },
		select: { git_url: true },
	});

	if (!functionData) {
		return { status: 404, message: "Function not found", cli_file_fail: "function_not_found" };
	}

	const gitUrl = functionData.git_url?.trim();
	if (gitUrl) {
		return {
			status: 400,
			message:
				"File edits are disabled while git is configured for this function. Remove git configuration to edit files.",
			cli_file_fail: "git_configured"
		};
	}

	return null;
}
