import React, { useState } from "react";
import Modal from "./Modal";
export interface CreateFunctionModalProps {
    isOpen: boolean;
    onClose: () => void;
    functionName: string;
    setFunctionName: React.Dispatch<React.SetStateAction<string>>;
    functionDesc: string;
    setFunctionDesc: React.Dispatch<React.SetStateAction<string>>;
    image: string;
    setImage: React.Dispatch<React.SetStateAction<string>>;
    allowHttp: boolean;
    setAllowHttp: React.Dispatch<React.SetStateAction<boolean>>;
    handleCreateFunction: () => Promise<void>;
    onCreateFunction: (data: { name: string; description: string; image: string; allowHttp: boolean }) => void;
}

const CreateFunctionModal: React.FC<CreateFunctionModalProps> = ({
    isOpen,
    onClose,
    onCreateFunction,
}) => {
    const [functionName, setFunctionName] = useState<string>("");
    const [functionDesc, setFunctionDesc] = useState<string>("");
    const [image, setImage] = useState<string>("");
    const [allowHttp, setAllowHttp] = useState<boolean>(false);

    const handleRuntimeChange = (runtime: string) => {
        setImage(runtime);
    };

    const handleSubmit = () => {
        if (functionName.trim() && functionDesc.length >= 12) {
            onCreateFunction({ name: functionName, description: functionDesc, image, allowHttp });
            setFunctionName("");
            setFunctionDesc("");
            setImage("");
            setAllowHttp(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Function">
            <div className="mb-4">
                <label className="block text-gray-300 mb-2">Function Name</label>
                <input
                    type="text"
                    className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100"
                    value={functionName}
                    onChange={(e) => setFunctionName(e.target.value)}
                    placeholder="my_function"
                />
            </div>
            <div className="mb-4">
                <label className="block text-gray-300 mb-2">Description</label>
                <textarea
                    className="w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-100 h-24"
                    value={functionDesc}
                    onChange={(e) => setFunctionDesc(e.target.value)}
                    placeholder="Function description (at least 12 characters)"
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
                    className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    onClick={handleSubmit}
                    disabled={!functionName.trim() || functionDesc.length < 12}
                >
                    Create Function
                </button>
            </div>
        </Modal>
    );
};

export default CreateFunctionModal;
