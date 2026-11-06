import { BASE_URL } from "..";
import type { Access, SharePermission } from "../types/Prisma";
import { apiFetch, type ApiFailure } from "./api";

export type ShareResourceType = "namespace" | "function" | "storage";

export interface Share {
	id: number;
	permission: SharePermission;
	createdAt: string;
	user: { id: number; displayName: string; email: string } | null;
	group: { id: number; name: string } | null;
}

export interface GroupOption {
	id: number;
	name: string;
	description: string | null;
}

export interface AdminGroup extends GroupOption {
	ssoProvider: string | null;
	ssoGroupId: string | null;
	members: { source: "local" | "sso"; user: { id: number; displayName: string; email: string } }[];
	_count: { shares: number };
}

export interface AuditEntry {
	id: number;
	actorId: number | null;
	action: string;
	targetType: string;
	targetId: number | null;
	details: unknown;
	createdAt: string;
}

type Ok<T> = { status: "OK"; data: T };
type Result<T> = Ok<T> | ApiFailure;

const RANK: Record<Access, number> = { view: 1, execute: 2, edit: 3, owner: 4 };

/** Treats a missing access field (older backend, own resource) as owner. */
export function can(access: Access | undefined, need: Access): boolean {
	return RANK[access ?? "owner"] >= RANK[need];
}

export const PERMISSIONS: Record<ShareResourceType, SharePermission[]> = {
	namespace: ["view", "execute", "edit"],
	function: ["view", "execute", "edit"],
	storage: ["view", "edit"],
};

async function call<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
	const response = await apiFetch(`${BASE_URL}${path}`, {
		...init,
		headers: { "Content-Type": "application/json" },
		credentials: "include",
	});
	return response.json();
}

export const listShares = (type: ShareResourceType, id: number) => call<Share[]>(`/api/shares/${type}/${id}`);

export const addShare = (
	type: ShareResourceType,
	id: number,
	body: { email?: string; groupId?: number; permission: SharePermission },
) => call<Share>(`/api/shares/${type}/${id}`, { method: "POST", body: JSON.stringify(body) });

export const revokeShare = (type: ShareResourceType, id: number, shareId: number) =>
	call<undefined>(`/api/shares/${type}/${id}/${shareId}`, { method: "DELETE" });

export const listShareableGroups = () => call<GroupOption[]>("/api/groups");

export const listAdminGroups = () => call<AdminGroup[]>("/api/admin/groups");

export const createGroup = (body: { name: string; description?: string | null; ssoProvider?: string | null; ssoGroupId?: string | null }) =>
	call<AdminGroup>("/api/admin/groups", { method: "POST", body: JSON.stringify(body) });

export const deleteGroup = (id: number) => call<undefined>(`/api/admin/groups/${id}`, { method: "DELETE" });

export const addGroupMember = (id: number, email: string) =>
	call<undefined>(`/api/admin/groups/${id}/members`, { method: "POST", body: JSON.stringify({ email }) });

export const removeGroupMember = (id: number, userId: number) =>
	call<undefined>(`/api/admin/groups/${id}/members/${userId}`, { method: "DELETE" });

export const listAudit = () => call<AuditEntry[]>("/api/admin/audit");
