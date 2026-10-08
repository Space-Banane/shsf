import { BASE_URL } from "..";
import { Image, TriggerLog, XFunction } from "../types/Prisma";
import { apiFetch, type ApiFailure } from "./api";

const fetch = apiFetch;

interface OKResponse {
	status: "OK";
	message: string;
}
type ErrorResponse = ApiFailure;

interface CreateFunctionResponse {
	status: "OK";
	data: {
		id: number;
	};
}

interface FunctionListResponse {
	status: "OK";
	data: Array<{
		namespace: {
			name: string;
			id: number;
		};
	} & XFunction>;
	pagination?: { page: number; limit: number; total: number; totalPages: number };
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
	data: XFunction;
}

interface ExecuteFunctionResponse {
	status: "OK";
	data: {
		output: string;
		exitCode: number;
		raw: string;
	};
}

interface ExecuteFunctionErrorResponse {
	status: number;
	message: string;
	error?: string;
}

interface getFunctionLogsOK {
	status: "OK";
	data: TriggerLog[];
}

async function createFunction(config: {
	name: string;
	description: string;
	image: Image;
	startup_file?: string;
	docker_mount?: boolean;
	network_restricted?: boolean;
	ffmpeg_install?: boolean;
	opencv_install?: boolean;
	settings?: {
		max_ram?: number;
		timeout?: number;
		allow_http?: boolean;
		secure_header?: string;
		tags?: string[];
		retry_on_failure?: boolean;
		retry_count?: number;
	};
	environment?: {
		name: string;
		value: string;
	}[];
	namespaceId: number;
	cors_origins?: string;
	executionAlias?: string;
	imported?: boolean;
	ai_kicked_off?: boolean;
}) {
	const response = await fetch(`${BASE_URL}/api/function`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify(config),
	});

	const data = (await response.json()) as CreateFunctionResponse | ErrorResponse;
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

	const data = (await response.json()) as OKResponse | ErrorResponse;
	return data;
}


interface FunctionListOptions {
	page?: number;
	limit?: number;
	search?: string;
	namespaceId?: number;
	runtime?: string;
	tag?: string;
	status?: "all" | "never-run" | "has-run";
	sort?: "name" | "createdAt" | "lastRun";
	order?: "asc" | "desc";
}

async function getFunctions(include_functions: boolean = false, options: FunctionListOptions = {}) {
	const params = new URLSearchParams({ include_functions: String(include_functions) });
	if (options.page) params.set("page", String(options.page));
	if (options.limit) params.set("limit", String(options.limit));
	if (options.search?.trim()) params.set("search", options.search.trim());
	if (options.namespaceId) params.set("namespace_id", String(options.namespaceId));
	if (options.runtime) params.set("runtime", options.runtime);
	if (options.tag) params.set("tag", options.tag);
	if (options.status && options.status !== "all") params.set("status", options.status);
	if (options.sort) params.set("sort", options.sort);
	if (options.order) params.set("order", options.order);
	const response = await fetch(
		`${BASE_URL}/api/functions?${params.toString()}`,
		{
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
		},
	);

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

	const data = (await response.json()) as
		| getFunctionByIdOkResponse
		| ErrorResponse;
	return data;
}

async function getLogsByFuncId(id: number) {
	const response = await fetch(`${BASE_URL}/api/function/${id}/logs`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	const data = (await response.json()) as getFunctionLogsOK | ErrorResponse;
	return data;
}

async function updateFunction(
	id: number,
	newdata: {
		name?: string;
		description?: string;
		image?: Image;
		startup_file?: string;
		docker_mount?: boolean;
		network_restricted?: boolean;
		ffmpeg_install?: boolean;
		opencv_install?: boolean;
		imported?: boolean;
		ai_kicked_off?: boolean;
		namespaceId?: number;
		settings?: {
			max_ram?: number;
			timeout?: number;
			allow_http?: boolean;
			secure_header?: string | null;
			tags?: string[];
			retry_on_failure?: boolean;
			retry_count?: number;
			cache_enabled?: boolean;
			cache_ttl?: number;
		};
		environment?: {
			name: string;
			value: string;
		}[];
		cors_origins?: string;
		executionAlias?: string;
	},
) {
	const response = await fetch(`${BASE_URL}/api/function/${id}`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify(newdata),
	});

	const data = (await response.json()) as UpdateFunctionResponse | ErrorResponse;
	return data;
}

