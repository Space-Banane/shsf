import { BASE_URL } from "..";

export type LinkStatus =
	| { linked: true; global_user_email: string }
	| { linked: false };

// --- Link status (who is linked right now) ---

export async function getLinkStatus(): Promise<
	{ status: "OK" } & LinkStatus
> {
	const res = await fetch(`${BASE_URL}/api/global/link-status`, {
		credentials: "include",
	});
	return res.json();
}

// --- Linkable (is the instance open for new links) ---

export async function getLinkable(): Promise<{
	status: "OK";
	linkable: boolean;
}> {
	const res = await fetch(`${BASE_URL}/api/global/linkable`, {
		credentials: "include",
	});
	return res.json();
}

// --- Link ---

export async function linkInstance(
	secret: string,
	email: string,
): Promise<{ status: "OK" | "FAILED"; message: string }> {
	const res = await fetch(`${BASE_URL}/api/global/link`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ secret, email }),
	});
	return res.json();
}

// --- Unlink ---

export async function unlinkInstance(
	email: string,
	instance_id: string,
): Promise<{ status: "OK" | "FAILED"; message: string }> {
	const res = await fetch(`${BASE_URL}/api/global/unlink`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, instance_id }),
	});
	return res.json();
}

// --- Link lock ---

export async function getLinkLock(): Promise<{
	status: "OK";
	locked: boolean;
}> {
	const res = await fetch(`${BASE_URL}/api/global/link-lock`, {
		credentials: "include",
	});
	return res.json();
}

export async function setLinkLock(
	locked: boolean,
): Promise<{ status: "OK"; locked: boolean }> {
	const res = await fetch(`${BASE_URL}/api/global/link-lock`, {
		method: "PATCH",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ locked }),
	});
	return res.json();
}

// --- UUID ---

export async function getInstanceUUID(): Promise<{
	status: "OK";
	uuid: string;
}> {
	const res = await fetch(`${BASE_URL}/api/global/uuid`, {
		credentials: "include",
	});
	return res.json();
}

// --- Registration disabled ---

export async function getRegistrationDisabled(): Promise<{
	status: "OK";
	disabled: boolean;
}> {
	const res = await fetch(`${BASE_URL}/api/global/registration-disabled`, {
		credentials: "include",
	});
	return res.json();
}

export async function setRegistrationDisabled(
	disabled: boolean,
): Promise<{ status: "OK"; disabled: boolean }> {
	const res = await fetch(`${BASE_URL}/api/global/registration-disabled`, {
		method: "PATCH",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ disabled }),
	});
	return res.json();
}
