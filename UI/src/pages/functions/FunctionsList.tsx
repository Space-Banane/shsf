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
	const [selectedNamespace, setSelectedNamespace] = useState<{
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

	return (
		<div className="p-4">
			<h1 className="text-white text-3xl text-semibold underline">
				{user ? `Your Functions` : "Functions List"}
			</h1>

			<div className="mt-4 flex flex-wrap gap-2">
				<button
					onClick={() => setNamespaceModalOpen(true)}
					className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-6 py-2.5 rounded-lg hover:from-blue-800 hover:to-blue-600 transition-all duration-200 shadow-lg hover:shadow-blue-500/30 font-semibold"
				>
					Create Namespace
				</button>
				<button
					onClick={() => setFunctionModalOpen(true)}
					className="bg-gradient-to-r from-blue-800 to-blue-600 text-white px-6 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-500 transition-all duration-200 shadow-lg hover:shadow-blue-500/30 font-semibold"
				>
					Create Function
				</button>

				<div className="inline-flex items-center text-gray-400 gap-2 ml-4">
					<button
						onClick={expandAllNamespaces}
						className="bg-gradient-to-r from-green-800 to-green-600 text-white px-6 py-2.5 rounded-lg hover:from-green-700 hover:to-green-500 transition-all duration-200 shadow-lg hover:shadow-green-500/30 font-semibold"
					>
						Expand All
					</button>
					<button
						onClick={collapseAllNamespaces}
						className="bg-gradient-to-r from-gray-700 to-gray-600 text-white px-6 py-2.5 rounded-lg hover:from-gray-600 hover:to-gray-500 transition-all duration-200 shadow-lg hover:shadow-gray-500/30 font-semibold"
					>
						Collapse All
					</button>
				</div>
			</div>

			<div className="mt-4">
				{namespaces.map((namespace) => (
					<div
						key={namespace.id}
						className="mb-4 bg-gray-800 rounded-lg overflow-hidden"
					>
						<div
							className="flex items-center text-lg text-blue-400 p-3 hover:bg-gray-700 cursor-pointer border-l-4 border-blue-500"
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
							<div className="ml-auto flex">
								<button
									className="ml-2 text-sm text-yellow-500 hover:bg-gray-600 px-2 py-1 rounded"
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
									className="ml-2 text-sm text-red-500 hover:bg-gray-600 px-2 py-1 rounded"
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
							<div className="ml-6 p-2 border-l-2 border-gray-600">
								{namespace.functions
									.slice()
									.sort((a, b) => a.name.localeCompare(b.name))
									.map((func) => (
										<a
											key={func.id}
											href={`/functions/${func.id}`}
											className="block text-base text-gray-300 mb-2 p-2 hover:bg-gray-700 rounded"
										>
											<div className="flex items-center">
												🚀 <span className="ml-2">{func.name}</span>
												<span className="text-gray-500 ml-2">
													{func.description || "No description available"}
												</span>
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
		</div>
	);
}

export default FunctionsList;
