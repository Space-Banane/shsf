import { BASE_URL } from "..";
import { Image, XFunction } from "../types/Prisma";

interface OKResponse {
	status: "OK";
	message: string;
}
interface ErrorResponse {
	status: number;
	message: string;
}

interface CreateFunctionResponse {
	status: "OK";
	data: {
		id: number;
	};
}

interface FunctionListResponse {
	status: "OK";
	data: {
		namespace: {
			name: string;
			id: number;
		};
	} & XFunction[];
}

interface getFunctionByIdOkResponse {
	status: "OK";
	data: XFunction & {
		namespace: {
			name: string;
			id: number;
		};
	};
}

interface UpdateFunctionResponse {
	status: "OK";
	data:XFunction
}

interface ExecuteFunctionResponse {
	status: "OK";
	data: {
		output:string;
		exitCode:any; // TODO: Add a propper type
		raw:string
	};
}

interface ExecuteFunctionErrorResponse {
	status: number;
	message: string;
	error?: string;
}

async function createFunction(config: {
	name: string;
	description: string;
	image: Image;
	startup_file?: string;
	settings?: {
		max_ram?: number;
		timeout?: number;
		allow_http?: boolean;
		secure_header?: string;
		priority?: number;
		tags?: string[];
		retry_on_failure?: boolean;
		retry_count?: number;
	};
	environment?: {
		name: string;
		value: string;
	}[];
	namespaceId: number;
}) {
	const response = await fetch(`${BASE_URL}/api/function`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify(config),
	});

	const data = await response.json() as CreateFunctionResponse | ErrorResponse;
	return data;
}

async function deleteFunction(id: number) {
	const response = await fetch(`${BASE_URL}/api/function/${id}`, {
		method: "DELETE",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	const data = await response.json() as OKResponse | ErrorResponse;
	return data;
}

async function getFunctions(include_functions: boolean = false) {
	const response = await fetch(`${BASE_URL}/api/functions?include_functions=${include_functions}`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	const data = (await response.json()) as FunctionListResponse | ErrorResponse;
	return data;
}

async function getFunctionById(id: number) {
	const response = await fetch(`${BASE_URL}/api/function/${id}`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	const data = await response.json() as getFunctionByIdOkResponse | ErrorResponse
	return data;
}

async function updateFunction(id: number, newdata: {
	name?: string;
	description?: string;
	image?: Image;
	startup_file?: string;
	settings?: {
		max_ram?: number;
		timeout?: number;
		allow_http?: boolean;
		secure_header?: string | null;
		priority?: number;
		tags?: string[];
		retry_on_failure?: boolean;
		retry_count?: number;
	};
	environment?: {
		name: string;
		value: string;
	}[];
}) {
	const response = await fetch(`${BASE_URL}/api/function/${id}`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify(newdata),
	});

	const data = await response.json() as UpdateFunctionResponse | ErrorResponse;
	return data;
}

async function executeFunction(id: number, data?: any) {
	try {
		const response = await fetch(`${BASE_URL}/api/function/${id}/execute?stream=false`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: data ? JSON.stringify(data) : undefined,
		});
		return await response.json();
	} catch (error) {
		console.error("Error executing function:", error);
		throw error;
	}
}

async function executeFunctionStreaming(id: number, onChunk: (data: any) => void, data?: any) {
	try {
		const response = await fetch(`${BASE_URL}/api/function/${id}/execute?stream=true`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: data ? JSON.stringify(data) : undefined,
		});

		if (!response.body) {
			throw new Error("ReadableStream not supported in this browser.");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";

		while (true) {
			const { value, done } = await reader.read();
			if (done) break;

			const text = decoder.decode(value);
			buffer += text;

			// Process complete JSON objects
			let startIndex = 0;
			let endIndex = buffer.indexOf("}{");

			while (endIndex !== -1) {
				// Process the JSON object
				try {
					const jsonString = buffer.substring(startIndex, endIndex + 1);
					const data = JSON.parse(jsonString);
					onChunk(data);
				} catch (e) {
					console.error("Error parsing JSON:", e);
				}

				// Move to the next JSON object
				startIndex = endIndex + 1;
				endIndex = buffer.indexOf("}{", startIndex);
			}

			try {
				// Process any remaining complete JSON
				if (startIndex < buffer.length) {
					const jsonString = buffer.substring(startIndex);
					const data = JSON.parse(jsonString);
					onChunk(data);
					buffer = "";
				}
			} catch (e) {
				// Incomplete JSON, keep in buffer
				buffer = buffer.substring(startIndex);
			}
		}
	} catch (error) {
		console.error("Error streaming function execution:", error);
		throw error;
	}
}

export { createFunction, deleteFunction, getFunctions, getFunctionById, updateFunction, executeFunction, executeFunctionStreaming };
export type { OKResponse, ErrorResponse };
export type { CreateFunctionResponse, FunctionListResponse, getFunctionByIdOkResponse, UpdateFunctionResponse, ExecuteFunctionResponse, ExecuteFunctionErrorResponse };