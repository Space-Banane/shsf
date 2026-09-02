import path from "path";

/**
 * File-manager paths are stored with POSIX separators, regardless of the host
 * platform. Keeping this validation in one place prevents a filename from
 * escaping the function application directory when it is mirrored to disk.
 */
export function isValidFunctionFilePath(value: string): boolean {
	if (
		!value ||
		value.length > 256 ||
		value.includes("\0") ||
		value.includes("\\") ||
		path.posix.isAbsolute(value)
	) {
		return false;
	}

	const segments = value.split("/");
	return segments.every(
		(segment) => segment.length > 0 && segment !== "." && segment !== "..",
	);
}

export function getParentFolderPaths(filePath: string): string[] {
	const segments = filePath.split("/");
	return segments
		.slice(0, -1)
		.map((_, index) => segments.slice(0, index + 1).join("/"));
}

export function getFunctionFilePath(
	appDir: string,
	relativePath: string,
): string {
	if (!isValidFunctionFilePath(relativePath)) {
		throw new Error("Invalid function file path");
	}

	const resolvedAppDir = path.resolve(appDir);
	const resolvedFile = path.resolve(resolvedAppDir, relativePath);
	if (!resolvedFile.startsWith(`${resolvedAppDir}${path.sep}`)) {
		throw new Error("Function file path escapes application directory");
	}
	return resolvedFile;
}
