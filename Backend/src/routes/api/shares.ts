import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../..";
import { checkAuthentication } from "../../lib/Authentication";
import {
	RESOURCE_PERMISSIONS,
	type ShareResourceType,
	audit,
} from "../../lib/Sharing";

const TYPES: ShareResourceType[] = ["namespace", "function", "storage"];
const FK = { namespace: "namespaceId", function: "functionId", storage: "storageId" } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rjweb route context
async function getUser(ctr: any) {
	const authCheck = await checkAuthentication(ctr.cookies.get(COOKIE), ctr.headers.get(API_KEY_HEADER));
	if (!authCheck.success) {
		return { error: ctr.status(ctr.$status.UNAUTHORIZED).print({ status: 401, message: authCheck.message }) };
	}
	return { user: authCheck.user };
}

/** Only the owner manages grants. Returns null for missing or foreign resources. */
async function ownedResource(type: ShareResourceType, id: number, userId: number) {
	if (type === "namespace") return prisma.namespace.findFirst({ where: { id, userId }, select: { id: true } });
	if (type === "function") return prisma.function.findFirst({ where: { id, userId }, select: { id: true } });
	return prisma.functionStorage.findFirst({ where: { id, user: userId }, select: { id: true } });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rjweb route context
async function parseTarget(ctr: any, userId: number) {
	const type = ctr.params.get("type") as ShareResourceType;
	const id = Number(ctr.params.get("id"));
	if (!TYPES.includes(type) || !Number.isInteger(id) || id <= 0) {
		return { error: ctr.status(ctr.$status.BAD_REQUEST).print({ status: 400, message: "Invalid resource" }) };
	}
	if (!(await ownedResource(type, id, userId))) {
		return { error: ctr.status(ctr.$status.NOT_FOUND).print({ status: 404, message: "Resource not found" }) };
	}
	return { type, id };
}

const shareSelect = {
	id: true,
	permission: true,
	createdAt: true,
	user: { select: { id: true, displayName: true, email: true } },
	group: { select: { id: true, name: true } },
} as const;

export = new fileRouter.Path("/")
	// Groups the caller may share with: their own groups, or every group for admins.
	.http("GET", "/api/groups", (http) =>
		http.onRequest(async (ctr) => {
			const auth = await getUser(ctr);
			if ("error" in auth) return auth.error;
			const groups = await prisma.group.findMany({
				where: auth.user.role === "Admin" ? {} : { members: { some: { userId: auth.user.id } } },
				orderBy: { name: "asc" },
				select: { id: true, name: true, description: true },
			});
			return ctr.print({ status: "OK", data: groups });
		}),
	)
	.http("GET", "/api/shares/{type}/{id}", (http) =>
		http.onRequest(async (ctr) => {
			const auth = await getUser(ctr);
			if ("error" in auth) return auth.error;
			const target = await parseTarget(ctr, auth.user.id);
			if ("error" in target) return target.error;
			const shares = await prisma.resourceShare.findMany({
				where: { [FK[target.type]]: target.id },
				select: shareSelect,
				orderBy: { createdAt: "asc" },
			});
			return ctr.print({ status: "OK", data: shares });
		}),
	)
	// Create or update one grant. Exactly one of email / groupId selects the recipient.
	.http("POST", "/api/shares/{type}/{id}", (http) =>
		http.onRequest(async (ctr) => {
			const auth = await getUser(ctr);
			if ("error" in auth) return auth.error;
			const target = await parseTarget(ctr, auth.user.id);
			if ("error" in target) return target.error;
			const [data, error] = await ctr.bindBody((z) =>
				z.object({
					email: z.string().email().max(256).optional(),
					groupId: z.number().int().positive().optional(),
					permission: z.enum(["view", "execute", "edit"]),
				}),
			);
			if (!data) return ctr.status(ctr.$status.BAD_REQUEST).print({ status: 400, message: error.toString() });
			if (Boolean(data.email) === Boolean(data.groupId)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({ status: 400, message: "Provide exactly one of email or groupId." });
			}
			if (!RESOURCE_PERMISSIONS[target.type].includes(data.permission)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: `Permission must be one of: ${RESOURCE_PERMISSIONS[target.type].join(", ")}`,
				});
			}

			let recipient: { userId: number } | { groupId: number };
			if (data.email) {
				const user = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
				if (!user) return ctr.status(ctr.$status.NOT_FOUND).print({ status: 404, message: "No user with that email." });
				if (user.id === auth.user.id) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({ status: 400, message: "You already own this resource." });
				}
				recipient = { userId: user.id };
			} else {
				// Non-admins may only share with groups they belong to.
				const group = await prisma.group.findFirst({
					where: {
						id: data.groupId,
						...(auth.user.role === "Admin" ? {} : { members: { some: { userId: auth.user.id } } }),
					},
					select: { id: true },
				});
				if (!group) return ctr.status(ctr.$status.NOT_FOUND).print({ status: 404, message: "Group not found." });
				recipient = { groupId: group.id };
			}

			const where = { [FK[target.type]]: target.id, ...recipient };
			const existing = await prisma.resourceShare.findFirst({ where, select: { id: true } });
			const share = existing
				? await prisma.resourceShare.update({ where: { id: existing.id }, data: { permission: data.permission }, select: shareSelect })
				: await prisma.resourceShare.create({ data: { ...where, permission: data.permission }, select: shareSelect });
			await audit(auth.user.id, existing ? "share.update" : "share.create", target.type, target.id, {
				shareId: share.id,
				permission: data.permission,
				...recipient,
			});
			return ctr.print({ status: "OK", data: share });
		}),
	)
	.http("DELETE", "/api/shares/{type}/{id}/{shareId}", (http) =>
		http.onRequest(async (ctr) => {
			const auth = await getUser(ctr);
			if ("error" in auth) return auth.error;
			const target = await parseTarget(ctr, auth.user.id);
			if ("error" in target) return target.error;
			const shareId = Number(ctr.params.get("shareId"));
			const share = await prisma.resourceShare.findFirst({
				where: { id: shareId, [FK[target.type]]: target.id },
				select: { id: true, userId: true, groupId: true },
			});
			if (!share) return ctr.status(ctr.$status.NOT_FOUND).print({ status: 404, message: "Share not found" });
			await prisma.resourceShare.delete({ where: { id: share.id } });
			await audit(auth.user.id, "share.revoke", target.type, target.id, {
				shareId: share.id,
				userId: share.userId,
				groupId: share.groupId,
			});
			return ctr.print({ status: "OK" });
		}),
	);
