import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { audit } from "../../../lib/Sharing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rjweb route context
async function requireAdmin(ctr: any) {
	const authCheck = await checkAuthentication(ctr.cookies.get(COOKIE), ctr.headers.get(API_KEY_HEADER));
	if (!authCheck.success) {
		return { error: ctr.status(ctr.$status.UNAUTHORIZED).print({ status: "FAILED", message: authCheck.message }) };
	}
	if (authCheck.user.role !== "Admin") {
		return { error: ctr.status(ctr.$status.FORBIDDEN).print({ status: "FAILED", message: "Admins only." }) };
	}
	return { admin: authCheck.user };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rjweb route context
function parseId(ctr: any, name: string) {
	const id = Number(ctr.params.get(name));
	return Number.isInteger(id) && id > 0 ? id : null;
}

const groupSelect = {
	id: true,
	name: true,
	description: true,
	ssoProvider: true,
	ssoGroupId: true,
	createdAt: true,
	members: {
		select: { source: true, user: { select: { id: true, displayName: true, email: true } } },
	},
	_count: { select: { shares: true } },
} as const;

// Admin-managed groups. SSO linkage fields follow the #65 contract documented
// on syncSsoGroupMembership in lib/Sharing.ts.
const groupBody = (z: typeof import("zod").z) =>
	z.object({
		name: z.string().trim().min(1).max(128),
		description: z.string().max(256).nullable().optional(),
		ssoProvider: z.string().trim().min(1).max(128).nullable().optional(),
		ssoGroupId: z.string().trim().min(1).max(256).nullable().optional(),
	});

export = new fileRouter.Path("/")
	.http("GET", "/api/admin/groups", (http) =>
		http.onRequest(async (ctr) => {
			const auth = await requireAdmin(ctr);
			if ("error" in auth) return auth.error;
			const groups = await prisma.group.findMany({ orderBy: { name: "asc" }, select: groupSelect });
			return ctr.print({ status: "OK", data: groups });
		}),
	)
	.http("POST", "/api/admin/groups", (http) =>
		http.onRequest(async (ctr) => {
			const auth = await requireAdmin(ctr);
			if ("error" in auth) return auth.error;
			const [data, error] = await ctr.bindBody(groupBody);
			if (!data) return ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: error.toString() });
			if (Boolean(data.ssoProvider) !== Boolean(data.ssoGroupId)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: "ssoProvider and ssoGroupId must be set together." });
			}
			try {
				const group = await prisma.group.create({ data, select: groupSelect });
				await audit(auth.admin.id, "group.create", "group", group.id, { name: group.name });
				return ctr.print({ status: "OK", data: group });
			} catch {
				return ctr.status(ctr.$status.CONFLICT).print({ status: "FAILED", message: "A group with this name or SSO mapping already exists." });
			}
		}),
	)
	.http("PATCH", "/api/admin/groups/{id}", (http) =>
		http.onRequest(async (ctr) => {
			const auth = await requireAdmin(ctr);
			if ("error" in auth) return auth.error;
			const id = parseId(ctr, "id");
			if (!id) return ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: "Invalid group id" });
			const [data, error] = await ctr.bindBody((z) => groupBody(z).partial());
			if (!data) return ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: error.toString() });
			const existing = await prisma.group.findUnique({ where: { id } });
			if (!existing) return ctr.status(ctr.$status.NOT_FOUND).print({ status: "FAILED", message: "Group not found" });
			const provider = data.ssoProvider !== undefined ? data.ssoProvider : existing.ssoProvider;
			const externalId = data.ssoGroupId !== undefined ? data.ssoGroupId : existing.ssoGroupId;
			if (Boolean(provider) !== Boolean(externalId)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: "ssoProvider and ssoGroupId must be set together." });
			}
			try {
				const group = await prisma.group.update({ where: { id }, data, select: groupSelect });
				await audit(auth.admin.id, "group.update", "group", id, { fields: Object.keys(data) });
				return ctr.print({ status: "OK", data: group });
			} catch {
				return ctr.status(ctr.$status.CONFLICT).print({ status: "FAILED", message: "Group name or SSO mapping already in use." });
			}
		}),
	)
	.http("DELETE", "/api/admin/groups/{id}", (http) =>
		http.onRequest(async (ctr) => {
			const auth = await requireAdmin(ctr);
			if ("error" in auth) return auth.error;
			const id = parseId(ctr, "id");
			if (!id) return ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: "Invalid group id" });
			const deleted = await prisma.group.deleteMany({ where: { id } });
			if (!deleted.count) return ctr.status(ctr.$status.NOT_FOUND).print({ status: "FAILED", message: "Group not found" });
			// Cascades remove memberships and every grant to this group.
			await audit(auth.admin.id, "group.delete", "group", id);
			return ctr.print({ status: "OK" });
		}),
	)
	.http("POST", "/api/admin/groups/{id}/members", (http) =>
		http.onRequest(async (ctr) => {
			const auth = await requireAdmin(ctr);
			if ("error" in auth) return auth.error;
			const id = parseId(ctr, "id");
			if (!id) return ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: "Invalid group id" });
			const [data, error] = await ctr.bindBody((z) => z.object({ email: z.string().email().max(256) }));
			if (!data) return ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: error.toString() });
			const [group, user] = await Promise.all([
				prisma.group.findUnique({ where: { id } }),
				prisma.user.findUnique({ where: { email: data.email } }),
			]);
			if (!group) return ctr.status(ctr.$status.NOT_FOUND).print({ status: "FAILED", message: "Group not found" });
			if (!user) return ctr.status(ctr.$status.NOT_FOUND).print({ status: "FAILED", message: "User not found" });
			await prisma.groupMember.upsert({
				where: { groupId_userId: { groupId: id, userId: user.id } },
				create: { groupId: id, userId: user.id, source: "local" },
				// An admin adding an SSO-synced member pins it as local so sync won't remove it.
				update: { source: "local" },
			});
			await audit(auth.admin.id, "group.member.add", "group", id, { userId: user.id, source: "local" });
			return ctr.print({ status: "OK" });
		}),
	)
	.http("DELETE", "/api/admin/groups/{id}/members/{userId}", (http) =>
		http.onRequest(async (ctr) => {
			const auth = await requireAdmin(ctr);
			if ("error" in auth) return auth.error;
			const id = parseId(ctr, "id");
			const userId = parseId(ctr, "userId");
			if (!id || !userId) return ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: "Invalid id" });
			const removed = await prisma.groupMember.deleteMany({ where: { groupId: id, userId } });
			if (!removed.count) return ctr.status(ctr.$status.NOT_FOUND).print({ status: "FAILED", message: "Member not found" });
			await audit(auth.admin.id, "group.member.remove", "group", id, { userId });
			return ctr.print({ status: "OK" });
		}),
	)
	.http("GET", "/api/admin/audit", (http) =>
		http.onRequest(async (ctr) => {
			const auth = await requireAdmin(ctr);
			if ("error" in auth) return auth.error;
			const limit = Math.min(500, Math.max(1, Number(ctr.queries.get("limit")) || 100));
			const entries = await prisma.auditLog.findMany({ orderBy: { id: "desc" }, take: limit });
			return ctr.print({ status: "OK", data: entries });
		}),
	);
