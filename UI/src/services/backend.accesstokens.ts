import { BASE_URL } from "..";

export async function generateAccessToken(
	name: string,
	purpose?: string,
	expires_in?: number | null,
) {
	const response = await fetch(`${BASE_URL}/api/account/accesstoken/generate`, {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ name, purpose, expires_in }),
	});
	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(
			error.message || `Failed to generate access token: ${response.status}`,
		);
	}
	return await response.json();
}

export async function revokeAccessToken(id: number) {
	const response = await fetch(`${BASE_URL}/api/account/accesstoken/revoke`, {
		method: "DELETE",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ id }),
	});
	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(
			error.message ||
				`Failed to revoke access token (status: ${response.status})`,
		);
	}
	return await response.json();
}

export async function listAccessTokens() {
	const response = await fetch(`${BASE_URL}/api/account/accesstoken/list`, {
		method: "GET",
		credentials: "include",
	});
	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(
			error.message || `Failed to list access tokens (status: ${response.status})`,
		);
	}
	return (await response.json()).tokens;
}

export async function updateAccessToken(
	id: number,
	name?: string,
	purpose?: string | null,
) {
	const response = await fetch(`${BASE_URL}/api/account/accesstoken/update`, {
		method: "PATCH",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ id, name, purpose }),
	});
	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(
			error.message ||
				`Failed to update access token (status: ${response.status})`,
		);
	}
	return await response.json();
}
