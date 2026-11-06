import type { Prisma, SharePermission } from "@prisma/client";
import { prisma } from "..";
import { createLogger } from "./logger";

const log = createLogger("SHARING");

// Effective access to a resource. Ordered: each level includes the ones below.
// "owner" is never granted; it is reserved for the resource's owning user.
export type Access = SharePermission | "owner";
export type ShareResourceType = "namespace" | "function" | "storage";

const RANK: Record<Access, number> = { view: 1, execute: 2, edit: 3, owner: 4 };
const PERMISSIONS: SharePermission[] = ["view", "execute", "edit"];

export const RESOURCE_PERMISSIONS: Record<ShareResourceType, SharePermission[]> = {
	namespace: ["view", "execute", "edit"],
	function: ["view", "execute", "edit"],
	storage: ["view", "edit"],
};

export function hasAccess(access: Access | null, need: Access): boolean {
	return access !== null && RANK[access] >= RANK[need];
}

/** Highest permission among grants; null when there are none. */
export function maxPermission(permissions: SharePermission[]): SharePermission | null {
	return permissions.reduce<SharePermission | null>(
		(best, p) => (best === null || RANK[p] > RANK[best] ? p : best),
		null,
	);
}

/** Grants that reach `userId` directly or through any group they belong to. */
export function recipientWhere(userId: number): Prisma.ResourceShareWhereInput {
	return { OR: [{ userId }, { group: { members: { some: { userId } } } }] };
}

function grantWhere(userId: number, need: SharePermission): Prisma.ResourceShareWhereInput {
	return {
		...recipientWhere(userId),
		permission: { in: PERMISSIONS.filter((p) => RANK[p] >= RANK[need]) },
	};
}

// Where-fragments are the single authorization source for every read and write:
// a row matches only if the user owns it or holds a grant of at least `need`.
// Each is wrapped in `AND` so it can be spread next to a sibling `OR` (search)
// without one silently overwriting the other.

/** Functions: owned, shared directly, or inherited from a shared namespace. */
export function functionAccessWhere(userId: number, need: Access): Prisma.FunctionWhereInput {
	if (need === "owner") return { userId };
	const grant = grantWhere(userId, need);
	return {
		AND: [{ OR: [{ userId }, { shares: { some: grant } }, { namespace: { shares: { some: grant } } }] }],
	};
}

export function namespaceAccessWhere(userId: number, need: Access): Prisma.NamespaceWhereInput {
	if (need === "owner") return { userId };
	return { AND: [{ OR: [{ userId }, { shares: { some: grantWhere(userId, need) } }] }] };
}

/** Storage is owned per user; namespace shares never grant storage. */
export function storageAccessWhere(userId: number, need: Access): Prisma.FunctionStorageWhereInput {
	if (need === "owner") return { user: userId };
	return { AND: [{ OR: [{ user: userId }, { shares: { some: grantWhere(userId, need) } }] }] };
}

const ownerSelect = { select: { id: true, displayName: true, email: true } } as const;
const grantSelect = (userId: number) => ({ where: recipientWhere(userId), select: { permission: true } });

/** Prisma include that lets `describeFunctionAccess` compute the caller's access. */
export function functionAccessInclude(userId: number) {
	return {
		user: ownerSelect,
		shares: grantSelect(userId),
		namespace: { select: { id: true, name: true, shares: grantSelect(userId) } },
	} satisfies Prisma.FunctionInclude;
}

export function namespaceAccessInclude(userId: number) {
	return { user: ownerSelect, shares: grantSelect(userId) } satisfies Prisma.NamespaceInclude;
}

export function storageAccessInclude(userId: number) {
	return { userRel: ownerSelect, shares: grantSelect(userId) } satisfies Prisma.FunctionStorageInclude;
}

type Owner = { id: number; displayName: string; email: string };
type Grants = { permission: SharePermission }[];

/** Replace raw grant rows with `access`, `shared` and `owner` for API responses. */
export function describeFunctionAccess<
	T extends { userId: number; user: Owner; shares: Grants; namespace: { id: number; name: string; shares: Grants } },
