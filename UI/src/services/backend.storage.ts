import { BASE_URL } from "..";

export interface Storage {
	id: number;
	name: string;
	purpose: string;
	user: number;
}

export interface StorageItem {
	id: number;
	key: string;
	value: unknown;
	expiresAt?: string | null;
	storageId: number;
}

interface OKResponse<T = any> {
	status: "OK";
	data: T;
}

interface ErrorResponse {
	status: number;
	message: string;
}

// Create a new storage
export async function createStorage(config: { name: string; purpose: string }) {
	const response = await fetch(`${BASE_URL}/api/storage`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(config),
	});
	return (await response.json()) as OKResponse<Storage> | ErrorResponse;
}

// List all storages for the user
export async function listStorages() {
	const response = await fetch(`${BASE_URL}/api/storage`, {
		method: "GET",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
	});
	return (await response.json()) as OKResponse<Storage[]> | ErrorResponse;
}

// Delete a storage by name
export async function deleteStorage(storageName: string) {
	const response = await fetch(
		`${BASE_URL}/api/storage/${encodeURIComponent(storageName)}`,
		{
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
		},
	);
	return (await response.json()) as OKResponse | ErrorResponse;
}

// Clear all items in a storage
export async function clearStorageItems(storageName: string) {
	const response = await fetch(
		`${BASE_URL}/api/storage/${encodeURIComponent(storageName)}/items`,
		{
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
		},
	);
	return (await response.json()) as OKResponse | ErrorResponse;
}

// Set (create/update) an item in storage
export async function setStorageItem(
	storageName: string,
	item: { key: string; value: any; expiresAt?: string | number },
) {
	const response = await fetch(
		`${BASE_URL}/api/storage/${encodeURIComponent(storageName)}/item`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify(item),
		},
	);
	return (await response.json()) as OKResponse<StorageItem> | ErrorResponse;
}

// Get an item by key from storage
export async function getStorageItem(storageName: string, key: string) {
	const response = await fetch(
		`${BASE_URL}/api/storage/${encodeURIComponent(
			storageName,
		)}/item/${encodeURIComponent(key)}`,
		{
			method: "GET",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
		},
	);
	return (await response.json()) as OKResponse<StorageItem> | ErrorResponse;
}

// List all items in a storage
export async function listStorageItems(storageName: string) {
	const response = await fetch(
		`${BASE_URL}/api/storage/${encodeURIComponent(storageName)}/items`,
		{
			method: "GET",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
		},
	);
	return (await response.json()) as OKResponse<StorageItem[]> | ErrorResponse;
}

// Delete an item by key from storage
export async function deleteStorageItem(storageName: string, key: string) {
	const response = await fetch(
		`${BASE_URL}/api/storage/${encodeURIComponent(
			storageName,
		)}/item/${encodeURIComponent(key)}`,
		{
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
		},
	);
	return (await response.json()) as OKResponse | ErrorResponse;
}
