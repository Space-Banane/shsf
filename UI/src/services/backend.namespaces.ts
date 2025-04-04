import { BASE_URL } from "..";
import { Namespace, XFunction } from "../types/Prisma";

interface OKResponse {
	status: "OK";
	message: string;
}
interface ErrorResponse {
	status: number;
	message: string;
}

interface NamespaceListResponse {
	status: "OK";
	data: Namespace[];
}

interface NamespaceResponseWithFunctions {
	status: "OK";
	data: {
		id: number;
		name: string;
		functions: XFunction[];
		createdAt: Date;
		updatedAt: Date;
	};
}

interface CreateNamespaceResponse {
	status: "OK";
	data: { id: number };
}

async function getNamespaces(includeFunctions: boolean = false): Promise<NamespaceListResponse | NamespaceResponseWithFunctions | ErrorResponse> {
	const response = await fetch(`${BASE_URL}/api/namespaces?include_functions=${includeFunctions}`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	const data = await response.json();
	if (response.status !== 200) {
		return {
			status: response.status,
			message: data.message,
		} as ErrorResponse;
	}

	if (includeFunctions) {
		return data as NamespaceResponseWithFunctions;
	} else {
		return data as NamespaceListResponse;
	}
}

async function getNamespace(namespaceId: number) {
	const response = await fetch(`${BASE_URL}/api/namespace/${namespaceId}`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	const data = (await response.json()) as OKResponse | ErrorResponse;
	return data;
}

async function createNamespace(name: string) {
	const response = await fetch(`${BASE_URL}/api/namespace`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify({ name }),
	});

	const data = (await response.json()) as CreateNamespaceResponse | ErrorResponse;
	return data;
}

async function updateNamespace(namespaceId: number, name?: string) {
	const response = await fetch(`${BASE_URL}/api/namespace/${namespaceId}`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify({ name }),
	});

	const data = (await response.json()) as OKResponse | ErrorResponse;
	return data;
}

async function deleteNamespace(namespaceId: number) {
	const response = await fetch(`${BASE_URL}/api/namespace/${namespaceId}`, {
		method: "DELETE",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	const data = (await response.json()) as OKResponse | ErrorResponse;
	return data;
}

async function renameNamespace(namespaceId: number, newName: string): Promise<OKResponse | ErrorResponse> {
	const response = await fetch(`${BASE_URL}/api/namespace/${namespaceId}`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify({ name: newName }),
	});

	const data = await response.json() as OKResponse | ErrorResponse;
	return data;
}

export { getNamespaces, getNamespace, createNamespace, updateNamespace, deleteNamespace, renameNamespace };
export type { OKResponse, ErrorResponse, NamespaceListResponse, CreateNamespaceResponse, NamespaceResponseWithFunctions };