>(userId: number, fn: T) {
	const { user, shares, namespace, ...rest } = fn;
	const access: Access =
		fn.userId === userId
			? "owner"
			: (maxPermission([...shares, ...namespace.shares].map((s) => s.permission)) ?? "view");
	return {
		...rest,
		namespace: { id: namespace.id, name: namespace.name },
		access,
		shared: access !== "owner",
		owner: user,
	};
}

export function describeNamespaceAccess<T extends { userId: number; user: Owner; shares: Grants }>(
	userId: number,
	ns: T,
) {
	const { user, shares, ...rest } = ns;
	const access: Access =
		ns.userId === userId ? "owner" : (maxPermission(shares.map((s) => s.permission)) ?? "view");
	return { ...rest, access, shared: access !== "owner", owner: user };
}

export function describeStorageAccess<T extends { user: number; userRel: Owner; shares: Grants }>(
	userId: number,
	storage: T,
) {
	const { userRel, shares, ...rest } = storage;
	const access: Access =
		storage.user === userId ? "owner" : (maxPermission(shares.map((s) => s.permission)) ?? "view");
	return { ...rest, access, shared: access !== "owner", owner: userRel };
}

/** Strip secrets from a function record for recipients below `edit`. */
export function redactFunctionForAccess<T extends { git_password?: unknown; env?: unknown; secure_header?: unknown; executionId?: unknown; executionAlias?: unknown }>(
	fn: T,
	access: Access,
): T {
	if (access === "owner") return fn;
	const redacted = { ...fn, git_password: null };
	if (!hasAccess(access, "edit")) {
		redacted.env = null;
		redacted.secure_header = null;
	}
	if (!hasAccess(access, "execute")) {
		redacted.executionId = null;
		redacted.executionAlias = null;
	}
	return redacted;
}

/** Record a security-relevant change. `details` must never contain secrets. */
export async function audit(
	actorId: number | null,
	action: string,
	targetType: string,
	targetId: number | null,
	details?: Prisma.InputJsonValue,
) {
	log.info({ actorId, action, targetType, targetId }, "audit");
	await prisma.auditLog.create({ data: { actorId, action, targetType, targetId, details } });
}

export type SsoGroup = { id: string; name: string };

/**
 * SSO contract for #65. Resolves IdP groups to local groups by
 * (provider, externalId), creating missing ones, then makes the user's
 * SSO-sourced memberships match `groups` exactly. Local memberships are never
 * touched, so disabling SSO leaves local groups and every share intact.
 * Admins link an existing local group by setting its ssoProvider/ssoGroupId.
 */
export async function syncSsoGroupMembership(provider: string, userId: number, groups: SsoGroup[]) {
	const groupIds = new Set<number>();
	for (const g of groups) {
		let group = await prisma.group.findUnique({
			where: { ssoProvider_ssoGroupId: { ssoProvider: provider, ssoGroupId: g.id } },
		});
		if (!group) {
			// Never auto-link by name: a same-named local group may belong to someone else.
			const nameTaken = await prisma.group.findUnique({ where: { name: g.name } });
			group = await prisma.group.create({
				data: {
					name: nameTaken ? `${g.name} (${provider}:${g.id})`.slice(0, 128) : g.name.slice(0, 128),
					ssoProvider: provider,
					ssoGroupId: g.id,
				},
			});
			await audit(null, "group.create", "group", group.id, { name: group.name, provider });
		}
		groupIds.add(group.id);
	}

	const existing = await prisma.groupMember.findMany({ where: { userId, group: { ssoProvider: provider } } });
	const have = new Set(existing.map((m) => m.groupId));
	for (const groupId of [...groupIds].filter((id) => !have.has(id))) {
		await prisma.groupMember.create({ data: { groupId, userId, source: "sso" } });
		await audit(null, "group.member.add", "group", groupId, { userId, source: "sso", provider });
	}
	const stale = existing.filter((m) => m.source === "sso" && !groupIds.has(m.groupId));
	for (const m of stale) {
		await prisma.groupMember.delete({ where: { groupId_userId: { groupId: m.groupId, userId } } });
		await audit(null, "group.member.remove", "group", m.groupId, { userId, source: "sso", provider });
	}
	return [...groupIds];
}
