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
	>([]); // Adjusted type
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
		});
	}, []);

	const refreshData = () => {
		// Refresh namespaces and functions
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
				: [...prev, namespaceId]
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

	return (
		<div className="p-4">
			<h1 className="text-primary text-center text-5xl font-bold underline mb-6">
				{user ? `Your Functions` : "Functions List"}
			</h1>

			<div className="mt-4 flex flex-wrap gap-2 justify-center">
				<button
					onClick={() => setNamespaceModalOpen(true)}
					className="px-4 py-2 border-2 border-primary text-primary text-xl font-bold rounded-xl 
					hover:bg-primary/10 hover:shadow-xl hover:scale-105 hover:border-opacity-80
					transition-all duration-300 ease-out flex items-center gap-2"
				>
					<span className="text-2xl">📁</span>
					Create Namespace
				</button>
				<button
					onClick={() => setFunctionModalOpen(true)}
					className="px-4 py-2 border-2 border-primary text-primary text-xl font-bold rounded-xl 
					hover:bg-primary/10 hover:shadow-xl hover:scale-105 hover:border-opacity-80
					transition-all duration-300 ease-out flex items-center gap-2"
				>
					<span className="text-2xl">🚀</span>
					Create Function
				</button>

				<div className="inline-flex items-center gap-2 ml-4">
					<button
						onClick={() => {
							if (expandedNamespaces.length === namespaces.length) {
								collapseAllNamespaces();
							} else {
								expandAllNamespaces();
							}
						}}
						className={`px-3 py-1 text-lg border rounded-xl transition-all text-primary border-primary hover:bg-primary/10"
						}`}
					>
						{expandedNamespaces.length === namespaces.length
							? "Collapse All"
							: "Expand All"}
					</button>
				</div>
			</div>

			<div className="mt-4">
				{namespaces.map((namespace) => (
					<div
						key={namespace.id}
						className="mb-4 bg-slate-900 rounded-lg overflow-hidden outline-1 outline-slate-700"
					>
						<div
							className="flex items-center text-lg text-blue-400 p-3 hover:bg-slate-800 cursor-pointer border-l-4 border-blue-500"
							onClick={() => toggleNamespace(namespace.id)}
						>
							<span className="flex items-center">
								<svg
									className={`w-4 h-4 mr-2 transform ${
										expandedNamespaces.includes(namespace.id) ? "rotate-90" : ""
									}`}
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
								📂 {namespace.name}
							</span>
							<div className="ml-auto flex border rounded-xl pr-2 border-slate-700 py-1">
								<button
									className="ml-2 text-sm text-yellow-500 hover:bg-gray-600 px-2 py-1 rounded-xl"
									onClick={(e) => {
										e.stopPropagation();
										setSelectedNamespace({
											id: namespace.id,
											name: namespace.name,
										});
										setRenameNamespaceModalOpen(true);
									}}
								>
									✏️ Rename
								</button>
								<button
									className="ml-2 text-sm text-red-500 hover:bg-gray-600 px-2 py-1 rounded-xl"
									onClick={(e) => {
										e.stopPropagation();
										setSelectedNamespace({
											id: namespace.id,
											name: namespace.name,
										});
										setDeleteNamespaceModalOpen(true);
									}}
								>
									🗑️ Delete
								</button>
							</div>
						</div>
						{expandedNamespaces.includes(namespace.id) && (
							<div className="ml-6 p-2 border-l-2 border-slate-600">
								{namespace.functions
									.slice()
									.sort((a, b) => a.name.localeCompare(b.name))
									.map((func) => (
										<a
											key={func.id}
											href={`/functions/${func.id}`}
											className="block text-base text-gray-300 mb-1 p-2 hover:bg-slate-800 rounded-lg"
										>
											<div className="flex items-center">
												🚀 <span className="ml-2 text-lg">{func.name}</span>
												<span className="text-gray-500 ml-2 text-base">
													{func.description || "No description available"}
												</span>
												<button
													className="ml-auto text-red-500 hover:bg-gray-600 px-2 py-1 rounded-xl"
													onClick={(e) => {
														e.stopPropagation();
														e.preventDefault();
														setSelectedFunction({
															id: func.id,
															name: func.name,
														});
														setDeleteFunctionModalOpen(true);
													}}
												>
													🗑️ Delete
												</button>
											</div>
										</a>
									))}
							</div>
						)}
					</div>
				))}
			</div>

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

export default FunctionsList;
