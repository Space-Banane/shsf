import JSZip from "jszip";
import type { XFunction } from "../types/Prisma";

const EXTENSION_LANGUAGES: Record<string, string> = {
	".py": "python",
	".js": "javascript",
	".ts": "typescript",
	".json": "json",
	".html": "html",
	".css": "css",
	".md": "markdown",
	".go": "go",
	".mod": "go",
	".props": "xml",
	".targets": "xml",
	".rs": "rust",
	".lua": "lua",
};

const NAME_LANGUAGES: Record<string, string> = {
	Dockerfile: "dockerfile",
	Makefile: "makefile",
};

export const getDefaultLanguage = (filename: string): string => {
	if (NAME_LANGUAGES[filename]) return NAME_LANGUAGES[filename];
	const extension = Object.keys(EXTENSION_LANGUAGES).find((ext) =>
		filename.endsWith(ext),
	);
	return extension ? EXTENSION_LANGUAGES[extension] : "plaintext";
};

export const isHtmlFilename = (filename: string) =>
	filename.toLowerCase().endsWith(".html");

export const isZipFilename = (filename: string) =>
	filename.toLowerCase().endsWith(".zip");

/** True when the function only serves a single .html file. */
export const isHtmlOnlyFunction = (
	functionData: Pick<XFunction, "startup_file"> | null,
) => isHtmlFilename(functionData?.startup_file || "");

export const buildCliPullCommand = (
	functionData: Pick<XFunction, "id" | "name">,
) => {
	const folder =
		functionData.name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "my-func";
	return `shsf remote pull --id ${functionData.id} --into ./${folder} --force`;
};

/** Normalizes a zip entry path, rejecting absolute or traversing paths. */
export const normalizeZipEntryName = (entryName: string) => {
	const normalized = entryName.replace(/\\/g, "/").trim().replace(/^\/+/, "");
	if (
		!normalized ||
		normalized.startsWith("/") ||
		/^[a-zA-Z]:/.test(normalized)
	) {
		return null;
	}

	const segments = normalized
		.split("/")
		.filter((segment) => segment.length > 0 && segment !== ".");
	if (segments.length === 0 || segments.some((segment) => segment === "..")) {
		return null;
	}

	return segments.join("/");
};

export interface ExtractedFile {
	name: string;
	content: string;
}

export const extractZipFiles = async (zipFile: File) => {
	const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
	const extracted: ExtractedFile[] = [];
	const skippedEntries: string[] = [];

	const entryReads: Array<Promise<void>> = [];
	zip.forEach((relativePath, entry) => {
		if (entry.dir) return;

		entryReads.push(
			(async () => {
				const normalizedName = normalizeZipEntryName(relativePath);
				if (!normalizedName) {
					skippedEntries.push(relativePath);
					return;
				}
				const content = await entry.async("string");
				extracted.push({ name: normalizedName, content });
			})(),
		);
	});

	await Promise.all(entryReads);
	return { extracted, skippedEntries };
};

export const downloadBlob = (blob: Blob, filename: string) => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
};

export const downloadTextFile = (filename: string, content: string) =>
	downloadBlob(
		new Blob([content], { type: "text/plain;charset=utf-8" }),
		filename,
	);
