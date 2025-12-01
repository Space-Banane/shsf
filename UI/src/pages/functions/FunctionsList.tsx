import { useContext, useEffect, useState } from "react";
import { UserContext } from "../../App";
import {
	getNamespaces,
	NamespaceResponseWithFunctions,
} from "../../services/backend.namespaces";
import CreateNamespaceModal from "../../components/modals/CreateNamespaceModal";
import CreateFunctionModal from "../../components/modals/CreateFunctionModal";
import RenameNamespaceModal from "../../components/modals/RenameNamespaceModal";
import DeleteNamespaceModal from "../../components/modals/DeleteNamespaceModal";
import DeleteFunctionModal from "../../components/modals/DeleteFunctionModal";
import { deleteFunction } from "../../services/backend.functions";

function FunctionsList() {
	const [namespaces, setNamespaces] = useState<
		NamespaceResponseWithFunctions["data"][]
	>([]);
	const [loading, setLoading] = useState(true);
	const { user, refreshUser } = useContext(UserContext);
	const [isNamespaceModalOpen, setNamespaceModalOpen] = useState(false);
	const [isRenameNamespaceModalOpen, setRenameNamespaceModalOpen] =
		useState(false);
	const [isDeleteNamespaceModalOpen, setDeleteNamespaceModalOpen] =
		useState(false);
	const [isFunctionModalOpen, setFunctionModalOpen] = useState(false);
	const [isDeleteFunctionModalOpen, setDeleteFunctionModalOpen] =
		useState(false);
	const [selectedNamespace, setSelectedNamespace] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const [selectedFunction, setSelectedFunction] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const [expandedNamespaces, setExpandedNamespaces] = useState<number[]>([]);

	useEffect(() => {
		setLoading(true);
		getNamespaces(true).then((data) => {
			if (data.status === "OK") {
				const loadedNamespaces =
					data.data as NamespaceResponseWithFunctions["data"][];
				setNamespaces(loadedNamespaces);
				// Expand all namespaces by default
				setExpandedNamespaces(loadedNamespaces.map((ns) => ns.id));
			} else {
				alert("Error fetching namespaces:" + data.message);
			}
			setLoading(false);
		});
	}, []);

	const refreshData = () => {
		getNamespaces(true).then((data) => {
			if (data.status === "OK") {
				setNamespaces(data.data as NamespaceResponseWithFunctions["data"][]);
			}
		});
	};

	const toggleNamespace = (namespaceId: number) => {
		setExpandedNamespaces((prev) =>
			prev.includes(namespaceId)
				? prev.filter((id) => id !== namespaceId)
				: [...prev, namespaceId],
		);
	};

	const expandAllNamespaces = () => {
		setExpandedNamespaces(namespaces.map((ns) => ns.id));
	};

	const collapseAllNamespaces = () => {
		setExpandedNamespaces([]);
	};

	const handleDeleteFunction = async (functionId: number) => {
		try {
			const response = await deleteFunction(functionId);
			if (response.status === "OK") {
				refreshData();
				return true;
			} else {
				alert("Error deleting function: " + response.message);
				return false;
			}
		} catch (error) {
			console.error("Error deleting function:", error);
			alert("An error occurred while deleting the function.");
			return false;
		}
	};

	const totalFunctions = namespaces.reduce(
		(sum, ns) => sum + ns.functions.length,
		0,
	);

	if (loading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center space-y-4">
					<div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
					<p className="text-text/70 text-lg">Loading your functions...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background">
			{/* Hero Header Section */}
			<div className="relative bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-b border-primary/20">
				<div className="max-w-7xl mx-auto px-4 py-12">
					<div className="text-center space-y-3">
						<h1 className="text-4xl font-bold text-primary mb-3">
							{user ? `Your Functions` : "Functions Dashboard"}
						</h1>
						<div className="h-1 w-20 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
						<p className="text-lg text-text/70 max-w-2xl mx-auto">
							Manage your serverless functions and namespaces with ease
						</p>
						<div className="flex items-center justify-center gap-6 text-text/60 mt-6">
							<div className="flex items-center gap-2">
								<div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
								<span className="text-sm">{namespaces.length} Namespaces</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
								<span className="text-sm">{totalFunctions} Functions</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="max-w-7xl mx-auto px-4 py-8">
				{/* Action Bar */}
				<div className="flex flex-col lg:flex-row gap-3 items-center justify-between mb-6">
					<div className="flex flex-wrap gap-2">
						<ActionButton
							icon="📁"
							label="Create Namespace"
							variant="primary"
							onClick={() => setNamespaceModalOpen(true)}
						/>
						<ActionButton
							icon="🚀"
							label="Create Function"
							variant="primary"
							onClick={() => setFunctionModalOpen(true)}
						/>
					</div>

					<div className="flex items-center gap-2">
						<ActionButton
							icon={expandedNamespaces.length === namespaces.length ? "📁" : "📂"}
							label={
								expandedNamespaces.length === namespaces.length
									? "Collapse All"
									: "Expand All"
							}
							variant="secondary"
							onClick={() => {
								if (expandedNamespaces.length === namespaces.length) {
									collapseAllNamespaces();
								} else {
									expandAllNamespaces();
								}
							}}
						/>
					</div>
				</div>

				{/* Functions Grid */}
				{namespaces.length === 0 ? (
					<EmptyState
						onCreateNamespace={() => setNamespaceModalOpen(true)}
						onCreateFunction={() => setFunctionModalOpen(true)}
					/>
				) : (
					<div className="space-y-4">
						{namespaces
							.slice()
							.sort((a, b) => a.name.localeCompare(b.name))
							.map((namespace) => (
								<NamespaceCard
									key={namespace.id}
									namespace={namespace}
									isExpanded={expandedNamespaces.includes(namespace.id)}
									onToggle={() => toggleNamespace(namespace.id)}
									onRename={(ns) => {
										setSelectedNamespace(ns);
										setRenameNamespaceModalOpen(true);
									}}
									onDelete={(ns) => {
										setSelectedNamespace(ns);
										setDeleteNamespaceModalOpen(true);
									}}
									onDeleteFunction={(func) => {
										setSelectedFunction(func);
										setDeleteFunctionModalOpen(true);
									}}
								/>
							))}
					</div>
				)}
			</div>

			{/* Modals */}
			<CreateNamespaceModal
				isOpen={isNamespaceModalOpen}
				onClose={() => setNamespaceModalOpen(false)}
				onSuccess={refreshData}
			/>
			<CreateFunctionModal
				isOpen={isFunctionModalOpen}
				onClose={() => setFunctionModalOpen(false)}
				onSuccess={refreshData}
				namespaces={namespaces}
			/>
			<RenameNamespaceModal
				isOpen={isRenameNamespaceModalOpen}
				onClose={() => setRenameNamespaceModalOpen(false)}
				onRename={refreshData}
				namespaceId={selectedNamespace?.id || null}
				currentName={selectedNamespace?.name || ""}
			/>
			<DeleteNamespaceModal
				isOpen={isDeleteNamespaceModalOpen}
				onClose={() => setDeleteNamespaceModalOpen(false)}
				onDelete={refreshData}
				namespaceId={selectedNamespace?.id || null}
				namespaceName={selectedNamespace?.name || ""}
			/>
			<DeleteFunctionModal
				isOpen={isDeleteFunctionModalOpen}
				onClose={() => setDeleteFunctionModalOpen(false)}
				onDelete={handleDeleteFunction}
				functionId={selectedFunction?.id || null}
				functionName={selectedFunction?.name || ""}
			/>
		</div>
	);
}

