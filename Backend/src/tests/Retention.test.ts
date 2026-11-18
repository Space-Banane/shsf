import { afterEach, describe, expect, it, vi } from "vitest";
import { processRetentionCleanup } from "../lib/SystemCrons";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-18T12:00:00.000Z");

type Row = { id: number; createdAt?: Date | null; expiresAt?: Date | null };

type Where = {
	createdAt?: { lt: Date };
	expiresAt?: { lt: Date } | null;
};

function createTable<T extends Row>(rows: T[]) {
	const store = new Map(rows.map((row) => [row.id, row]));
	const findMany = vi.fn(async (args: { where: Where; take?: number }) => {
		return [...store.values()]
			.filter((row) => {
				const expiresAt = args.where.expiresAt;
				if (expiresAt === null && row.expiresAt !== null) return false;
				if (expiresAt && expiresAt !== null) {
					if (!row.expiresAt || row.expiresAt.getTime() >= expiresAt.lt.getTime()) return false;
				}

				const createdAt = args.where.createdAt;
				if (createdAt) {
					if (!row.createdAt || row.createdAt.getTime() >= createdAt.lt.getTime()) return false;
				}

				return true;
			})
			.sort((a, b) => a.id - b.id)
			.slice(0, args.take ?? Number.MAX_SAFE_INTEGER)
			.map((row) => ({ id: row.id }));
	});
	const deleteMany = vi.fn(async (args: { where: { id: { in: number[] } } }) => {
		let count = 0;
		for (const id of args.where.id.in) {
			if (store.delete(id)) count++;
		}
		return { count };
	});
	return { findMany, deleteMany, store };
}

function buildDependencies(rows: {
	triggerLog?: Row[];
	session?: Row[];
	guestSession?: Row[];
	auditLog?: Row[];
}) {
	return {
		triggerLog: createTable(rows.triggerLog ?? []),
		session: createTable(rows.session ?? []),
		guestSession: createTable(rows.guestSession ?? []),
		auditLog: createTable(rows.auditLog ?? []),
	};
}

function dependenciesFor(tables: ReturnType<typeof buildDependencies>) {
	return {
		prisma: tables as unknown as Parameters<typeof processRetentionCleanup>[0]["prisma"],
		executeFunction: vi.fn() as unknown as Parameters<
			typeof processRetentionCleanup
		>[0]["executeFunction"],
		performGitPull: vi.fn() as unknown as Parameters<
			typeof processRetentionCleanup
		>[0]["performGitPull"],
	};
}

const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

