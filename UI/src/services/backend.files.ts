import { BASE_URL } from "..";
import { FunctionFile } from "../types/Prisma";

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

async function getFiles(functionId: number) {
	const response = await fetch(`${BASE_URL}/api/function/${functionId}/files`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	const data = (await response.json()) as FileListResponse | ErrorResponse;
	return data;
}

async function createOrUpdateFile(functionId: number, file: { filename: string; code: string }) {
	const response = await fetch(`${BASE_URL}/api/function/${functionId}/file`, {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify(file),
	});

	const data = (await response.json()) as CreateOrUpdateFileResponse | ErrorResponse;
	return data;
}

async function deleteFile(functionId: number, fileId: number) {
	const response = await fetch(`${BASE_URL}/api/function/${functionId}/file/${fileId}`, {
		method: "DELETE",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	const data = (await response.json()) as OKResponse | ErrorResponse;
	return data;
}

async function renameFile(functionId: number, fileId: number, newFilename: string) {
	const response = await fetch(`${BASE_URL}/api/function/${functionId}/file/${fileId}/rename`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify({ newFilename }),
	});

	const data = (await response.json()) as OKResponse | ErrorResponse;
	return data;
}


export { getFiles, createOrUpdateFile, deleteFile, renameFile };
export type { OKResponse, ErrorResponse, FileListResponse, CreateOrUpdateFileResponse };
