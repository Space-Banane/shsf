import { useEffect, useState } from 'react';
import { Link } from "react-router-dom";
import { BackendService, NamespaceData, FunctionData } from '../../services/backend.service';
import Modal from '../../components/modals/Modal';
import UpdateNamespaceModal from '../../components/modals/UpdateNamespaceModal';
import UpdateFunctionModal from '../../components/modals/UpdateFunctionModal';
import CreateNamespaceModal from '../../components/modals/CreateNamespaceModal';
import CreateFunctionModal from '../../components/modals/CreateFunctionModal';

function FunctionsList() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [namespaceName, setNamespaceName] = useState('');
    const [namespaces, setNamespaces] = useState<NamespaceData[]>([]);
    const [isFunctionModalOpen, setIsFunctionModalOpen] = useState(false);
    const [functionName, setFunctionName] = useState('');
    const [selectedNamespaceId, setSelectedNamespaceId] = useState<number | null>(null);
    const [functionDesc, setFunctionDesc] = useState('');
    const [image, setImage] = useState('');
    const [allowHttp, setAllowHttp] = useState(false);
    const [isUpdateNamespaceModalOpen, setIsUpdateNamespaceModalOpen] = useState(false);
    const [selectedNamespace, setSelectedNamespace] = useState<NamespaceData | null>(null);
    const [isUpdateFunctionModalOpen, setIsUpdateFunctionModalOpen] = useState(false);
    const [selectedFunction, setSelectedFunction] = useState<FunctionData | null>(null);

    const fetchNamespaces = () => {
        BackendService.getNamespaces(true)
            .then((data) => {
                setNamespaces(data);
            })
            .catch((error) => {
                console.error("Error fetching namespaces:", error);
                alert('Failed to fetch namespaces.');
            });
    };

    useEffect(() => {
        fetchNamespaces();
    }, []);

    const handleCreateNamespace = async () => {
        try {
            await BackendService.createNamespace({
                name: namespaceName,
            });
            setIsModalOpen(false);
            setNamespaceName('');
            fetchNamespaces();
            alert('Namespace created successfully!');
        } catch (error) {
            console.error("Error creating namespace:", error);
            alert('Failed to create namespace.');
        }
    };

    const handleUpdateNamespace = async (updatedData: Partial<NamespaceData>) => {
        if (!selectedNamespace) return;
        
        try {
            await BackendService.updateNamespace(selectedNamespace.id, updatedData as Omit<NamespaceData, "description">);
            setIsUpdateNamespaceModalOpen(false);
            fetchNamespaces();
            alert('Namespace updated successfully!');
        } catch (error) {
            console.error("Error updating namespace:", error);
            alert('Failed to update namespace.');
        }
    };

    const handleCreateFunction = async () => {
        if (!selectedNamespaceId) {
            alert('Please select a namespace.');
            return;
        }
        try {
            await BackendService.createFunction({
                name: functionName,
                namespaceId: selectedNamespaceId,
                allow_http: allowHttp,
                image,
                description: functionDesc,
            });
            setIsFunctionModalOpen(false);
            setFunctionName('');
            setAllowHttp(false);
            fetchNamespaces();
            alert('Function created successfully!');
        } catch (error) {
            console.error("Error creating function:", error);
            alert('Failed to create function.');
        }
    };

    const handleUpdateFunction = async (updatedData: Partial<FunctionData>) => {
        if (!selectedFunction) return;

        try {
            await BackendService.updateFunction(selectedFunction.id, updatedData);
            setIsUpdateFunctionModalOpen(false);
            fetchNamespaces();
            alert('Function updated successfully!');
        } catch (error) {
            console.error("Error updating function:", error);
            alert('Failed to update function.');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-100">Your Namespaces</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg
                    hover:from-blue-500 hover:to-blue-600 transition-all duration-200 shadow-lg flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Create Namespace
                </button>
            </div>
            
            <div className="space-y-6 w-full">
                {namespaces.map((namespace) => (
                    <div key={namespace.id} 
                         className="w-full bg-gray-800 rounded-xl shadow-xl overflow-hidden hover:shadow-2xl 
                         transition-all duration-200 border border-gray-700">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1 text-sm">
                                    <h2 className="text-xl font-bold text-gray-100">📂{namespace.name}</h2>
                                    <p className="text-gray-400 text-sm">ID: {namespace.id}</p>
                                    {namespace.createdAt && (
                                        <p className="text-gray-400">Created: {new Date(namespace.createdAt).toLocaleDateString()}</p>
                                    )}
                                    {namespace.updatedAt && (
                                        <p className="text-gray-400">Updated: {new Date(namespace.updatedAt).toLocaleDateString()}</p>
                                    )}
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => {
                                            setSelectedNamespace(namespace);
                                            setIsUpdateNamespaceModalOpen(true);
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 
                                        transition-all duration-200 text-sm flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                        </svg>
                                        Modify
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedNamespaceId(namespace.id);
                                            setIsFunctionModalOpen(true);
                                        }}
                                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 
                                        text-white rounded-lg hover:from-green-500 hover:to-green-600 
                                        transition-all duration-200 text-sm flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                                        </svg>
                                        New Function
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {namespace.functions && namespace.functions.length > 0 ? (
                                    <div className="space-y-3 lg:col-span-2">
                                        <h3 className="text-sm font-semibold text-gray-300 mb-2">Functions</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {namespace.functions.map((func) => (
                                                <div key={func.id} className="block p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors duration-200">
                                                    <Link to={`/functions/${func.id}`} className="block">
                                                        <p className="text-blue-400 hover:text-blue-300 font-medium text-xl">
                                                            🚀{func.name}
                                                        </p>
                                                        <div className="mt-1 space-y-1 text-sm">
                                                            {func.description && (
                                                                <p className="text-gray-400 text-base line-clamp-2">
                                                                    {func.description}
                                                                </p>
                                                            )}
                                                            {func.createdAt && (
                                                                <p className="text-gray-500">
                                                                    Created: {new Date(func.createdAt).toLocaleDateString()}
                                                                </p>
                                                            )}
                                                            {func.updatedAt && (
                                                                <p className="text-gray-500">
                                                                    Updated: {new Date(func.updatedAt).toLocaleDateString()}
                                                                </p>
                                                            )}
                                                            {func.allow_http && (
                                                                <p className="text-green-400">HTTP Allowed</p>
                                                            )}
                                                            {!func.allow_http && (
                                                                <p className="text-red-400">HTTP Not Allowed</p>
                                                            )}
                                                            {func.image && (
                                                                <p className="text-gray-500">
                                                                    Image: {func.image}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </Link>
                                                    <div className="flex justify-end mt-2">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedFunction(func);
                                                                setIsUpdateFunctionModalOpen(true);
                                                            }}
                                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 
                                                            transition-all duration-200 text-sm flex items-center gap-2"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                                            </svg>
                                                            Modify
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm italic lg:col-span-2">No functions in this namespace.</p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Namespace Modal */}
            <CreateNamespaceModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                namespaceName={namespaceName}
                setNamespaceName={setNamespaceName}
                handleCreateNamespace={handleCreateNamespace}
            />

            {/* Create Function Modal */}
            <CreateFunctionModal
                isOpen={isFunctionModalOpen}
                onClose={() => setIsFunctionModalOpen(false)}
                functionName={functionName}
                setFunctionName={setFunctionName}
                functionDesc={functionDesc}
                setFunctionDesc={setFunctionDesc}
                image={image}
                setImage={setImage}
                allowHttp={allowHttp}
                setAllowHttp={setAllowHttp}
                handleCreateFunction={handleCreateFunction}
                onCreateFunction={handleCreateFunction}
            />

            {/* Update Namespace Modal */}
            <UpdateNamespaceModal
                isOpen={isUpdateNamespaceModalOpen}
                onClose={() => setIsUpdateNamespaceModalOpen(false)}
                namespaceData={selectedNamespace}
                onUpdateNamespace={handleUpdateNamespace}
            />

            {/* Update Function Modal */}
            <UpdateFunctionModal
                isOpen={isUpdateFunctionModalOpen}
                onClose={() => setIsUpdateFunctionModalOpen(false)}
                functionData={selectedFunction}
                onUpdateFunction={handleUpdateFunction}
            />
        </div>
    );
}

export default FunctionsList;