import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Pure helpers run everywhere. The access matrix needs a migrated MariaDB:
// SHARING_TEST_DATABASE_URL=mysql://root:pw@127.0.0.1:3306/shsf_test pnpm test
const DB_URL = process.env.SHARING_TEST_DATABASE_URL;
const db = vi.hoisted(() => ({ client: undefined as unknown as PrismaClient }));
vi.mock("..", () => ({
	get prisma() {
		return db.client;
	},
}));

import {
	describeFunctionAccess,
	functionAccessWhere,
	hasAccess,
	maxPermission,
	namespaceAccessWhere,
	redactFunctionForAccess,
	storageAccessWhere,
	syncSsoGroupMembership,
} from "../lib/Sharing";

describe("permission ordering", () => {
	it("ranks view < execute < edit < owner", () => {
		expect(hasAccess("edit", "execute")).toBe(true);
		expect(hasAccess("execute", "edit")).toBe(false);
		expect(hasAccess("view", "view")).toBe(true);
		expect(hasAccess(null, "view")).toBe(false);
		expect(hasAccess("edit", "owner")).toBe(false);
		expect(maxPermission(["view", "edit", "execute"])).toBe("edit");
		expect(maxPermission([])).toBeNull();
	});

	it("owner-level checks never consult grants", () => {
		expect(functionAccessWhere(1, "owner")).toEqual({ userId: 1 });
		expect(namespaceAccessWhere(1, "owner")).toEqual({ userId: 1 });
		expect(storageAccessWhere(1, "owner")).toEqual({ user: 1 });
	});

	it("does not let a sibling OR (search) overwrite the access filter", () => {
		const where = { ...functionAccessWhere(1, "view"), OR: [{ name: "x" }] };
		expect(where.AND).toBeDefined();
	});

	it("marks shared functions with the strongest inherited grant and owner", () => {
		const owner = { id: 1, displayName: "Owner", email: "o@x" };
		const fn = {
			id: 5,
			userId: 1,
			user: owner,
			shares: [{ permission: "view" as const }],
			namespace: { id: 2, name: "ns", shares: [{ permission: "execute" as const }] },
		};
		expect(describeFunctionAccess(9, fn)).toMatchObject({ access: "execute", shared: true, owner, namespace: { id: 2, name: "ns" } });
		expect(describeFunctionAccess(1, fn)).toMatchObject({ access: "owner", shared: false });
	});

	it("redacts secrets below edit and git credentials for every recipient", () => {
		const fn = { git_password: "pw", env: "A=1", secure_header: "h" };
		expect(redactFunctionForAccess(fn, "owner")).toEqual(fn);
		expect(redactFunctionForAccess(fn, "edit")).toEqual({ git_password: null, env: "A=1", secure_header: "h" });
		expect(redactFunctionForAccess(fn, "execute")).toEqual({ git_password: null, env: null, secure_header: null });
	});

	it("hides public execution capabilities from view-only recipients", () => {
		const fn = { git_password: "pw", executionId: "private-id", executionAlias: "private-alias" };
		expect(redactFunctionForAccess(fn, "view")).toMatchObject({ git_password: null, executionId: null, executionAlias: null });
		expect(redactFunctionForAccess(fn, "execute")).toMatchObject({ executionId: "private-id", executionAlias: "private-alias" });
	});
});

