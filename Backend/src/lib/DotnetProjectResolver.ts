import * as fs from "fs/promises";
import * as path from "path";
import { findFilesByExtension } from "./RunnerUtils";

export class DotnetProjectResolutionError extends Error {}

export interface DotnetProjectCandidate {
	absolutePath: string;
	relativePath: string;
	depth: number;
	inSolution: boolean;
	isRunnable: boolean;
	isTestProject: boolean;
}

function normalizeDotnetProjectPath(projectPath: string): string {
	return path.normalize(projectPath.replace(/\\/g, path.sep));
}

async function readSolutionProjectPaths(
	funcAppDir: string,
	slnFiles: string[],
): Promise<Set<string>> {
	const projectPaths = new Set<string>();

	for (const slnFile of slnFiles) {
		const content = await fs.readFile(slnFile, "utf8");
		const projectMatches = content.matchAll(
			/Project\([^)]*\)\s*=\s*"[^"]+",\s*"([^"]+\.csproj)"/gi,
		);

		for (const match of projectMatches) {
			const rawProjectPath = match[1];
			if (!rawProjectPath) {
				continue;
			}

			const absolutePath = path.resolve(
				path.dirname(slnFile),
				normalizeDotnetProjectPath(rawProjectPath),
			);
			projectPaths.add(path.relative(funcAppDir, absolutePath));
		}
	}

	return projectPaths;
}

async function readDotnetProjectCandidate(
	funcAppDir: string,
	csprojPath: string,
	solutionProjectPaths: Set<string>,
): Promise<DotnetProjectCandidate> {
	const relativePath = path.relative(funcAppDir, csprojPath);
	const content = await fs.readFile(csprojPath, "utf8");
	const outputTypeMatch = content.match(
		/<OutputType>\s*([^<\s]+)\s*<\/OutputType>/i,
	);
	const sdkMatch = content.match(/<Project[^>]*\bSdk="([^"]+)"/i);
	const outputType = outputTypeMatch?.[1]?.trim().toLowerCase() ?? "";
	const projectSdk = sdkMatch?.[1]?.trim().toLowerCase() ?? "";
	const isTestProject =
		/<IsTestProject>\s*true\s*<\/IsTestProject>/i.test(content) ||
		/Microsoft\.NET\.Test\.Sdk/i.test(content);
	const isRunnable =
		outputType === "exe" ||
		outputType === "winexe" ||
		projectSdk.includes("microsoft.net.sdk.web");

	return {
		absolutePath: csprojPath,
		relativePath,
		depth: relativePath.split(path.sep).length,
		inSolution: solutionProjectPaths.has(relativePath),
		isRunnable,
		isTestProject,
	};
}

function selectSingleDotnetProjectCandidate(
	candidates: DotnetProjectCandidate[],
	errorMessage: string,
): DotnetProjectCandidate | null {
	if (candidates.length === 0) {
		return null;
	}

	if (candidates.length === 1) {
		return candidates[0];
	}

	const candidateList = candidates
		.map((candidate) => candidate.relativePath)
		.sort((left, right) => left.localeCompare(right))
		.join(", ");
	throw new DotnetProjectResolutionError(`${errorMessage} Candidates: ${candidateList}`);
}

export async function resolveDotnetProjectPath(funcAppDir: string): Promise<string> {
	const csprojFiles = await findFilesByExtension(funcAppDir, ".csproj");
	const slnFiles = await findFilesByExtension(funcAppDir, ".sln");

	if (csprojFiles.length === 0) {
		if (slnFiles.length > 0) {
			throw new DotnetProjectResolutionError(
				"Found a .sln file but no .csproj file. Add at least one runnable .csproj to execute this .NET function.",
			);
		}

		throw new DotnetProjectResolutionError(
			"No .csproj file found. Add a runnable .NET project before executing this function.",
		);
	}

	const solutionProjectPaths =
		slnFiles.length > 0
			? await readSolutionProjectPaths(funcAppDir, slnFiles)
			: new Set<string>();
	const candidates = await Promise.all(
		csprojFiles.map((csprojPath) =>
			readDotnetProjectCandidate(funcAppDir, csprojPath, solutionProjectPaths),
		),
	);

	const solutionRunnableCandidate = selectSingleDotnetProjectCandidate(
		candidates.filter(
			(candidate) => candidate.inSolution && candidate.isRunnable && !candidate.isTestProject,
		),
		"Multiple runnable .csproj files were found in the solution. Keep one runnable entry project in the solution or remove the ambiguity.",
	);
	if (solutionRunnableCandidate) {
		return solutionRunnableCandidate.relativePath;
	}

	const runnableCandidate = selectSingleDotnetProjectCandidate(
		candidates.filter((candidate) => candidate.isRunnable && !candidate.isTestProject),
		"Multiple runnable .csproj files were found. Keep one runnable entry project or configure the repository so only one executable project is detected.",
	);
	if (runnableCandidate) {
		return runnableCandidate.relativePath;
	}

	const solutionNonTestCandidate = selectSingleDotnetProjectCandidate(
		candidates.filter((candidate) => candidate.inSolution && !candidate.isTestProject),
		"Multiple non-test .csproj files were found in the solution, but none was clearly runnable. Mark the startup project as executable or remove the ambiguity.",
	);
	if (solutionNonTestCandidate) {
		return solutionNonTestCandidate.relativePath;
	}

	const nonTestCandidates = candidates.filter((candidate) => !candidate.isTestProject);
	if (nonTestCandidates.length === 1) {
		return nonTestCandidates[0].relativePath;
	}

	if (nonTestCandidates.length > 1) {
		throw new DotnetProjectResolutionError(
			"No runnable .csproj could be identified automatically. Mark one project as executable with <OutputType>Exe</OutputType> or use Microsoft.NET.Sdk.Web, and keep test/support projects non-runnable.",
		);
	}

	throw new DotnetProjectResolutionError(
		"Only test projects were found. Add or include one runnable .csproj for this .NET function.",
	);
}

export function getDotnetProjectDirectory(
	funcAppDir: string,
	dotnetProjectPath: string,
): string {
	return path.join(funcAppDir, path.dirname(dotnetProjectPath));
}
