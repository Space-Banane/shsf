import { useContext, useEffect, useState } from "react";
import { getFunctions } from "../../services/backend.functions";
import { Namespace, XFunction } from "../../types/Prisma";
import { UserContext } from "../../App";
import { getNamespaces, NamespaceResponseWithFunctions } from "../../services/backend.namespaces";
import CreateNamespaceModal from "../../components/modals/CreateNamespaceModal";
import CreateFunctionModal from "../../components/modals/CreateFunctionModal";
import RenameNamespaceModal from "../../components/modals/RenameNamespaceModal";

function FunctionsList() {
	const [namespaces, setNamespaces] = useState<NamespaceResponseWithFunctions["data"][]>([]); // Adjusted type
	const { user, refreshUser } = useContext(UserContext);
	const [isNamespaceModalOpen, setNamespaceModalOpen] = useState(false);
	const [isRenameNamespaceModalOpen, setRenameNamespaceModalOpen] = useState(false);
	const [isFunctionModalOpen, setFunctionModalOpen] = useState(false);
	const [selectedNamespace, setSelectedNamespace] = useState<{ id: number, name: string } | null>(null);
	const [expandedNamespaces, setExpandedNamespaces] = useState<number[]>([]);

	useEffect(() => {
		getNamespaces(true).then((data) => {
			if (data.status === "OK") {
				setNamespaces(data.data as NamespaceResponseWithFunctions["data"][]); // Adjusted type
			} else {
				alert("Error fetching namespaces:"+ data.message);
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

	return (
		<div className="p-4">
			<h1 className="text-white text-2xl">{ user ? `Your Functions` : "Functions List" }</h1>
			
			<div className="mt-4">
				<button
					onClick={() => setNamespaceModalOpen(true)}
					className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-6 py-2.5 rounded-lg mr-4 hover:from-blue-800 hover:to-blue-600 transition-all duration-200 shadow-lg hover:shadow-blue-500/30 font-semibold"
				>
					Create Namespace
				</button>
				<button
					onClick={() => setFunctionModalOpen(true)}
					className="bg-gradient-to-r from-blue-800 to-blue-600 text-white px-6 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-500 transition-all duration-200 shadow-lg hover:shadow-blue-500/30 font-semibold"
				>
					Create Function
				</button>
			</div>

			<div className="mt-4">
				{namespaces.map((namespace) => (
					<div key={namespace.id} className="mb-4 bg-gray-800 rounded-lg overflow-hidden">
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
								<button 
									className="ml-2 text-sm text-yellow-500 hover:bg-gray-600 px-2 py-1 rounded"
									onClick={(e) => {
										e.stopPropagation();
										setSelectedNamespace({ id: namespace.id, name: namespace.name });
										setRenameNamespaceModalOpen(true);
									}}
								>
									 ✏️ Rename
								</button>
							</div>
							{expandedNamespaces.includes(namespace.id) && (
								<div className="ml-6 p-2 border-l-2 border-gray-600">
									{namespace.functions.map((func) => (
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
		</div>
	);
}

export default FunctionsList;