describe.skipIf(!DB_URL)("access matrix (database)", () => {
	const ids = {} as Record<string, number>;
	const tag = `t${Date.now()}`;

	beforeAll(async () => {
		db.client = new PrismaClient({ adapter: new PrismaMariaDb(DB_URL!) });
		const p = db.client;
		const mk = (n: string) => p.user.create({ data: { displayName: n, email: `${n}-${tag}@x.test` } });
		const [owner, alice, bob, carol] = await Promise.all([mk("owner"), mk("alice"), mk("bob"), mk("carol")]);
		Object.assign(ids, { owner: owner.id, alice: alice.id, bob: bob.id, carol: carol.id });
		const ns = await p.namespace.create({ data: { name: "shared-ns", userId: owner.id } });
		const other = await p.namespace.create({ data: { name: "private-ns", userId: owner.id } });
		const fnData = (name: string, namespaceId: number) => ({
			name,
			description: "d",
			image: "python:3.12",
			startup_file: "main.py",
			executionId: `${tag}-${name}`,
			userId: owner.id,
			namespaceId,
		});
		const inNs = await p.function.create({ data: fnData("in-ns", ns.id) });
		const loose = await p.function.create({ data: fnData("loose", other.id) });
		const unrelated = await p.function.create({ data: fnData("unrelated", other.id) });
		const storage = await p.functionStorage.create({ data: { name: "kv", purpose: "p", user: owner.id } });
		const group = await p.group.create({ data: { name: `team-${tag}` } });
		await p.groupMember.create({ data: { groupId: group.id, userId: bob.id } });
		Object.assign(ids, { ns: ns.id, other: other.id, inNs: inNs.id, loose: loose.id, unrelated: unrelated.id, storage: storage.id, group: group.id });

		await p.resourceShare.createMany({
			data: [
				{ namespaceId: ns.id, userId: alice.id, permission: "execute" }, // inherited by in-ns
				{ functionId: loose.id, groupId: group.id, permission: "edit" }, // via group
				{ storageId: storage.id, userId: alice.id, permission: "view" },
			],
		});
	});

	afterAll(async () => {
		if (!db.client) return;
		await db.client.user.deleteMany({ where: { email: { endsWith: `-${tag}@x.test` } } });
		await db.client.group.deleteMany({ where: { name: { contains: tag } } });
		await db.client.$disconnect();
	});

	const canFn = async (user: string, fn: string, need: "view" | "execute" | "edit") =>
		Boolean(await db.client.function.findFirst({ where: { id: ids[fn], ...functionAccessWhere(ids[user], need) } }));
	const canStorage = async (user: string, need: "view" | "edit") =>
		Boolean(await db.client.functionStorage.findFirst({ where: { id: ids.storage, ...storageAccessWhere(ids[user], need) } }));

	it("namespace grants are inherited by contained functions and stop at their level", async () => {
		expect(await canFn("alice", "inNs", "execute")).toBe(true);
		expect(await canFn("alice", "inNs", "edit")).toBe(false);
		expect(await canFn("alice", "unrelated", "view")).toBe(false);
	});

	it("group grants reach members only, and removing membership revokes them", async () => {
		expect(await canFn("bob", "loose", "edit")).toBe(true);
		expect(await canFn("carol", "loose", "view")).toBe(false);
		await db.client.groupMember.delete({ where: { groupId_userId: { groupId: ids.group, userId: ids.bob } } });
		expect(await canFn("bob", "loose", "view")).toBe(false);
		await db.client.groupMember.create({ data: { groupId: ids.group, userId: ids.bob } });
	});

	it("listing exposes exactly the shared resources", async () => {
		const names = async (u: string) =>
			(await db.client.function.findMany({ where: functionAccessWhere(ids[u], "view"), select: { name: true } }))
				.map((f) => f.name)
				.sort();
		expect(await names("owner")).toEqual(["in-ns", "loose", "unrelated"]);
		expect(await names("alice")).toEqual(["in-ns"]);
		expect(await names("bob")).toEqual(["loose"]);
		expect(await names("carol")).toEqual([]);
		const nsNames = (await db.client.namespace.findMany({ where: namespaceAccessWhere(ids.alice, "view") })).map((n) => n.name);
		expect(nsNames).toEqual(["shared-ns"]);
	});

	it("storage grants are explicit; namespace shares never grant storage", async () => {
		expect(await canStorage("alice", "view")).toBe(true);
		expect(await canStorage("alice", "edit")).toBe(false);
		expect(await canStorage("bob", "view")).toBe(false);
	});

	it("revoking a grant blocks the next lookup", async () => {
		await db.client.resourceShare.deleteMany({ where: { namespaceId: ids.ns, userId: ids.alice } });
		expect(await canFn("alice", "inNs", "view")).toBe(false);
		await db.client.resourceShare.create({ data: { namespaceId: ids.ns, userId: ids.alice, permission: "execute" } });
	});

	it("SSO sync resolves to one stable local group and only touches SSO memberships", async () => {
		const p = db.client;
		const provider = `oidc-${tag}`;
		const [first] = await syncSsoGroupMembership(provider, ids.carol, [{ id: "g1", name: `Eng-${tag}` }]);
		const [again] = await syncSsoGroupMembership(provider, ids.carol, [{ id: "g1", name: `Eng-${tag}` }]);
		expect(again).toBe(first);
		expect(await p.group.count({ where: { ssoProvider: provider } })).toBe(1);

		// A share to the SSO-mapped group reaches the synced member.
		await p.resourceShare.create({ data: { functionId: ids.unrelated, groupId: first, permission: "view" } });
		expect(await canFn("carol", "unrelated", "view")).toBe(true);

		// A local membership survives a sync that no longer lists that group.
		await p.groupMember.create({ data: { groupId: ids.group, userId: ids.carol, source: "local" } });
		await syncSsoGroupMembership(provider, ids.carol, []);
		expect(await canFn("carol", "unrelated", "view")).toBe(false);
		expect(await p.groupMember.count({ where: { userId: ids.carol, groupId: ids.group } })).toBe(1);

		// Disabling SSO (no more syncs) leaves the group and its shares intact.
		expect(await p.group.findUnique({ where: { id: first } })).not.toBeNull();
		expect(await p.resourceShare.count({ where: { groupId: first } })).toBe(1);
		expect(await p.auditLog.count({ where: { targetId: first, action: { startsWith: "group.member" } } })).toBe(2);
	});

	it("deduplicates IdP groups before adding a membership", async () => {
		const group = { id: "duplicate", name: `Duplicate-${tag}` };
		const groups = await syncSsoGroupMembership(`duplicate-${tag}`, ids.carol, [group, group]);
		expect(groups).toHaveLength(1);
		expect(await db.client.groupMember.findMany({ where: { userId: ids.carol, groupId: groups[0] } })).toMatchObject([{ source: "sso" }]);
	});

	it("syncing one provider preserves other providers' access and local memberships", async () => {
		const providerA = `provider-a-${tag}`;
		const providerB = `provider-b-${tag}`;
		const [a] = await syncSsoGroupMembership(providerA, ids.carol, [{ id: "a", name: `A-${tag}` }]);
		const [b] = await syncSsoGroupMembership(providerB, ids.carol, [{ id: "b", name: `B-${tag}` }]);
		await db.client.resourceShare.create({ data: { groupId: b, functionId: ids.unrelated, permission: "view" } });
		await syncSsoGroupMembership(providerA, ids.carol, []);
		expect(await canFn("carol", "unrelated", "view")).toBe(true);
		expect(await db.client.groupMember.findMany({ where: { userId: ids.carol, groupId: { in: [a, b, ids.group] } }, orderBy: { groupId: "asc" } }))
			.toMatchObject([{ groupId: ids.group, source: "local" }, { groupId: b, source: "sso" }]);
	});
});
