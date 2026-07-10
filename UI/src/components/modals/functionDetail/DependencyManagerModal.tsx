import { useEffect, useMemo, useState } from "react";
import Modal from "../Modal";
import {
	cancelBtnClass,
	inputClass,
	labelClass,
	ModalError,
	ModalFooter,
	primaryBtnClass,
	textareaClass,
} from "../Modal";
import { useShiftEnterSubmit } from "../../../hooks/useShiftEnterSubmit";
import { FunctionFile, isDotnetImage } from "../../../types/Prisma";

interface DependencyManagerModalProps {
	isOpen: boolean;
	onClose: () => void;
	functionId: number;
	image: string;
	files: FunctionFile[];
	onSave: (filename: string, content: string) => Promise<boolean>;
}

type DependencyRuntime = "python" | "golang" | "dotnet";

function getRuntime(image: string): DependencyRuntime | null {
	if (isDotnetImage(image)) return "dotnet";
	if (image.startsWith("python")) return "python";
	if (image.startsWith("golang")) return "golang";
	return null;
}

function getDefaultContent(
	runtime: DependencyRuntime,
	filename: string,
	functionId: number,
	image: string,
): string {
	if (filename === "requirements.txt") {
		return "# Add one Python package per line\n";
	}
	if (filename === "go.mod") {
		return `module shsf_function_${functionId}\n\ngo 1.23\n`;
	}
	if (filename === "go.sum") {
		return "";
	}
	if (runtime === "dotnet" && filename.endsWith(".csproj")) {
		const targetFramework = image.split(":").pop() || "8.0";
		return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net${targetFramework}</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>
`;
	}
	return "";
}

function getManifestDescription(runtime: DependencyRuntime, filename: string): string {
	if (filename === "requirements.txt") {
		return "One Python package or pinned version per line. SHSF installs it during runtime setup.";
	}
	if (filename === "go.mod") {
		return "The Go module definition. SHSF downloads modules and rebuilds the function when it runs.";
	}
	if (filename === "go.sum") {
		return "Go module checksums. It is normally generated and maintained by the Go toolchain.";
	}
	if (runtime === "dotnet") {
		return "The .NET project file. Add NuGet PackageReference entries here, then run .NET Build.";
	}
	return "Runtime dependency manifest.";
}

function DependencyManagerModal({
	isOpen,
	onClose,
	functionId,
	image,
	files,
	onSave,
}: DependencyManagerModalProps) {
	const runtime = getRuntime(image);
	const dependencyFiles = useMemo(() => {
		if (!runtime) return [];

		if (runtime === "python") {
			return ["requirements.txt"];
		}
		if (runtime === "golang") {
			return ["go.mod", "go.sum"];
		}

		const projectFiles = files
			.map((file) => file.name)
			.filter((filename) => filename.toLowerCase().endsWith(".csproj"));
		return projectFiles.length > 0 ? projectFiles : ["project.csproj"];
	}, [files, runtime]);

	const [selectedFilename, setSelectedFilename] = useState("");
	const [draft, setDraft] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	const selectedFile = files.find((file) => file.name === selectedFilename);

	useEffect(() => {
		if (!isOpen || dependencyFiles.length === 0) return;
		setSelectedFilename((current) =>
			dependencyFiles.includes(current) ? current : dependencyFiles[0],
		);
	}, [dependencyFiles, isOpen]);

	useEffect(() => {
		if (!isOpen || !runtime || !selectedFilename) return;
		setDraft(
			selectedFile?.content ??
				getDefaultContent(runtime, selectedFilename, functionId, image),
		);
		setError(null);
		setSaved(false);
	}, [functionId, image, isOpen, runtime, selectedFile, selectedFilename]);

	const handleSave = async () => {
		if (!selectedFilename) return;
		setLoading(true);
		setError(null);
		setSaved(false);
		try {
			if (await onSave(selectedFilename, draft)) {
				setSaved(true);
			} else {
				setError("The dependency file could not be saved.");
			}
		} finally {
			setLoading(false);
		}
	};

	useShiftEnterSubmit(() => handleSave(), isOpen && !loading);

	if (!runtime) return null;

	const runtimeLabel = runtime === "golang" ? "Go" : runtime === "dotnet" ? ".NET" : "Python";

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={`${runtimeLabel} Dependencies`}
			maxWidth="xl"
			isLoading={loading}
		>
			<div className="space-y-5">
				<div>
					<p className="text-sm text-text/80">
						Manage the dependency manifest used by this {runtimeLabel} function.
					</p>
					<p className="mt-1 text-xs text-muted">
						{runtime === "python"
							? "Use requirements.txt for pip packages."
							: runtime === "golang"
								? "Use go.mod for modules; go.sum is kept for checksums."
								: "Use the .csproj file for NuGet PackageReference entries."}
					</p>
				</div>

				<ModalError message={error} />
				{saved && (
					<div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
						{selectedFilename} saved. {runtime === "python" ? "Use Install requirements.txt to apply it now." : runtime === "dotnet" ? "Run .NET Build to apply project changes." : "The next function run will resolve the module changes."}
					</div>
				)}

				<div>
					<label className={labelClass}>Dependency file</label>
					<select
						className={inputClass}
						value={selectedFilename}
						onChange={(event) => setSelectedFilename(event.target.value)}
						disabled={loading}
					>
						{dependencyFiles.map((filename) => (
							<option key={filename} value={filename}>
								{filename}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className={labelClass}>File content</label>
					<textarea
						className={`${textareaClass} min-h-[360px] font-mono text-xs`}
						value={draft}
						onChange={(event) => {
							setDraft(event.target.value);
							setSaved(false);
						}}
						spellCheck={false}
						disabled={loading}
						aria-label={`${selectedFilename} content`}
					/>
					<p className="mt-1.5 text-xs text-muted/70">
						{getManifestDescription(runtime, selectedFilename)}
					</p>
				</div>

				<ModalFooter>
					<button className={cancelBtnClass} onClick={onClose} disabled={loading}>
						Close
					</button>
					<button className={primaryBtnClass} onClick={handleSave} disabled={loading || !selectedFilename}>
						Save Dependencies
					</button>
				</ModalFooter>
			</div>
		</Modal>
	);
}

export default DependencyManagerModal;
