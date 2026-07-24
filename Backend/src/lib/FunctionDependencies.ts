export type FunctionRuntime = "python" | "golang" | "node" | "unsupported";

export function getFunctionRuntime(image: string): FunctionRuntime {
	if (image.startsWith("python")) return "python";
	if (image.startsWith("golang")) return "golang";
	if (image.startsWith("node:")) return "node";
	return "unsupported";
}
export function isDependencyFilename(filename: string): boolean {
	const normalized = filename.trim().replaceAll("\\", "/").toLowerCase();
	const basename = normalized.split("/").pop() ?? normalized;

	return (
		basename === "requirements.txt" ||
		basename === "go.mod" ||
		basename === "go.sum" ||
		basename === "package.json" ||
		basename === "package-lock.json"
	);
}
