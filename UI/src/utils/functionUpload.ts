import { toast } from "react-toastify";
import {
	extractZipFiles,
	isHtmlFilename,
	isZipFilename,
	type ExtractedFile,
} from "./functionFiles";

export interface UploadOutcome {
	created: string[];
	skippedExisting: string[];
	skippedInvalidType: string[];
	skippedZipEntries: string[];
	skippedZipFiles: string[];
}

export type PersistFile = (
	filename: string,
	content: string,
) => Promise<
	{ success: true; name: string } | { success: false; message: string }
>;

/**
 * Reads dropped files (unpacking zip archives when allowed) and persists the
 * ones that are new and valid for this function. Per-file problems are reported
 * through toasts as they happen; the returned outcome feeds the summary toasts.
 */
export async function importDroppedFiles({
	droppedFiles,
	unzipArchives,
	existingNames,
	htmlOnly,
	persistFile,
}: {
	droppedFiles: File[];
	unzipArchives: boolean;
	existingNames: Set<string>;
	htmlOnly: boolean;
	persistFile: PersistFile;
}): Promise<UploadOutcome> {
	const known = new Set(existingNames);
	const outcome: UploadOutcome = {
		created: [],
		skippedExisting: [],
		skippedInvalidType: [],
		skippedZipEntries: [],
		skippedZipFiles: [],
	};

	for (const droppedFile of droppedFiles) {
		try {
			let entries: ExtractedFile[];
			if (isZipFilename(droppedFile.name) && unzipArchives) {
				const { extracted, skippedEntries } =
					await extractZipFiles(droppedFile);
				entries = extracted;
				outcome.skippedZipEntries.push(...skippedEntries);
				if (entries.length === 0) {
					toast.error(
						`${droppedFile.name} did not contain any files to upload.`,
					);
					continue;
				}
			} else if (isZipFilename(droppedFile.name)) {
				outcome.skippedZipFiles.push(droppedFile.name);
				continue;
			} else {
				entries = [
					{ name: droppedFile.name, content: await droppedFile.text() },
				];
			}

			for (const entry of entries) {
				if (htmlOnly && !isHtmlFilename(entry.name)) {
					outcome.skippedInvalidType.push(entry.name);
					continue;
				}
				if (known.has(entry.name)) {
					outcome.skippedExisting.push(entry.name);
					continue;
				}

				const result = await persistFile(entry.name, entry.content);
				if (result.success) {
					known.add(entry.name);
					outcome.created.push(entry.name);
				} else {
					toast.error(`Failed to create ${entry.name}: ${result.message}`);
				}
			}
		} catch {
			toast.error(
				isZipFilename(droppedFile.name)
					? `Failed to unpack ${droppedFile.name}. Make sure it is a valid zip archive.`
					: `Failed to read ${droppedFile.name}.`,
			);
		}
	}

	return outcome;
}

const summarize = (names: string[], single: string, many: string) =>
	names.length === 1 ? single : many;

export function notifyUploadOutcome(outcome: UploadOutcome) {
	const { created, skippedExisting, skippedInvalidType } = outcome;
	const { skippedZipEntries, skippedZipFiles } = outcome;

	if (created.length > 0) {
		toast.success(
			summarize(
				created,
				`Created ${created[0]}`,
				`Created ${created.length} files`,
			),
		);
	}
	if (skippedExisting.length > 0) {
		toast.error(
			summarize(
				skippedExisting,
				`${skippedExisting[0]} already exists.`,
				`${skippedExisting.length} files were skipped because they already exist.`,
			),
		);
	}
	if (skippedInvalidType.length > 0) {
		toast.error(
			summarize(
				skippedInvalidType,
				`${skippedInvalidType[0]} was skipped because only .html files are allowed.`,
				`${skippedInvalidType.length} files were skipped because only .html files are allowed.`,
			),
		);
	}
	if (skippedZipEntries.length > 0) {
		toast.error(
			summarize(
				skippedZipEntries,
				`${skippedZipEntries[0]} was skipped because it is not a valid zip path.`,
				`${skippedZipEntries.length} zip entries were skipped because they are not valid paths.`,
			),
		);
	}
	if (skippedZipFiles.length > 0) {
		toast.error(
			summarize(
				skippedZipFiles,
				`${skippedZipFiles[0]} was skipped because Auto Unzip Files is off.`,
				`${skippedZipFiles.length} zip files were skipped because Auto Unzip Files is off.`,
			),
		);
	}
}
