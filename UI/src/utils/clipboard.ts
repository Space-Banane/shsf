export async function copyTextToClipboard(text: string): Promise<void> {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return;
		} catch {
			// Insecure origins can expose the API but reject writes.
		}
	}

	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.readOnly = true;
	textarea.style.position = "fixed";
	textarea.style.opacity = "0";
	document.body.appendChild(textarea);
	textarea.select();

	try {
		if (!document.execCommand?.("copy")) {
			throw new Error("Copying to the clipboard is not supported in this browser.");
		}
	} finally {
		textarea.remove();
	}
}
