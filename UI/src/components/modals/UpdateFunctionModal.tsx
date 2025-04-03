import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { FunctionData } from "../../services/backend.service";

interface UpdateFunctionModalProps {
    isOpen: boolean;
    onClose: () => void;
    functionData: FunctionData | null;
    onUpdateFunction: (updatedData: Partial<any>) => void;
}

function UpdateFunctionModal({ 
    isOpen, 
    onClose, 
    functionData, 
    onUpdateFunction 
}: UpdateFunctionModalProps) {
    const [name, setName] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [image, setImage] = useState<string>("");
    const [startupFile, setStartupFile] = useState<string>("");
    const [allowHttp, setAllowHttp] = useState<boolean>(false);

    useEffect(() => {
        if (functionData) {
            setName(functionData.name || "");
            setDescription(functionData.description || "");
            setImage(functionData.image || "");
            setStartupFile(functionData.startup_file || "");
            setAllowHttp(functionData.allow_http || false);
        }
    }, [functionData, isOpen]);

    const handleSubmit = () => {
        onUpdateFunction({
            name,
            description,
            image,
            startup_file: startupFile,
            settings:{
                allow_http: allowHttp
            }
        });
    };

    // Get default startup file based on runtime type
    const getDefaultStartupFile = (runtime: string) => {
        if (runtime.startsWith('python')) {
            return 'main.py';
        } else if (runtime.startsWith('node')) {
            return 'index.js';
        }
        return '';
    };

    // Handle runtime change with appropriate default startup file
    const handleRuntimeChange = (runtime: string) => {
        setImage(runtime);
        if (!startupFile) {
            setStartupFile(getDefaultStartupFile(runtime));
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Update Function">
            <div className="mb-4">
                <label className="block text-gray-300 mb-2">Function Name</label>
                <input
                    type="text"
                    className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Function name"
                />
            </div>
            
            <div className="mb-4">
                <label className="block text-gray-300 mb-2">Description</label>
                <textarea
                    className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100 h-24"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Function description"
                />
            </div>
            
            <div className="mb-4">
                <label className="block text-gray-300 mb-2">Runtime Image</label>
                <select
                    className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
                    value={image}
                    onChange={(e) => handleRuntimeChange(e.target.value)}
                >
                    <option value="">Select a runtime</option>
                    <optgroup label="Python">
                        {['2.9', '3.0', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9', '3.10', '3.11', '3.12'].map(version => (
                            <option key={`python-${version}`} value={`python:${version}`}>Python {version}</option>
                        ))}
                    </optgroup>
                    <optgroup label="Node.js">
                        <option value="node:16">Node.js 16</option>
                        <option value="node:17">Node.js 17</option>
                        <option value="node:18">Node.js 18</option>
                        <option value="node:19">Node.js 19</option>
                        <option value="node:20">Node.js 20 (LTS)</option>
                        <option value="node:21">Node.js 21</option>
                        <option value="node:22">Node.js 22 (LTS)</option>
                    </optgroup>
                </select>
            </div>
            
            <div className="mb-4">
                <label className="block text-gray-300 mb-2">Startup File</label>
                <input
                    type="text"
                    className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
                    value={startupFile}
                    onChange={(e) => setStartupFile(e.target.value)}
                    placeholder={image.startsWith('python') ? 'main.py' : 'index.js'}
                />
                <p className="text-sm text-gray-400 mt-1">
                    Leave empty to use the default ({image.startsWith('python') ? 'main.py' : 'index.js'})
                </p>
            </div>
            
            <div className="mb-4 flex items-center">
                <input
                    type="checkbox"
                    id="allowHttp"
                    className="mr-2"
                    checked={allowHttp}
                    onChange={(e) => setAllowHttp(e.target.checked)}
                />
                <label htmlFor="allowHttp" className="text-gray-300">Allow HTTP</label>
            </div>
            
            <div className="flex justify-end space-x-3">
                <button
                    type="button"
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    onClick={onClose}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    onClick={handleSubmit}
                >
                    Update Function
                </button>
            </div>
        </Modal>
    );
}

export default UpdateFunctionModal;