async function executeFunction(id: number, data?: any) {
	try {
		const response = await fetch(
			`${BASE_URL}/api/function/${id}/execute?stream=false`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: data ? JSON.stringify(data) : undefined,
				timeoutMs: 15 * 60_000,
			},
		);
		return await response.json();
	} catch (error) {
		console.error("Error executing function:", error);
		throw error;
	}
}

async function installDependencies(
	id: number,
): Promise<OKResponse | ErrorResponse> {
	const response = await fetch(`${BASE_URL}/api/function/${id}/pip-install`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		timeoutMs: 10 * 60_000,
	});
	return await response.json();
}

async function reinstallFfmpeg(
	id: number,
): Promise<OKResponse | string | undefined> {
	try {
		const response = await fetch(
			`${BASE_URL}/api/function/${id}/reinstall-ffmpeg`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				timeoutMs: 10 * 60_000,
			},
		);
		const data = await response.json();
		if (data.status !== "OK") {
			return data.message || "Failed to trigger FFmpeg reinstall";
		}
		return data;
	} catch (error) {
		console.error("Error reinstalling FFmpeg:", error);
	}
}

async function reinstallOpencv(
	id: number,
): Promise<OKResponse | string | undefined> {
	try {
		const response = await fetch(
			`${BASE_URL}/api/function/${id}/reinstall-opencv`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				timeoutMs: 10 * 60_000,
			},
		);
		const data = await response.json();
		if (data.status !== "OK") {
			return data.message || "Failed to trigger OpenCV reinstall";
		}
		return data;
	} catch (error) {
		console.error("Error reinstalling OpenCV:", error);
	}
}

async function executeFunctionStreaming(
	id: number,
	onChunk: (data: any) => void,
	data?: any,
) {
	try {
		const response = await fetch(
			`${BASE_URL}/api/function/${id}/execute?stream=true`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: data ? JSON.stringify(data) : undefined,
				timeoutMs: 15 * 60_000,
				rawResponse: true,
			},
		);

		if (!response.ok) {
			const failure = await response.json();
			onChunk({
				type: "error",
				code: failure.code,
				error: failure.message,
			});
			return;
		}

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

async function getFunctionCorsOrigins(id: number) {
	const response = await fetch(`${BASE_URL}/api/function/${id}/cors-origins`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});
	return await response.json();
}

async function updateFunctionCorsOrigins(id: number, cors_origins: string) {
	const response = await fetch(`${BASE_URL}/api/function/${id}/cors-origins`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify({ cors_origins }),
	});
	return await response.json();
}

async function cloneFunction(
	id: number,
	config?: { name?: string; namespaceId?: number },
) {
	const response = await fetch(`${BASE_URL}/api/function/${id}/clone`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify(config || {}),
	});

	return await response.json();
}

// ─── Git Version Control ──────────────────────────────────────────────────────

async function getGitConfig(id: number) {
	const response = await fetch(`${BASE_URL}/api/function/${id}/git`, {
		method: "GET",
		credentials: "include",
	});
	return (await response.json()) as
		| {
				status: "OK";
				data: {
					git_url: string | null;
					git_username: string | null;
					git_has_credentials: boolean;
					git_periodic_pull: boolean;
					git_pull_interval: number;
					git_source_dir: string | null;
					git_branch: string | null;
				};
		  }
		| { status: number; message: string };
}

async function gitClone(
	id: number,
	git_url: string,
	git_username?: string,
	git_password?: string,
	git_source_dir?: string,
	git_branch?: string,
) {
	const response = await fetch(`${BASE_URL}/api/function/${id}/git/clone`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({
			git_url,
			git_username: git_username || undefined,
			git_password: git_password || undefined,
			git_source_dir: git_source_dir || undefined,
			git_branch: git_branch || undefined,
		}),
		timeoutMs: 5 * 60_000,
	});
	return (await response.json()) as
		| { status: "OK"; message: string; logs: string }
		| { status: "FAILED"; message: string; logs: string }
		| { status: number; message: string };
}

async function gitPull(id: number) {
	const response = await fetch(`${BASE_URL}/api/function/${id}/git/pull`, {
		method: "POST",
		credentials: "include",
		timeoutMs: 5 * 60_000,
	});
	return (await response.json()) as
		| { status: "OK"; message: string; logs: string }
		| { status: "FAILED"; message: string; logs: string }
		| { status: number; message: string };
}

