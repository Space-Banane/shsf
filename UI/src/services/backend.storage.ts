import { BASE_URL } from "..";
import { apiFetch, type ApiFailure } from "./api";
import type { Access, ResourceOwner } from "../types/Prisma";

const fetch = apiFetch;

export interface Storage {
	id: number;
	name: string;
	purpose: string;
	user: number;
	access?: Access;
	shared?: boolean;
	owner?: ResourceOwner;
}

/** Storage names are unique per owner; `?owner=` addresses one shared with you. */
type StorageRef = Pick<Storage, "name" | "user" | "shared">;
function storageUrl(storage: StorageRef, suffix = "") {
	const owner = storage.shared ? `?owner=${storage.user}` : "";
	return `${BASE_URL}/api/storage/${encodeURIComponent(storage.name)}${suffix}${owner}`;
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

type ErrorResponse = ApiFailure;

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
export async function deleteStorage(storage: StorageRef) {
	const response = await fetch(
		storageUrl(storage),
		{
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
		},
	);
	return (await response.json()) as OKResponse | ErrorResponse;
}

// Clear all items in a storage
export async function clearStorageItems(storage: StorageRef) {
	const response = await fetch(
		storageUrl(storage, "/items"),
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
	storage: StorageRef,
	item: { key: string; value: any; expiresAt?: string | number },
) {
	const response = await fetch(
		storageUrl(storage, "/item"),
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
export async function getStorageItem(storage: StorageRef, key: string) {
	const response = await fetch(
		storageUrl(storage, `/item/${encodeURIComponent(key)}`),
		{
			method: "GET",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
		},
	);
	return (await response.json()) as OKResponse<StorageItem> | ErrorResponse;
}

// List all items in a storage
export async function listStorageItems(storage: StorageRef) {
	const response = await fetch(
		storageUrl(storage, "/items"),
		{
			method: "GET",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
		},
	);
	return (await response.json()) as OKResponse<StorageItem[]> | ErrorResponse;
}

// Delete an item by key from storage
export async function deleteStorageItem(storage: StorageRef, key: string) {
	const response = await fetch(
		storageUrl(storage, `/item/${encodeURIComponent(key)}`),
		{
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
		},
	);
	return (await response.json()) as OKResponse | ErrorResponse;
}
