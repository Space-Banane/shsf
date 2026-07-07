import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./db";

export class StorageServiceError extends Error {
	constructor(
		public readonly statusCode: number,
		message: string,
	) {
		super(message);
		this.name = "StorageServiceError";
	}
}

type StoragePrisma = Pick<
	PrismaClient,
	"functionStorage" | "functionStorageItem"
>;

export interface SetStorageItemInput {
	key: string;
	value: unknown;
	expiresAt?: string | number;
}

function parseStoredValue(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function serializeStorageValue(value: unknown): string {
	return typeof value === "string" ? value : JSON.stringify(value);
}

function resolveExpiresAt(expiresAt?: string | number): Date | undefined {
	if (typeof expiresAt === "string") {
		return new Date(expiresAt);
	}

	if (typeof expiresAt === "number") {
		return new Date(Date.now() + expiresAt * 60 * 60 * 1000);
	}

	return undefined;
}

async function deleteExpiredItem(
	db: StoragePrisma,
	item: { id: number; expiresAt: Date | null } | null,
	now: Date,
): Promise<boolean> {
	if (item && item.expiresAt && item.expiresAt < now) {
		await db.functionStorageItem.delete({ where: { id: item.id } });
		return true;
	}
	return false;
}

export class FunctionStorageService {
	constructor(private readonly db?: StoragePrisma) {}

	private get database(): StoragePrisma {
		if (this.db) {
			return this.db;
		}

		return defaultPrisma;
	}

	async createStorage(userId: number, name: string, purpose: string) {
		const db = this.database;
		const existing = await db.functionStorage.findFirst({
			where: { name, user: userId },
		});
		if (existing) {
			throw new StorageServiceError(409, "Storage with this name already exists");
		}

		return db.functionStorage.create({
			data: {
				name,
				purpose,
				user: userId,
			},
		});
	}

	async listStorages(userId: number) {
		return this.database.functionStorage.findMany({
			where: { user: userId },
			include: { items: false },
		});
	}

	async deleteStorage(userId: number, storageName: string) {
		const db = this.database;
		const storage = await this.findStorage(userId, storageName);
		await db.functionStorage.delete({ where: { id: storage.id } });
		return { message: "Storage deleted" };
	}

	async clearStorageItems(userId: number, storageName: string) {
		const db = this.database;
		const storage = await this.findStorage(userId, storageName);
		await db.functionStorageItem.deleteMany({
			where: { storageId: storage.id },
		});
		return { message: "All items cleared" };
	}

	async setStorageItem(
		userId: number,
		storageName: string,
		input: SetStorageItemInput,
	) {
		const db = this.database;
		const storage = await this.findStorage(userId, storageName);
		const storeValue = serializeStorageValue(input.value);
		const expiresAt = resolveExpiresAt(input.expiresAt);
		const now = new Date();
		const existing = await db.functionStorageItem.findFirst({
			where: { storageId: storage.id, key: input.key },
		});
		await deleteExpiredItem(db, existing, now);

		const stillExists = existing && (!existing.expiresAt || existing.expiresAt >= now);
		if (stillExists) {
			return db.functionStorageItem.update({
				where: { id: existing.id },
				data: {
					value: storeValue,
					expiresAt,
				},
			});
		}

		return db.functionStorageItem.create({
			data: {
				key: input.key,
				value: storeValue,
				expiresAt,
				storageId: storage.id,
			},
		});
	}

	async getStorageItem(userId: number, storageName: string, key: string) {
		const db = this.database;
		const storage = await this.findStorage(userId, storageName);
		const item = await db.functionStorageItem.findFirst({
			where: { storageId: storage.id, key },
		});
		if (!item) {
			throw new StorageServiceError(404, "Item not found");
		}

		if (await deleteExpiredItem(db, item, new Date())) {
			throw new StorageServiceError(404, "Item expired");
		}

		return { ...item, value: parseStoredValue(item.value) };
	}

	async getStorageValue(userId: number, storageName: string, key: string) {
		const item = await this.getStorageItem(userId, storageName, key);
		return item.value;
	}

	async listStorageItems(userId: number, storageName: string) {
		const db = this.database;
		const storage = await this.findStorage(userId, storageName);
		const items = await db.functionStorageItem.findMany({
			where: { storageId: storage.id },
		});
		const now = new Date();
		const expiredItemIds: number[] = [];
		const validItems = [];
		for (const item of items) {
			if (item.expiresAt && item.expiresAt < now) {
				expiredItemIds.push(item.id);
			} else {
				validItems.push({ ...item, value: parseStoredValue(item.value) });
			}
		}
		if (expiredItemIds.length > 0) {
			await db.functionStorageItem.deleteMany({
				where: { id: { in: expiredItemIds } },
			});
		}
		return validItems;
	}

	async deleteStorageItem(userId: number, storageName: string, key: string) {
		const db = this.database;
		const storage = await this.findStorage(userId, storageName);
		const item = await db.functionStorageItem.findFirst({
			where: { storageId: storage.id, key },
		});
		if (!item) {
			throw new StorageServiceError(404, "Item not found");
		}

		await db.functionStorageItem.delete({ where: { id: item.id } });
		return { message: "Item deleted" };
	}

	async storageItemExists(userId: number, storageName: string, key: string) {
		try {
			await this.getStorageItem(userId, storageName, key);
			return true;
		} catch (error) {
			if (error instanceof StorageServiceError && error.statusCode === 404) {
				return false;
			}
			throw error;
		}
	}

	private async findStorage(userId: number, storageName: string) {
		const storage = await this.database.functionStorage.findFirst({
			where: { name: storageName, user: userId },
		});
		if (!storage) {
			throw new StorageServiceError(404, "Storage not found");
		}
		return storage;
	}
}

export const functionStorageService = new FunctionStorageService();