describe("processRetentionCleanup", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("deletes expired sessions and guest sessions, keeping active rows", async () => {
		vi.useFakeTimers({ now: NOW });
		const tables = buildDependencies({
			session: [
				{ id: 1, expiresAt: new Date(NOW.getTime() - 60 * 1000) },
				{ id: 2, expiresAt: new Date(NOW.getTime() + 60 * 1000) },
			],
			guestSession: [
				{ id: 1, expiresAt: daysAgo(1) },
				{ id: 2, expiresAt: daysFromNow(1) },
			],
		});

		await processRetentionCleanup(dependenciesFor(tables), { logDays: 0, auditDays: 0 });

		expect([...tables.session.store.keys()]).toEqual([2]);
		expect([...tables.guestSession.store.keys()]).toEqual([2]);
		expect(tables.triggerLog.findMany).not.toHaveBeenCalled();
		expect(tables.auditLog.findMany).not.toHaveBeenCalled();
	});

	it("deletes abandoned local sessions once their cookie lifetime has passed", async () => {
		vi.useFakeTimers({ now: NOW });
		const tables = buildDependencies({
			session: [
				{ id: 1, expiresAt: null, createdAt: daysAgo(31) },
				{ id: 2, expiresAt: null, createdAt: daysAgo(29) },
				{ id: 3, expiresAt: null, createdAt: new Date(NOW.getTime()) },
			],
		});

		await processRetentionCleanup(dependenciesFor(tables), { logDays: 0, auditDays: 0 });

		expect([...tables.session.store.keys()]).toEqual([2, 3]);
	});

	it("deletes execution logs older than the configured log window and keeps newer rows", async () => {
		vi.useFakeTimers({ now: NOW });
		const tables = buildDependencies({
			triggerLog: [
				{ id: 1, createdAt: daysAgo(6) },
				{ id: 2, createdAt: daysAgo(4) },
				{ id: 3, createdAt: new Date(NOW.getTime()) },
			],
		});

		await processRetentionCleanup(dependenciesFor(tables), { logDays: 5, auditDays: 0 });

		expect([...tables.triggerLog.store.keys()]).toEqual([2, 3]);
		expect(tables.triggerLog.deleteMany).toHaveBeenCalledWith({
			where: { id: { in: [1] } },
		});
	});

	it("deletes audit rows older than the configured audit window and keeps newer rows", async () => {
		vi.useFakeTimers({ now: NOW });
		const tables = buildDependencies({
			auditLog: [
				{ id: 1, createdAt: daysAgo(11) },
				{ id: 2, createdAt: daysAgo(9) },
			],
		});

		await processRetentionCleanup(dependenciesFor(tables), { logDays: 0, auditDays: 10 });

		expect([...tables.auditLog.store.keys()]).toEqual([2]);
	});

	it("treats the cutoff itself as recent", async () => {
		vi.useFakeTimers({ now: NOW });
		const tables = buildDependencies({
			triggerLog: [{ id: 1, createdAt: daysAgo(5) }],
			auditLog: [{ id: 1, createdAt: daysAgo(10) }],
		});

		await processRetentionCleanup(dependenciesFor(tables), { logDays: 5, auditDays: 10 });

		expect(tables.triggerLog.store.size).toBe(1);
		expect(tables.auditLog.store.size).toBe(1);
	});

	it("disables log and audit pruning when their window is zero", async () => {
		vi.useFakeTimers({ now: NOW });
		const tables = buildDependencies({
			triggerLog: [{ id: 1, createdAt: daysAgo(3650) }],
			auditLog: [{ id: 1, createdAt: daysAgo(3650) }],
		});

		await processRetentionCleanup(dependenciesFor(tables), { logDays: 0, auditDays: 0 });

		expect(tables.triggerLog.store.size).toBe(1);
		expect(tables.auditLog.store.size).toBe(1);
	});

	it("deletes in bounded batches and drains the full backlog", async () => {
		vi.useFakeTimers({ now: NOW });
		const tables = buildDependencies({
			triggerLog: Array.from({ length: 7 }, (_, index) => ({
				id: index + 1,
				createdAt: daysAgo(6),
			})),
		});

		await processRetentionCleanup(dependenciesFor(tables), {
			logDays: 5,
			auditDays: 0,
			batchSize: 3,
		});

		expect(tables.triggerLog.store.size).toBe(0);
		expect(tables.triggerLog.findMany).toHaveBeenCalledTimes(3);
		for (const [args] of tables.triggerLog.findMany.mock.calls) {
			expect(args.take).toBe(3);
		}
		for (const [args] of tables.triggerLog.deleteMany.mock.calls) {
			expect(args.where.id.in.length).toBeLessThanOrEqual(3);
		}
	});

	it("stops draining a target when a full batch deletes nothing", async () => {
		vi.useFakeTimers({ now: NOW });
		const tables = buildDependencies({
			triggerLog: [{ id: 1, createdAt: daysAgo(6) }],
		});
		tables.triggerLog.deleteMany.mockResolvedValue({ count: 0 });

		await processRetentionCleanup(dependenciesFor(tables), {
			logDays: 5,
			auditDays: 0,
			batchSize: 1,
		});

		expect(tables.triggerLog.findMany).toHaveBeenCalledTimes(1);
	});

	it("keeps pruning other targets when one target fails", async () => {
		vi.useFakeTimers({ now: NOW });
		const tables = buildDependencies({
			triggerLog: [{ id: 1, createdAt: daysAgo(6) }],
			auditLog: [{ id: 1, createdAt: daysAgo(11) }],
			session: [{ id: 1, expiresAt: daysAgo(1) }],
		});
		tables.triggerLog.findMany.mockRejectedValue(new Error("database unavailable"));

		await expect(
			processRetentionCleanup(dependenciesFor(tables), { logDays: 5, auditDays: 10 }),
		).resolves.toBeUndefined();

		expect(tables.auditLog.store.size).toBe(0);
		expect(tables.session.store.size).toBe(0);
		expect(tables.triggerLog.store.size).toBe(1);
	});
});
