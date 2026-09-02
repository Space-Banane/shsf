import { BASE_URL } from "..";
import { FunctionFile, FunctionFolder } from "../types/Prisma";

interface OKResponse {
	status: "OK";
	message: string;
}
interface ErrorResponse {
	status: number;
	message: string;
}

interface FileListResponse {
	status: "OK";
	data: FunctionFile[];
}

interface CreateOrUpdateFileResponse {
	status: "OK";
	data: FunctionFile;
}

interface FolderListResponse {
	status: "OK";
	data: FunctionFolder[];
}

async function getFiles(functionId: number) {
	const response = await fetch(
		`${BASE_URL}/api/function/${functionId}/files`,
		{
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
		},
	);

	const data = (await response.json()) as FileListResponse | ErrorResponse;
	return data;
}

async function createOrUpdateFile(
	functionId: number,
	file: { filename: string; code: string },
) {
	const response = await fetch(
		`${BASE_URL}/api/function/${functionId}/file`,
		{
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify(file),
		},
	);

	const data = (await response.json()) as
		CreateOrUpdateFileResponse | ErrorResponse;
	return data;
}

async function deleteFile(functionId: number, fileId: number) {
	const response = await fetch(
		`${BASE_URL}/api/function/${functionId}/file/${fileId}`,
		{
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
		},
	);

	const data = (await response.json()) as OKResponse | ErrorResponse;
	return data;
}

async function getFolders(functionId: number) {
	const response = await fetch(
		`${BASE_URL}/api/function/${functionId}/folders`,
		{
			method: "GET",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
		},
	);
	return (await response.json()) as FolderListResponse | ErrorResponse;
}

async function createFolder(functionId: number, name: string) {
	const response = await fetch(
		`${BASE_URL}/api/function/${functionId}/folder`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ name }),
		},
	);
	return (await response.json()) as
		{ status: "OK"; data: FunctionFolder } | ErrorResponse;
}

async function renameFolder(functionId: number, name: string, newName: string) {
	const response = await fetch(
		`${BASE_URL}/api/function/${functionId}/folder`,
		{
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ name, newName }),
		},
	);
	return (await response.json()) as OKResponse | ErrorResponse;
}

async function deleteFolder(functionId: number, name: string) {
	const response = await fetch(
		`${BASE_URL}/api/function/${functionId}/folder`,
		{
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ name }),
		},
	);
	return (await response.json()) as OKResponse | ErrorResponse;
}

async function renameFile(
	functionId: number,
	fileId: number,
	newFilename: string,
) {
	const response = await fetch(
		`${BASE_URL}/api/function/${functionId}/file/${fileId}/rename`,
		{
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify({ newFilename }),
		},
	);

	const data = (await response.json()) as OKResponse | ErrorResponse;
	return data;
}

async function loadDefaultContent(
	functionId: number,
	fileId: number,
	defaultToLoad: string,
) {
	const response = await fetch(
		`${BASE_URL}/api/function/${functionId}/file/${fileId}/load-fill_default`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify({ defaultToLoad }),
		},
	);

	const data = (await response.json()) as
		CreateOrUpdateFileResponse | ErrorResponse;
	return data;
}

interface DefaultTemplate {
	id: string;
	name: string;
	language: string;
	description: string;
}

async function loadPossibleDefaults() {
	const response = await fetch(`${BASE_URL}/api/function-fill-defaults`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	const data = (await response.json()) as
		{ status: "OK"; defaults: DefaultTemplate[] } | ErrorResponse;
	return data;
}

export {
	getFiles,
	getFolders,
	createOrUpdateFile,
	createFolder,
	deleteFile,
	deleteFolder,
	renameFile,
	renameFolder,
	loadDefaultContent,
	loadPossibleDefaults,
};
export type {
	OKResponse,
	ErrorResponse,
	FileListResponse,
	CreateOrUpdateFileResponse,
	FolderListResponse,
	DefaultTemplate,
};
