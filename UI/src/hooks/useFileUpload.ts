import { useCallback, useState } from "react";
import type { FunctionFile } from "../types/Prisma";
import {
	importDroppedFiles,
	notifyUploadOutcome,
	type PersistFile,
} from "../utils/functionUpload";

/** Handles files dropped onto the file manager, including optional zip unpacking. */
export function useFileUpload({
	files,
	htmlOnly,
	persistFile,
}: {
	files: FunctionFile[];
	htmlOnly: boolean;
	persistFile: PersistFile;
}) {
	const [autoUnzipFiles, setAutoUnzipFiles] = useState(true);

	const dropFiles = useCallback(
		async (droppedFiles: File[], options?: { unzipArchives?: boolean }) => {
			const outcome = await importDroppedFiles({
				droppedFiles,
				unzipArchives: options?.unzipArchives ?? autoUnzipFiles,
				existingNames: new Set(files.map((file) => file.name)),
				htmlOnly,
				persistFile,
			});
			notifyUploadOutcome(outcome);
		},
		[autoUnzipFiles, files, htmlOnly, persistFile],
	);

	return { autoUnzipFiles, setAutoUnzipFiles, dropFiles };
}
