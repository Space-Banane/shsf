import type { FunctionFile } from "@prisma/client";
import * as fs from "fs/promises";
import * as path from "path";
import { DB_FIELD_LIMIT, HTML_FILE_EXTENSION } from "./RunnerTypes";

export function truncateDbField(value: string): string {
	return value.length > DB_FIELD_LIMIT
		? value.substring(0, DB_FIELD_LIMIT) + "...[truncated for DB]"
		: value;
}

export function appendLogOutput(existing: string, next: string): string {
	if (!next.trim()) {
		return existing;
	}

	if (!existing.trim()) {
		return next.trim();
	}

	return `${existing.trimEnd()}\n${next.trim()}`;
}

export function isDotnetImage(image: string): boolean {
	return image.startsWith("mcr.microsoft.com/dotnet/sdk:");
}

export function getRuntimeType(image: string): "python" | "golang" | "dotnet" | string {
	if (isDotnetImage(image)) {
		return "dotnet";
	}

	return image.split(":")[0];
}

export function isHtmlStartupFile(startupFile: string | null | undefined): boolean {
	return (startupFile || "").toLowerCase().endsWith(HTML_FILE_EXTENSION);
}

export function parseExecutionPayloadRoute(payload: string): string | null {
	try {
		const parsedPayload = JSON.parse(payload) as { route?: unknown };
		return typeof parsedPayload?.route === "string" ? parsedPayload.route : null;
	} catch {
		return null;
	}
}

export function resolveServeOnlyHtmlFileName(
	startupFile: string,
	payloadRoute: string | null,
): string | null {
	if (!payloadRoute) {
		return startupFile;
	}

	let normalizedRoute = payloadRoute.trim();
	if (
		!normalizedRoute ||
		normalizedRoute === "default" ||
		normalizedRoute === "/"
	) {
		return startupFile;
	}

	normalizedRoute = normalizedRoute.split("?")[0] ?? normalizedRoute;
	normalizedRoute = normalizedRoute.split("#")[0] ?? normalizedRoute;
	try {
		normalizedRoute = decodeURIComponent(normalizedRoute);
	} catch {
		// keep original route when decoding fails
	}

	normalizedRoute = normalizedRoute.replace(/^\/+/, "");
	if (!normalizedRoute) {
		return startupFile;
	}

	if (normalizedRoute.includes("..") || normalizedRoute.includes("\\")) {
		return null;
	}

	if (!normalizedRoute.toLowerCase().endsWith(HTML_FILE_EXTENSION)) {
		normalizedRoute = `${normalizedRoute}${HTML_FILE_EXTENSION}`;
	}

	return normalizedRoute;
}

export function findFileByNameIgnoreCase(
	files: FunctionFile[],
	fileName: string,
): FunctionFile | undefined {
	const normalizedFileName = fileName.toLowerCase();
	return (
		files.find((file) => file.name === fileName) ??
		files.find((file) => file.name.toLowerCase() === normalizedFileName)
	);
}

export async function findFilesByExtension(
	rootDir: string,
	extension: string,
): Promise<string[]> {
	const matches: string[] = [];
	const entries = await fs.readdir(rootDir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(rootDir, entry.name);

		if (entry.isDirectory()) {
			if (entry.name === ".git") {
				continue;
			}
			matches.push(...(await findFilesByExtension(fullPath, extension)));
			continue;
		}

		if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) {
			matches.push(fullPath);
		}
	}

	return matches;
}
