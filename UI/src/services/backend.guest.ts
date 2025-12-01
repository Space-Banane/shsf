import { BASE_URL } from "..";

export interface GuestUser {
	id: number;
	displayName: string;
	email: string;
	permittedFunctions: number[];
	createdAt: string;
	updatedAt: string;
	activeSessions: number;
}

interface OKResponse<T = any> {
	status: "OK";
	[key: string]: any;
	data?: T;
}

interface ErrorResponse {
	status: number | string;
	message: string;
}

// Create a new guest user
export async function createGuestUser(params: {
	displayName: string;
	email: string;
	password: string;
}) {
	const response = await fetch(`${BASE_URL}/api/account/guest/create`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(params),
	});
	return (await response.json()) as
		| OKResponse<{ guest: GuestUser }>
		| ErrorResponse;
}

// List all guest users for the authenticated owner
export interface ListGuestUsersResult {
	guests: GuestUser[];
	error?: string;
}

export async function listGuestUsers(): Promise<ListGuestUsersResult> {
	const response = await fetch(`${BASE_URL}/api/account/guest/list`, {
		method: "GET",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
	});
	const json = await response.json();
	if (json.status === "OK" && Array.isArray(json.guests ?? json.data?.guests)) {
		// Support both { guests } and { data: { guests } }
		const guests = json.guests ?? json.data?.guests ?? [];
		return { guests };
	} else {
		return { guests: [], error: json.message || "Unknown error" };
	}
}

// Update a guest user (displayName, permittedFunctions, password)
export async function updateGuestUser(params: {
	id: number;
	displayName?: string;
	password?: string;
}) {
	const response = await fetch(`${BASE_URL}/api/account/guest/update`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(params),
	});
	return (await response.json()) as
		| OKResponse<{ guest: GuestUser }>
		| ErrorResponse;
}

// Delete a guest user
export async function deleteGuestUser(id: number) {
	const response = await fetch(`${BASE_URL}/api/account/guest/delete`, {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ id }),
	});
	return (await response.json()) as OKResponse | ErrorResponse;
}

// Assign a function to a guest user
export async function assignFunctionToGuest(
	guestId: number,
	functionId: number,
) {
	const response = await fetch(`${BASE_URL}/api/account/guest/assign-function`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ guestId, functionId }),
	});
	return (await response.json()) as OKResponse | ErrorResponse;
}

// Unassign a function from a guest user
export async function unassignFunctionFromGuest(
	guestId: number,
	functionId: number,
) {
	const response = await fetch(
		`${BASE_URL}/api/account/guest/unassign-function`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ guestId, functionId }),
		},
	);
	return (await response.json()) as OKResponse | ErrorResponse;
}

// Get function names for a list of function IDs (owned by the authenticated user)
export async function getFunctionNamesForGuest(functionIds: number[]) {
	const response = await fetch(`${BASE_URL}/api/account/guest/function-names`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ functionIds }),
	});
	return (await response.json()) as OKResponse<string[]> | ErrorResponse;
}

/**
 * List all guest users who have access to a specific function (owned by the authenticated user)
 */
export interface ListFunctionGuestsResult {
	guests: GuestUser[];
	error?: string;
}

export async function listFunctionGuests(
	functionId: number,
): Promise<ListFunctionGuestsResult> {
	const response = await fetch(
		`${BASE_URL}/api/account/guest/function/${functionId}`,
		{
			method: "GET",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
		},
	);
	const json = await response.json();
	if (json.status === "OK" && Array.isArray(json.data)) {
		return { guests: json.data };
	} else {
		return { guests: [], error: json.message || "Unknown error" };
	}
}

export interface GuestAuthenticateParams {
	email: string;
	password: string;
	namespaceId: number;
	functionExecId: string;
}

export interface GuestAuthenticateResponse {
	status: "OK";
	message: string;
}

export interface GuestAuthenticateError {
	status: string;
	message: string;
}

export async function authenticateGuestUser(
	params: GuestAuthenticateParams,
): Promise<GuestAuthenticateResponse | GuestAuthenticateError> {
	const response = await fetch(`${BASE_URL}/api/account/guest/authenticate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(params),
	});
	return await response.json();
}

// Clear all sessions for a guest user
export async function clearGuestSessions(guestId: number) {
	const response = await fetch(`${BASE_URL}/api/account/guest/clear-sessions`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ guestId }),
	});
	return (await response.json()) as OKResponse | ErrorResponse;
}
