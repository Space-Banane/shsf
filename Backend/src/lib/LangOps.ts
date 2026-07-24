/**
 * Returns the default startup filename for a given runtime image.
 * Used as a fallback when AI generation does not return a startup file.
 */
export function getDefaultStartupFile(image: string): string {
	if (image.startsWith("python")) return "main.py";
	if (image.startsWith("golang")) return "main_user.go";
	if (image.startsWith("node:")) return "index.js";
	return "";
}

/**
 * Returns the content of the first file for a supported programming language.
 */
export async function getFirstFileByLanguage(
	language: string,
	filename?: string,
): Promise<string | null> {
	const languageMap: Record<string, string> = {
		python: ["def main(args):", "    return 'Hello, World!'"].join("\n"),
		go: [
			"package main",
			"",
			'import "fmt"',
			"",
			"func main() {",
			'    fmt.Println("Hello, World!")',
			"}",
		].join("\n"),
		javascript: [
			"async function main(args) {",
			"    return { hello: 'from Node.js' };",
			"}",
			"",
			"module.exports = { main };",
		].join("\n"),
		html: [
			"<!DOCTYPE html>",
			'<html lang="en">',
			"<head>",
			'    <meta charset="UTF-8">',
			'    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
			"    <title>Hello World</title>",
			"</head>",
			"<body>",
			"    <h1>Hello, World!</h1>",
			"</body>",
			"</html>",
		].join("\n"),
	};

	const extensionLanguageMap: Record<string, string> = {
		py: "python",
		go: "go",
		js: "javascript",
		mjs: "javascript",
		cjs: "javascript",
		html: "html",
		htm: "html",
	};

	const trimmedFilename = filename?.trim() ?? "";
	const hasExtension = trimmedFilename.includes(".");
	const extension = hasExtension ? trimmedFilename.split(".").pop()?.toLowerCase() : undefined;
	const languageFromExtension = extension ? extensionLanguageMap[extension] : undefined;

	// If a file extension is provided and not recognized, avoid injecting a runtime template.
	if (hasExtension && !languageFromExtension) return null;

	return languageMap[languageFromExtension ?? language] ?? null;
}
