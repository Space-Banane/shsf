import { afterEach, describe, expect, it, vi } from "vitest";
import { processRetentionCleanup } from "../lib/SystemCrons";
import { env } from "../lib/env";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-18T12:00:00.000Z");

type Row = { id: number; createdAt?: Date | null; expiresAt?: Date | null };

function createTable<T extends Row>(rows: T[], cutoffField: "createdAt" | "expiresAt") {
	const store = new Map(rows.map((row) => [row.id, row]));
	const findMany = vi.fn(async (args: { where: Record<string, { lt: Date }>; take?: number }) => {
		const cutoff = args.where[cutoffField].lt.getTime();
		return [...store.values()]
			.filter((row) => {
				const value = row[cutoffField];
				return !!value && value.getTime() < cutoff;
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
		triggerLog: createTable(rows.triggerLog ?? [], "createdAt"),
		session: createTable(rows.session ?? [], "expiresAt"),
		guestSession: createTable(rows.guestSession ?? [], "expiresAt"),
		auditLog: createTable(rows.auditLog ?? [], "createdAt"),
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
	});

	it("deletes expired sessions and guest sessions, keeping active and local sessions", async () => {
		vi.useFakeTimers({ now: NOW });
		const tables = buildDependencies({
			session: [
				{ id: 1, expiresAt: new Date(NOW.getTime() - 60 * 1000) },
				{ id: 2, expiresAt: new Date(NOW.getTime() + 60 * 1000) },
				{ id: 3, expiresAt: null },
			],
			guestSession: [
				{ id: 1, expiresAt: daysAgo(1) },
				{ id: 2, expiresAt: daysFromNow(1) },
			],
		});

		await processRetentionCleanup(dependenciesFor(tables));

		expect([...tables.session.store.keys()]).toEqual([2, 3]);
		expect([...tables.guestSession.store.keys()]).toEqual([2]);
		expect(tables.triggerLog.deleteMany).not.toHaveBeenCalled();
		expect(tables.auditLog.deleteMany).not.toHaveBeenCalled();
	});

	it("deletes execution logs older than the configured log window and keeps newer rows", async () => {
		vi.useFakeTimers({ now: NOW });
		const tables = buildDependencies({
			triggerLog: [
				{ id: 1, createdAt: daysAgo(env.RETENTION_LOG_DAYS + 1) },
				{ id: 2, createdAt: daysAgo(env.RETENTION_LOG_DAYS - 1) },
				{ id: 3, createdAt: new Date(NOW.getTime()) },
			],
		});

		await processRetentionCleanup(dependenciesFor(tables));

		expect([...tables.triggerLog.store.keys()]).toEqual([2, 3]);
		expect(tables.triggerLog.deleteMany).toHaveBeenCalledWith({
			where: { id: { in: [1] } },
		});
	});

	it("deletes audit rows older than the configured audit window and keeps newer rows", async () => {
		vi.useFakeTimers({ now: NOW });
		const tables = buildDependencies({
			auditLog: [
				{ id: 1, createdAt: daysAgo(env.RETENTION_AUDIT_DAYS + 1) },
				{ id: 2, createdAt: daysAgo(env.RETENTION_AUDIT_DAYS - 1) },
			],
		});

		await processRetentionCleanup(dependenciesFor(tables));

		expect([...tables.auditLog.store.keys()]).toEqual([2]);
	});

	it("treats the cutoff itself as recent", async () => {
		vi.useFakeTimers({ now: NOW });
		const tables = buildDependencies({
			triggerLog: [{ id: 1, createdAt: daysAgo(env.RETENTION_LOG_DAYS) }],
			auditLog: [{ id: 1, createdAt: daysAgo(env.RETENTION_AUDIT_DAYS) }],
		});

		await processRetentionCleanup(dependenciesFor(tables));

		expect(tables.triggerLog.store.size).toBe(1);
		expect(tables.auditLog.store.size).toBe(1);
	});

	it("deletes in bounded batches and drains the full backlog", async () => {
		vi.useFakeTimers({ now: NOW });
		const total = env.RETENTION_BATCH_SIZE * 2 + 1;
		const tables = buildDependencies({
			triggerLog: Array.from({ length: total }, (_, index) => ({
				id: index + 1,
				createdAt: daysAgo(env.RETENTION_LOG_DAYS + 1),
			})),
		});

		await processRetentionCleanup(dependenciesFor(tables));

		expect(tables.triggerLog.store.size).toBe(0);
		expect(tables.triggerLog.findMany).toHaveBeenCalledTimes(3);
		for (const [args] of tables.triggerLog.findMany.mock.calls) {
			expect(args.take).toBe(env.RETENTION_BATCH_SIZE);
		}
		for (const [args] of tables.triggerLog.deleteMany.mock.calls) {
			expect(args.where.id.in.length).toBeLessThanOrEqual(env.RETENTION_BATCH_SIZE);
		}
	});
});