async function updateGitSettings(
	id: number,
	git_periodic_pull?: boolean,
	git_username?: string | null,
	git_password?: string | null,
	git_pull_interval?: number,
	git_source_dir?: string | null,
	git_branch?: string | null,
) {
	const response = await fetch(`${BASE_URL}/api/function/${id}/git`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({
			...(git_periodic_pull !== undefined && { git_periodic_pull }),
			...(git_username !== undefined && { git_username }),
			...(git_password !== undefined && { git_password }),
			...(git_pull_interval !== undefined && { git_pull_interval }),
			...(git_source_dir !== undefined && { git_source_dir }),
			...(git_branch !== undefined && { git_branch }),
		}),
	});
	return (await response.json()) as { status: "OK" | number; message: string };
}

async function getGitBranches(
	id: number,
	git_url: string,
	git_username?: string,
	git_password?: string,
) {
	const response = await fetch(`${BASE_URL}/api/function/${id}/git/branches`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({
			git_url,
			git_username: git_username || undefined,
			git_password: git_password || undefined,
		}),
		timeoutMs: 2 * 60_000,
	});
	return (await response.json()) as
		| { status: "OK"; data: string[] }
		| { status: number; message: string };
}

async function getGitTree(
	id: number,
	git_url: string,
	git_username?: string,
	git_password?: string,
	git_branch?: string,
) {
	const response = await fetch(`${BASE_URL}/api/function/${id}/git/tree`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({
			git_url,
			git_username: git_username || undefined,
			git_password: git_password || undefined,
			git_branch: git_branch || undefined,
		}),
		timeoutMs: 2 * 60_000,
	});
	return (await response.json()) as
		| { status: "OK"; data: string[] }
		| { status: number; message: string };
}

async function removeGitCredentials(id: number) {
	const response = await fetch(`${BASE_URL}/api/function/${id}/git`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ git_username: null, git_password: null }),
	});
	return await response.json() as { status: "OK" | number; message: string };
}

async function removeGitConfig(id: number) {
	const response = await fetch(`${BASE_URL}/api/function/${id}/git`, {
		method: "DELETE",
		credentials: "include",
	});
	return await response.json() as { status: "OK" | number; message: string };
}

async function massReplace(find: string, replace: string) {
	const response = await fetch(`${BASE_URL}/api/functions/replace`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify({ find, replace }),
		timeoutMs: 2 * 60_000,
	});

	const data = (await response.json()) as OKResponse | ErrorResponse;
	return data;
}

async function getMassReplaceFindings(find: string, replace: string) {
	const response = await fetch(`${BASE_URL}/api/functions/replace/findings`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify({ find, replace }),
		timeoutMs: 2 * 60_000,
	});

	const data = (await response.json()) as
		| {
				status: "OK";
				data: {
					fileId: number;
					fileName: string;
					functionName: string;
					matches: {
						lineNumber: number;
						oldLine: string;
						newLine: string;
					}[];
				}[];
		  }
		| ErrorResponse;
	return data;
}

async function isFunctionImageDeprecated(functionId: number): Promise<boolean> {
	const response = await fetch(
		`${BASE_URL}/api/function/${functionId}/isDeprecated`,
		{
			method: "GET",
			credentials: "include",
		},
	);
	const data = await response.json();
	return data.data.isDeprecated;
}

async function getDeprecatedImages() {
	const response = await fetch(`${BASE_URL}/api/function/deprecatedImages`, {
		method: "GET",
		credentials: "include"
	});
	const data = await response.json();
	return data.data as string[];
}

export {
	createFunction,
	deleteFunction,
	getFunctions,
	getFunctionById,
	updateFunction,
	executeFunction,
	executeFunctionStreaming,
	getLogsByFuncId,
	installDependencies,
	reinstallFfmpeg,
	reinstallOpencv,
	getFunctionCorsOrigins,
	updateFunctionCorsOrigins,
	cloneFunction,
	getGitConfig,
	gitClone,
	gitPull,
	updateGitSettings,
	removeGitCredentials,
	removeGitConfig,
	getGitBranches,
	getGitTree,
	massReplace,
	getMassReplaceFindings,
	isFunctionImageDeprecated,
	getDeprecatedImages,
};
export type { OKResponse, ErrorResponse };
export type {
	CreateFunctionResponse,
	FunctionListResponse,
	FunctionListOptions,
	getFunctionByIdOkResponse,
	UpdateFunctionResponse,
	ExecuteFunctionResponse,
	ExecuteFunctionErrorResponse,
};
