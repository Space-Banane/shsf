import DependencyModal from "../modals/functionDetail/DependencyModal";
import HtmlResultModal from "../modals/functionDetail/HtmlResultModal";
import ImageResultModal from "../modals/functionDetail/ImageResultModal";
import ResultModal from "../modals/functionDetail/ResultModal";
import type { DependencyInstallResult } from "../../hooks/useDependencyInstall";
import type {
	PopupResult,
	ValueResultContent,
} from "../../types/FunctionExecution";

interface FunctionResultModalsProps {
	popup: PopupResult | null;
	onClosePopup: () => void;
	valueResult: ValueResultContent | null;
	onCloseValueResult: () => void;
	cacheEnabled: boolean;
	dependencyResult: DependencyInstallResult | null;
	dependencyResultOpen: boolean;
	onCloseDependencyResult: () => void;
}

/** Modals that report the outcome of running or installing a function. */
export function FunctionResultModals({
	popup,
	onClosePopup,
	valueResult,
	onCloseValueResult,
	cacheEnabled,
	dependencyResult,
	dependencyResultOpen,
	onCloseDependencyResult,
}: FunctionResultModalsProps) {
	return (
		<>
			<DependencyModal
				isOpen={dependencyResultOpen}
				onClose={onCloseDependencyResult}
				content={
					dependencyResult ?? { success: false, title: "", message: "" }
				}
			/>
			<ResultModal
				isOpen={valueResult !== null}
				onClose={onCloseValueResult}
				content={valueResult ?? { title: "", value: "", type: "" }}
				cacheEnabled={cacheEnabled}
			/>
			<HtmlResultModal
				isOpen={popup?.kind === "html"}
				onClose={onClosePopup}
				content={
					popup?.kind === "html"
						? popup
						: { code: 0, headers: {}, html: "" }
				}
			/>
			<ImageResultModal
				isOpen={popup?.kind === "image"}
				onClose={onClosePopup}
				content={
					popup?.kind === "image"
						? popup
						: { code: 0, contentType: "", headers: {}, src: "" }
				}
			/>
		</>
	);
}