function ActionButton({
	icon,
	label,
	variant = "primary",
	onClick,
}: {
	icon: string;
	label: string;
	variant?: "primary" | "secondary";
	onClick: () => void;
}) {
	const baseClasses =
		"px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 hover:scale-105";
	const variantClasses = {
		primary:
			"bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-[0_0_30px_rgba(124,131,253,0.3)] border border-transparent",
		secondary:
			"bg-background/50 border border-primary/20 text-primary hover:border-primary/40 hover:bg-primary/5",
	};

	return (
		<button
			onClick={onClick}
			className={`${baseClasses} ${variantClasses[variant]}`}
		>
			<span className="text-lg">{icon}</span>
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
}: {
	namespace: NamespaceResponseWithFunctions["data"];
	isExpanded: boolean;
	onToggle: () => void;
	onRename: (ns: { id: number; name: string }) => void;
	onDelete: (ns: { id: number; name: string }) => void;
	onDeleteFunction: (func: { id: number; name: string }) => void;
}) {
	return (
		<div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-xl overflow-hidden hover:border-primary/40 transition-all duration-300">
			{/* Namespace Header */}
			<div
				className="flex items-center justify-between p-4 cursor-pointer hover:bg-primary/5 transition-all duration-300"
				onClick={onToggle}
			>
				<div className="flex items-center gap-3">
					<div
						className={`transform transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`}
					>
						<svg
							className="w-4 h-4 text-primary"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</div>
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center text-lg">
							📁
						</div>
						<div>
							<h3 className="text-lg font-bold text-primary">{namespace.name}</h3>
							<p className="text-text/60 text-xs">
								{namespace.functions.length} functions
							</p>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-1">
					<button
						onClick={(e) => {
							e.stopPropagation();
							onRename({ id: namespace.id, name: namespace.name });
						}}
						className="p-1.5 text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-all duration-300 hover:scale-110"
						title="Rename namespace"
					>
						✏️
					</button>
					<button
						onClick={(e) => {
							e.stopPropagation();
							onDelete({ id: namespace.id, name: namespace.name });
						}}
						className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-300 hover:scale-110"
						title="Delete namespace"
					>
						🗑️
					</button>
				</div>
			</div>

			{/* Functions List */}
			{isExpanded && (
				<div className="border-t border-primary/10">
					{namespace.functions.length === 0 ? (
						<div className="p-6 text-center">
							<div className="text-3xl mb-3">📦</div>
							<p className="text-text/60 text-sm">
								No functions in this namespace yet
							</p>
							<p className="text-text/40 text-xs mt-1">
								Create your first function to get started
							</p>
						</div>
					) : (
						<div className="p-3 space-y-2">
							{namespace.functions
								.slice()
								.sort((a, b) => a.name.localeCompare(b.name))
								.map((func) => (
									<FunctionCard
										key={func.id}
										func={func}
										onDelete={() => onDeleteFunction({ id: func.id, name: func.name })}
									/>
								))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function FunctionCard({
	func,
	onDelete,
}: {
	func: { id: number; name: string; description?: string };
	onDelete: () => void;
}) {
	return (
		<a
			href={`/functions/${func.id}`}
			className="block bg-background/30 border border-primary/10 rounded-lg p-3 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 group"
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3 flex-1 min-w-0">
					<div className="w-6 h-6 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-lg flex items-center justify-center text-sm flex-shrink-0">
						🚀
					</div>
					<div className="flex-1 min-w-0">
						<h4 className="text-base font-semibold text-text group-hover:text-primary transition-colors duration-300">
							{func.name}
						</h4>
						<p className="text-text/60 text-xs truncate">
							{func.description || "No description available"}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-1 ml-3">
					<button
						onClick={(e) => {
							e.stopPropagation();
							e.preventDefault();
							onDelete();
						}}
						className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-300 hover:scale-110 opacity-0 group-hover:opacity-100"
						title="Delete function"
					>
						🗑️
					</button>
				</div>
			</div>
		</a>
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
		<div className="text-center py-12">
			<div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-xl p-8 max-w-2xl mx-auto">
				<div className="text-5xl mb-4">🚀</div>
				<h2 className="text-2xl font-bold text-primary mb-3">Ready to Deploy?</h2>
				<p className="text-text/70 mb-6 leading-relaxed">
					Start building your serverless functions! Create a namespace to organize
					your functions, or jump right in and create your first function.
				</p>
				<div className="flex flex-col sm:flex-row gap-3 justify-center">
					<ActionButton
						icon="📁"
						label="Create Namespace"
						variant="secondary"
						onClick={onCreateNamespace}
					/>
					<ActionButton
						icon="🚀"
						label="Create Function"
						variant="primary"
						onClick={onCreateFunction}
					/>
				</div>
			</div>
		</div>
	);
}

export default FunctionsList;
