/**
 * Returns the content of the first file for a supported programming language.
 */
export async function getFirstFileByLanguage(
	language: string,
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

	return languageMap[language] ?? null;
}
