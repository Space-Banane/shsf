import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { PUBLIC_BASE_URL } from "../..";
import type { XFunction } from "../../types/Prisma";
import { copyTextToClipboard } from "../../utils/clipboard";
import { ActionButton } from "../buttons/ActionButton";

const NO_HTTP_ACCESS_LABEL = "No HTTP Access 🚫";

function getFunctionUrl(
	functionData: Pick<XFunction, "allow_http" | "namespaceId" | "executionId">,
) {
	return functionData.allow_http
		? `${PUBLIC_BASE_URL}/api/exec/${functionData.namespaceId}/${functionData.executionId}`
		: NO_HTTP_ACCESS_LABEL;
}

function getAliasUrl(functionUrl: string, alias: string) {
	return functionUrl.split("/api/")[0] + "/exec/" + alias;
}

function UrlRow({
	value,
	inputLabel,
	idleLabel,
	copiedLabel,
	resetLabel,
	failureMessage,
}: {
	value: string;
	inputLabel: string;
	idleLabel: string;
	copiedLabel: string;
	resetLabel: string;
	failureMessage: string;
}) {
	const [label, setLabel] = useState(idleLabel);
	const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (resetTimer.current) clearTimeout(resetTimer.current);
		},
		[],
	);

	const copy = async () => {
		try {
			await copyTextToClipboard(value);
			setLabel(copiedLabel);
			resetTimer.current = setTimeout(() => setLabel(resetLabel), 2000);
		} catch {
			toast.error(failureMessage);
		}
	};

	return (
		<>
			<div className="bg-background/30 border border-primary/10 rounded-lg p-2">
				<input
					type="text"
					value={value}
					readOnly
					aria-label={inputLabel}
					className="w-full bg-transparent text-text text-xs outline-none"
					onClick={(e) => e.currentTarget.select()}
				/>
			</div>
			<ActionButton icon="📋" label={label} variant="primary" onClick={copy} />
		</>
	);
}

export function FunctionUrlCard({ functionData }: { functionData: XFunction }) {
	const functionUrl = getFunctionUrl(functionData);

	return (
		<div className="bg-surface border border-white/[0.07] rounded-xl p-4">
			<h2 className="text-lg font-bold text-primary mb-3 flex items-center gap-2">
				<span>🌐</span>
				URL
			</h2>
			<div className="space-y-2">
				<UrlRow
					value={functionUrl}
					inputLabel="Function URL"
					idleLabel="Copy URL to Clipboard"
					copiedLabel="✅ Copied!"
					resetLabel="Copy📎"
					failureMessage="The URL could not be copied. Select it and copy it manually."
				/>
			</div>
			{functionData.executionAlias && functionData.allow_http && (
				<div className="space-y-2">
					<h2 className="text-sm font-medium text-primary mt-4">Alias URL</h2>
					<UrlRow
						value={getAliasUrl(functionUrl, functionData.executionAlias)}
						inputLabel="Alias URL"
						idleLabel="Copy Alias URL"
						copiedLabel="✅ Copied Alias!"
						resetLabel="Copy Alias📎"
						failureMessage="The alias URL could not be copied. Select it and copy it manually."
					/>
				</div>
			)}
		</div>
	);
}
