const API_BASE_URL = "http://localhost:5000/api";


interface FunctionEnvironment {
	name: string;
	value: string;
}

export interface FunctionData {
	id: number;
	name: string;
	namespaceId: number;
	description: string;
	image: string;
	allow_http: boolean; // Add this property
	environment?: FunctionEnvironment[];
	startup_file?: string; // Replaced startup_command with startup_file
    createdAt?: string;
updatedAt: string;
namespace: NamespaceData;
}

interface FunctionFile {
	id: number;
	name: string;
	content: string;
	functionId: number;
}

export interface NamespaceData {
	id: number;
	name: string;
	createdAt?: string;
	updatedAt?: string;
	functions?: FunctionData[]; // Add functions property to NamespaceData
}

interface NamespaceCreateData {
	name: string;
}

export type FunctionDetailType = {
	id: number;
	name: string;
	description: string;
	// Add other fields as per the backend response
};

export const BackendService = {
	// Function listing
	getFunctions: async (): Promise<FunctionData[]> => {
		const response = await fetch(`${API_BASE_URL}/functions`, {
			credentials: "include",
		});
		const data = await response.json();
		if (data.status === "OK" && data.data) {
			return data.data;
		}
		throw new Error(data.message || "Failed to fetch functions");
	},

	// Function details
	getFunction: async (id: number): Promise<FunctionData> => {
		const response = await fetch(`${API_BASE_URL}/function/${id}`, {
			credentials: "include",
		});
		const data = await response.json();
		if (data.status === "OK" && data.data) {
			return data.data;
		}
		throw new Error(data.message || "Failed to fetch function");
	},

	// Function creation
	createFunction: async (
		functionData: Partial<FunctionData>
	): Promise<{ id: number }> => {
		const response = await fetch(`${API_BASE_URL}/function`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify(functionData),
		});
		const data = await response.json();
		if (data.status === "OK" && data.data) {
			return data.data;
		}
		throw new Error(data.message || "Failed to create function");
	},

	// Function update
	updateFunction: async (
		id: number,
		functionData: Partial<FunctionData>
	): Promise<FunctionData> => {
		const response = await fetch(`${API_BASE_URL}/function/${id}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify(functionData),
		});
		const data = await response.json();
		if (data.status === "OK" && data.data) {
			return data.data;
		}
		throw new Error(data.message || "Failed to update function");
	},

	// Function deletion
	deleteFunction: async (id: number): Promise<void> => {
		const response = await fetch(`${API_BASE_URL}/function/${id}`, {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
		});
		const data = await response.json();
		if (data.status === "OK") {
			return;
		}
		throw new Error(data.message || "Failed to delete function");
	},

	// Function files listing
	getFunctionFiles: async (id: number): Promise<FunctionFile[]> => {
		const response = await fetch(`${API_BASE_URL}/function/${id}/files`, {
			credentials: "include",
		});
		const data = await response.json();
		if (data.status === "OK" && data.data) {
			return data.data;
		}
		throw new Error(data.message || "Failed to fetch function files");
	},

	// Function file update or creation
	updateFunctionFile: async (
		functionId: number,
		filename: string,
		code: string
	): Promise<{ id: number }> => {
		const response = await fetch(
			`${API_BASE_URL}/function/${functionId}/file`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({
					filename,
					code,
				}),
			}
		);
		const data = await response.json();
		if (data.status === "OK" && data.data) {
			return data.data;
		}
		throw new Error(data.message || "Failed to update function file");
	},

	// Function execution
	executeFunction: async (
		id: number
	): Promise<{ output: string; exitCode?: number }> => {
		const response = await fetch(`${API_BASE_URL}/function/${id}/execute`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
		});
		const data = await response.json();
		if (data.error) {
			throw new Error(data.error);
		}
		if (data.status === "OK" && data.data) {
			return data.data;
		}
		return { output: "No output received" };
	},

	// Function file operations
	deleteFile: async (functionId: number, filename: string): Promise<void> => {
		const response = await fetch(
			`${API_BASE_URL}/function/${functionId}/file/${filename}`,
			{
				method: "DELETE",
				credentials: "include",
			}
		);
		const data = await response.json();
		if (data.status !== "OK") {
			throw new Error(data.message || "Failed to delete file");
		}
	},

	renameFile: async (
		functionId: number,
		oldFilename: string,
		newFilename: string
	): Promise<void> => {
		const response = await fetch(
			`${API_BASE_URL}/function/${functionId}/file/${oldFilename}/rename`,
			{
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ newFilename }),
			}
		);
		const data = await response.json();
		if (data.status !== "OK") {
			throw new Error(data.message || "Failed to rename file");
		}
	},

	// Namespace listing
	getNamespaces: async (
		include_functions: boolean = false
	): Promise<
		(Omit<NamespaceData, "functions"> & { functions?: FunctionData[] })[]
	> => {
		const response = await fetch(
			`${API_BASE_URL}/namespaces?include_functions=${include_functions}`,
			{
				credentials: "include",
			}
		);
		const data = await response.json();
		if (data.status === "OK" && data.data) {
			return data.data;
		}
		throw new Error(data.message || "Failed to fetch namespaces");
	},

	// Namespace details
	getNamespace: async (id: number): Promise<NamespaceData> => {
		const response = await fetch(`${API_BASE_URL}/namespace/${id}`, {
			credentials: "include",
		});
		const data = await response.json();
		if (data.status === "OK" && data.data) {
			return data.data;
		}
		throw new Error(data.message || "Failed to fetch namespace");
	},

	// Namespace creation
	createNamespace: async (
		namespaceData: Omit<NamespaceCreateData, "description">
	): Promise<{ id: number }> => {
		const response = await fetch(`${API_BASE_URL}/namespace`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify(namespaceData),
		});
		const data = await response.json();
		if (data.status === "OK" && data.data) {
			return data.data;
		}
		throw new Error(data.message || "Failed to create namespace");
	},

	// Namespace update
	updateNamespace: async (
		id: number,
		namespaceData: Omit<NamespaceData, "description">
	): Promise<NamespaceData> => {
		const response = await fetch(`${API_BASE_URL}/namespace/${id}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify(namespaceData),
		});
		const data = await response.json();
		if (data.status === "OK" && data.data) {
			return data.data;
		}
		throw new Error(data.message || "Failed to update namespace");
	},

	// Namespace deletion
	deleteNamespace: async (id: number): Promise<void> => {
		const response = await fetch(`${API_BASE_URL}/namespace/${id}`, {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
		});
		const data = await response.json();
		if (data.status === "OK") {
			return;
		}
		throw new Error(data.message || "Failed to delete namespace");
	},
};
