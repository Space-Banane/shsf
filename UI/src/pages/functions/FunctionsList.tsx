import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { UserContext } from "../../App";
import { getNamespaces } from "../../services/backend.namespaces";
import { Namespace, XFunction } from "../../types/Prisma";
import CreateNamespaceModal from "../../components/modals/namespaces/CreateNamespaceModal";
import CreateFunctionModal from "../../components/modals/functions/CreateFunctionModal";
import CloneFunctionModal from "../../components/modals/functions/CloneFunctionModal";
import RenameNamespaceModal from "../../components/modals/namespaces/RenameNamespaceModal";
import DeleteNamespaceModal from "../../components/modals/namespaces/DeleteNamespaceModal";
import DeleteFunctionModal from "../../components/modals/functions/DeleteFunctionModal";
import { deleteFunction } from "../../services/backend.functions";
import ImportFunctionModal from "../../components/modals/functions/ImportFunctionModal";
import MassReplaceModal from "../../components/modals/functionFiles/MassReplaceModal";
import AIGenerateModal from "../../components/modals/AIGenerateModal";
import { Icon } from "../../components/ui/Icon";
import { HelpTooltip } from "../../components/ui/Tooltip";

function FunctionsList() {
	const [namespaces, setNamespaces] = useState<Namespace[]>([]);
	const [loading, setLoading] = useState(true);
	const { user } = useContext(UserContext);
	const aiEnabled = Boolean(user?.apiKeyConfigured);
	const [isNamespaceModalOpen, setNamespaceModalOpen] = useState(false);
	const [isRenameNamespaceModalOpen, setRenameNamespaceModalOpen] = useState(false);
	const [isDeleteNamespaceModalOpen, setDeleteNamespaceModalOpen] = useState(false);
	const [isFunctionModalOpen, setFunctionModalOpen] = useState(false);
	const [isAIModalOpen, setAIModalOpen] = useState(false);
	const [isDeleteFunctionModalOpen, setDeleteFunctionModalOpen] = useState(false);
	const [isCloneFunctionModalOpen, setCloneFunctionModalOpen] = useState(false);
	const [isImportModalOpen, setImportModalOpen] = useState(false);
	const [isMassReplaceModalOpen, setMassReplaceModalOpen] = useState(false);
	const [selectedNamespace, setSelectedNamespace] = useState<{ id: number; name: string } | null>(null);
	const [selectedFunction, setSelectedFunction] = useState<{ id: number; name: string } | null>(null);
	const [selectedFunctionForClone, setSelectedFunctionForClone] = useState<{ id: number; name: string } | null>(null);
	const [expandedNamespaces, setExpandedNamespaces] = useState<number[]>([]);

	useEffect(() => {
		setLoading(true);
		getNamespaces(true).then((data) => {
			if (data.status === "OK") {
				const loaded = data.data as Namespace[];
				setNamespaces(loaded);
				setExpandedNamespaces(loaded.map((ns) => ns.id));
			} else {
				toast.error("Error fetching namespaces: " + data.message);
			}
			setLoading(false);
		});
	}, []);

	const refreshData = () => {
		getNamespaces(true).then((data) => {
			if (data.status === "OK") setNamespaces(data.data as Namespace[]);
		});
	};

	const toggleNamespace = (id: number) => {
		setExpandedNamespaces((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
	};

	const handleDeleteFunction = async (functionId: number) => {
		try {
			const response = await deleteFunction(functionId);
			if (response.status === "OK") {
				refreshData();
				return true;
			}
			toast.error("Error deleting function: " + response.message);
			return false;
		} catch {
			toast.error("An error occurred while deleting the function.");
			return false;
		}
	};

	const totalFunctions = namespaces.reduce((sum, ns) => sum + (ns.functions?.length ?? 0), 0);
	const allExpanded = expandedNamespaces.length === namespaces.length;

	if (loading) {
		return (
			<div className="flex items-center justify-center py-24">
				<div className="text-center space-y-3">
					<div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
					<p className="text-muted text-sm">Loading functions…</p>
				</div>
			</div>
		);
	}

	return (
		<div>
			{/* Page header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
				<div>
					<h1 className="text-2xl font-semibold text-text">Functions</h1>
					<p className="text-sm text-muted mt-0.5">
						{namespaces.length} namespace{namespaces.length !== 1 ? "s" : ""} · {totalFunctions} function{totalFunctions !== 1 ? "s" : ""}
					</p>
				</div>

				{/* Action toolbar */}
				<div className="flex flex-wrap items-center gap-2">
					<Btn
						icon="folder"
						label="New Namespace"
						variant="secondary"
						onClick={() => setNamespaceModalOpen(true)}
					/>
					<Btn
						icon="plus"
						label="New Function"
						variant="primary"
						onClick={() => setFunctionModalOpen(true)}
					/>
					<div className="flex items-center gap-1.5">
						<Btn
							icon="sparkles"
							label="AI Kickoff"
							variant="secondary"
							disabled={!aiEnabled}
							onClick={() => setAIModalOpen(true)}
						/>
						{!aiEnabled && (
							<HelpTooltip
								content="Configure an OpenRouter API key in Account → AI Settings to enable AI-powered function generation."
								placement="bottom"
							/>
						)}
					</div>
					<Btn
						icon="arrow-down-tray"
						label="Import"
						variant="secondary"
						onClick={() => setImportModalOpen(true)}
					/>
					<Btn
						icon="magnifying-glass"
						label="Find & Replace"
						variant="secondary"
						onClick={() => setMassReplaceModalOpen(true)}
					/>
					<button
						onClick={() =>
							allExpanded
								? setExpandedNamespaces([])
								: setExpandedNamespaces(namespaces.map((ns) => ns.id))
						}
						className="p-2 text-muted hover:text-text hover:bg-surface rounded-lg border border-transparent hover:border-white/[0.07] transition-colors"
						title={allExpanded ? "Collapse all" : "Expand all"}
					>
						<Icon name={allExpanded ? "folder" : "folder-open"} className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* Namespace list */}
			{namespaces.length === 0 ? (
				<EmptyState
					onCreateNamespace={() => setNamespaceModalOpen(true)}
					onCreateFunction={() => setFunctionModalOpen(true)}
				/>
			) : (
				<div className="space-y-3">
					{namespaces
						.slice()
						.sort((a, b) => a.name.localeCompare(b.name))
						.map((namespace) => (
							<NamespaceCard
								key={namespace.id}
								namespace={namespace}
								isExpanded={expandedNamespaces.includes(namespace.id)}
								onToggle={() => toggleNamespace(namespace.id)}
								onRename={(ns) => { setSelectedNamespace(ns); setRenameNamespaceModalOpen(true); }}
								onDelete={(ns) => { setSelectedNamespace(ns); setDeleteNamespaceModalOpen(true); }}
								onDeleteFunction={(func) => { setSelectedFunction(func); setDeleteFunctionModalOpen(true); }}
								onCloneFunction={(func) => { setSelectedFunctionForClone(func); setCloneFunctionModalOpen(true); }}
							/>
						))}
				</div>
			)}

			{/* Modals */}
			<CreateNamespaceModal isOpen={isNamespaceModalOpen} onClose={() => setNamespaceModalOpen(false)} onSuccess={refreshData} />
			<CreateFunctionModal isOpen={isFunctionModalOpen} onClose={() => setFunctionModalOpen(false)} onSuccess={refreshData} namespaces={namespaces} />
			<AIGenerateModal
				isOpen={isAIModalOpen}
				onClose={() => setAIModalOpen(false)}
				onSuccess={refreshData}
				namespaceId={namespaces.length > 0 ? (selectedNamespace?.id || namespaces[0].id) : undefined}
				disabled={!aiEnabled}
				disabledReason="Enable AI in Account Settings to use AI KICKOFF."
			/>
			<CloneFunctionModal
				isOpen={isCloneFunctionModalOpen}
				onClose={() => setCloneFunctionModalOpen(false)}
				onSuccess={() => { setSelectedFunctionForClone(null); refreshData(); }}
				namespaces={namespaces}
				functionId={selectedFunctionForClone?.id || null}
			/>
			<RenameNamespaceModal isOpen={isRenameNamespaceModalOpen} onClose={() => setRenameNamespaceModalOpen(false)} onRename={refreshData} namespaceId={selectedNamespace?.id || null} currentName={selectedNamespace?.name || ""} />
			<DeleteNamespaceModal isOpen={isDeleteNamespaceModalOpen} onClose={() => setDeleteNamespaceModalOpen(false)} onDelete={refreshData} namespaceId={selectedNamespace?.id || null} namespaceName={selectedNamespace?.name || ""} />
			<DeleteFunctionModal isOpen={isDeleteFunctionModalOpen} onClose={() => setDeleteFunctionModalOpen(false)} onDelete={handleDeleteFunction} functionId={selectedFunction?.id || null} functionName={selectedFunction?.name || ""} />
			<ImportFunctionModal isOpen={isImportModalOpen} onClose={() => { setImportModalOpen(false); refreshData(); }} />
			<MassReplaceModal isOpen={isMassReplaceModalOpen} onClose={() => setMassReplaceModalOpen(false)} onSuccess={(msg) => { toast.success(msg); refreshData(); }} />
		</div>
	);
}

function Btn({
	icon,
	label,
	variant = "secondary",
	onClick,
	disabled = false,
}: {
	icon: Parameters<typeof Icon>[0]["name"];
	label: string;
	variant?: "primary" | "secondary";
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
				variant === "primary"
					? "bg-primary text-background hover:bg-primary/90"
					: "border border-white/[0.07] text-text/70 hover:bg-surface hover:text-text hover:border-primary/20"
			}`}
		>
			<Icon name={icon} className="w-4 h-4" />
			{label}
		</button>
	);
}

function NamespaceCard({
	namespace,
	isExpanded,
	onToggle,
	onRename,
	onDelete,
	onDeleteFunction,
	onCloneFunction,
}: {
	namespace: Namespace;
	isExpanded: boolean;
	onToggle: () => void;
	onRename: (ns: { id: number; name: string }) => void;
	onDelete: (ns: { id: number; name: string }) => void;
	onDeleteFunction: (func: { id: number; name: string }) => void;
	onCloneFunction: (func: { id: number; name: string }) => void;
}) {
	const functions = namespace.functions ?? [];

	return (
		<div className="bg-surface border border-white/[0.07] rounded-xl overflow-hidden hover:border-primary/20 transition-colors">
			<div
				className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
				onClick={onToggle}
			>
				<div className="flex items-center gap-2.5">
					<Icon
						name="chevron-right"
						className={`w-4 h-4 text-muted transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
					/>
					<Icon name={isExpanded ? "folder-open" : "folder"} className="w-4 h-4 text-primary/60" />
					<span className="text-sm font-semibold text-text">{namespace.name}</span>
					<span className="text-xs text-muted">{functions.length}</span>
				</div>
				<div className="flex items-center gap-1">
					<button
						onClick={(e) => { e.stopPropagation(); onRename({ id: namespace.id, name: namespace.name }); }}
						className="p-1.5 text-muted hover:text-text hover:bg-white/[0.06] rounded transition-colors"
						title="Rename"
					>
						<Icon name="pencil" className="w-3.5 h-3.5" />
					</button>
					<button
						onClick={(e) => { e.stopPropagation(); onDelete({ id: namespace.id, name: namespace.name }); }}
						className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
						title="Delete"
					>
						<Icon name="trash" className="w-3.5 h-3.5" />
					</button>
				</div>
			</div>

			{isExpanded && (
				<div className="border-t border-white/[0.07]">
					{functions.length === 0 ? (
						<p className="px-12 py-4 text-xs text-muted">No functions yet</p>
					) : (
						<div className="divide-y divide-white/[0.04]">
							{functions
								.slice()
								.sort((a, b) => a.name.localeCompare(b.name))
								.map((func) => (
									<FunctionRow
										key={func.id}
										func={func}
										onDelete={() => onDeleteFunction({ id: func.id, name: func.name })}
										onClone={() => onCloneFunction({ id: func.id, name: func.name })}
									/>
								))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function FunctionRow({
	func,
	onDelete,
	onClone,
}: {
	func: XFunction;
	onDelete: () => void;
	onClone: () => void;
}) {
	return (
		<a
			href={`/functions/${func.id}`}
			className="flex items-center justify-between px-10 py-2.5 hover:bg-white/[0.03] transition-colors group"
		>
			<div className="flex items-center gap-3 min-w-0">
				<Icon name="code-bracket" className="w-3.5 h-3.5 text-muted shrink-0" />
				<span className="text-sm font-medium text-text/85 group-hover:text-primary transition-colors truncate">
					{func.name}
				</span>
				<div className="flex items-center gap-1.5 shrink-0">
					{func.imported && <Badge color="blue">Imported</Badge>}
					{func.ai_kicked_off && <Badge color="emerald">AI</Badge>}
					{func.startup_file.endsWith(".html") && <Badge color="blue">HTML</Badge>}
				</div>
				{func.description && (
					<span className="text-xs text-muted truncate hidden sm:block">{func.description}</span>
				)}
			</div>
			<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3">
				<button
					onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClone(); }}
					className="p-1.5 text-muted hover:text-text hover:bg-white/[0.06] rounded transition-colors"
					title="Clone"
				>
					<Icon name="document-duplicate" className="w-3.5 h-3.5" />
				</button>
				<button
					onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
					className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
					title="Delete"
				>
					<Icon name="trash" className="w-3.5 h-3.5" />
				</button>
			</div>
		</a>
	);
}

function Badge({ children, color }: { children: React.ReactNode; color: "blue" | "emerald" | "yellow" }) {
	const colors = {
		blue: "bg-blue-500/15 text-blue-300 border-blue-500/20",
		emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
		yellow: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
	};
	return (
		<span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${colors[color]}`}>
			{children}
		</span>
	);
}

function EmptyState({
	onCreateNamespace,
	onCreateFunction,
}: {
	onCreateNamespace: () => void;
	onCreateFunction: () => void;
}) {
	return (
		<div className="flex flex-col items-center justify-center py-24 text-center">
			<div className="w-12 h-12 rounded-xl bg-surface border border-white/[0.07] flex items-center justify-center mb-4">
				<Icon name="code-bracket" className="w-6 h-6 text-primary/50" />
			</div>
			<h2 className="text-lg font-semibold text-text mb-1">No functions yet</h2>
			<p className="text-sm text-muted mb-6 max-w-xs">
				Create a namespace to organize your functions, then deploy your first function.
			</p>
			<div className="flex gap-2">
				<button
					onClick={onCreateNamespace}
					className="px-4 py-2 border border-white/[0.07] text-text/70 text-sm font-medium rounded-lg hover:bg-surface hover:text-text transition-colors"
				>
					New Namespace
				</button>
				<button
					onClick={onCreateFunction}
					className="px-4 py-2 bg-primary text-background text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
				>
					New Function
				</button>
			</div>
		</div>
	);
}

export default FunctionsList;
