import path from "path";

const LINUX_DATA_ROOT = "/opt/shsf_data";
const WINDOWS_DATA_ROOT = path.resolve(__dirname, "../../shsf_data");

export function getShsfDataRoot(): string {
	return process.platform === "win32" ? WINDOWS_DATA_ROOT : LINUX_DATA_ROOT;
}

export function getFunctionBaseDir(functionId: number | string): string {
	return path.join(getShsfDataRoot(), "functions", String(functionId));
}

export function getFunctionAppDir(functionId: number | string): string {
	return path.join(getFunctionBaseDir(functionId), "app");
}

export function getFunctionExecutionsDir(functionId: number | string): string {
	return path.join(getFunctionBaseDir(functionId), "executions");
}

export function getFunctionExecutionDir(
	functionId: number | string,
	executionId: string,
): string {
	return path.join(getFunctionExecutionsDir(functionId), executionId);
}

export function getGitRepoDir(functionId: number | string): string {
	return path.join(getFunctionBaseDir(functionId), "git_repo");
}

export function getCacheDir(...parts: string[]): string {
	return path.join(getShsfDataRoot(), "cache", ...parts);
}
