import { prisma, API_KEY_HEADER, COOKIE, fileRouter } from "../..";
import { checkAuthentication } from "../../lib/Authentication";

// Helper to delete expired item, returns true if deleted
async function deleteExpiredItem(
	item: { id: number; expiresAt: Date | null } | null,
	now: Date,
): Promise<boolean> {
	if (item && item.expiresAt && item.expiresAt < now) {
		await prisma.functionStorageItem.delete({ where: { id: item.id } });
		return true;
	}
	return false;
}

export = new fileRouter.Path("/")
	// ------ Function Storages ------
	// Create new storage
	.http("POST", "/api/storage", (http) =>
		http.onRequest(async (ctr) => {
			const [data, error] = await ctr.bindBody((z) =>
				z.object({
					name: z
						.string()
						.min(1)
						.max(128)
						.regex(/^[a-zA-Z0-9_\-]+$/, "Name must be alphanumeric with underscores or hyphens"),
					purpose: z.string().min(1).max(256),
				}),
			);
			if (!data) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: error.toString() });
			}
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}
			if (authCheck.method === "apiKey") {
				if (authCheck.apiKey.name.startsWith("token_exec_")) {
					ctr.skipRateLimit(); // Skip ratelimit as this is a action by a function
				}
			}

			// Check if storage with same name exists for user
			const existing = await prisma.functionStorage.findFirst({
				where: { name: data.name, user: authCheck.user.id },
			});
			if (existing) {
				return ctr
					.status(ctr.$status.CONFLICT)
					.print({ status: 409, message: "Storage with this name already exists" });
			}

			const storage = await prisma.functionStorage.create({
				data: {
					name: data.name,
					purpose: data.purpose,
					user: authCheck.user.id,
				},
			});
			return ctr.print({ status: "OK", data: storage });
		}),
	)

	// List all storages for user
	.http("GET", "/api/storage", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}
			if (authCheck.method === "apiKey") {
				if (authCheck.apiKey.name.startsWith("token_exec_")) {
					ctr.skipRateLimit(); // Skip ratelimit as this is a action by a function
				}
			}
			const storages = await prisma.functionStorage.findMany({
				where: { user: authCheck.user.id },
				include: { items: false },
			});
			return ctr.print({ status: "OK", data: storages });
		}),
	)

	// Delete a storage (and all items) by name
	.http("DELETE", "/api/storage/{storageName}", (http) =>
		http.onRequest(async (ctr) => {
			const storageName = ctr.params.get("storageName");
			if (!storageName) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: "Invalid storage name" });
			}
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}
			if (authCheck.method === "apiKey") {
				if (authCheck.apiKey.name.startsWith("token_exec_")) {
					ctr.skipRateLimit(); // Skip ratelimit as this is a action by a function
				}
			}
			const storage = await prisma.functionStorage.findFirst({
				where: { name: storageName, user: authCheck.user.id },
			});
			if (!storage) {
				return ctr
					.status(ctr.$status.NOT_FOUND)
					.print({ status: 404, message: "Storage not found" });
			}
			await prisma.functionStorage.delete({ where: { id: storage.id } });
			return ctr.print({ status: "OK", message: "Storage deleted" });
		}),
	)

	// Clear all items in storage by name
	.http("DELETE", "/api/storage/{storageName}/items", (http) =>
		http.onRequest(async (ctr) => {
			const storageName = ctr.params.get("storageName");
			if (!storageName) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: "Invalid storage name" });
			}
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}
			if (authCheck.method === "apiKey") {
				if (authCheck.apiKey.name.startsWith("token_exec_")) {
					ctr.skipRateLimit(); // Skip ratelimit as this is a action by a function
				}
			}
			const storage = await prisma.functionStorage.findFirst({
				where: { name: storageName, user: authCheck.user.id },
			});
			if (!storage) {
				return ctr
					.status(ctr.$status.NOT_FOUND)
					.print({ status: 404, message: "Storage not found" });
			}
			await prisma.functionStorageItem.deleteMany({
				where: { storageId: storage.id },
			});
			return ctr.print({ status: "OK", message: "All items cleared" });
		}),
	)

	// ------ Function Storage Items ------
	// Set (create/update) item by storage name
	.http("POST", "/api/storage/{storageName}/item", (http) =>
		http.onRequest(async (ctr) => {
			const storageName = ctr.params.get("storageName");
			if (!storageName) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: "Invalid storage name" });
			}
			const [data, error] = await ctr.bindBody((z) =>
				z.object({
					key: z
						.string()
						.min(1)
						.max(256)
						.regex(
							/^[a-zA-Z0-9_\-]+$/,
							"Key must be alphanumeric with underscores or hyphens",
						),
					value: z.any(),
					expiresAt: z.union([z.string().datetime(), z.number()]).optional(),
				}),
			);
			if (!data) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: error.toString() });
			}
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}
			if (authCheck.method === "apiKey") {
				if (authCheck.apiKey.name.startsWith("token_exec_")) {
					ctr.skipRateLimit(); // Skip ratelimit as this is a action by a function
				}
			}
			const storage = await prisma.functionStorage.findFirst({
				where: { name: storageName, user: authCheck.user.id },
			});
			if (!storage) {
				return ctr
					.status(ctr.$status.NOT_FOUND)
					.print({ status: 404, message: "Storage not found" });
			}
			// Accept any type for value, store as string (JSON if not string)
			let storeValue: string;
			if (typeof data.value === "string") {
				storeValue = data.value;
			} else {
				storeValue = JSON.stringify(data.value);
			}
			// Handle expiresAt as ISO string or hours (number)
			let expiresAt: Date | undefined = undefined;
			if (typeof data.expiresAt === "string") {
				expiresAt = new Date(data.expiresAt);
			} else if (typeof data.expiresAt === "number") {
				expiresAt = new Date(Date.now() + data.expiresAt * 60 * 60 * 1000);
			}
			// Remove expired item if exists using helper
			const now = new Date();
			const existing = await prisma.functionStorageItem.findFirst({
				where: { storageId: storage.id, key: data.key },
			});
			await deleteExpiredItem(existing, now);

			let item;
			const stillExists =
				existing && (!existing.expiresAt || existing.expiresAt >= now);
			if (stillExists) {
				item = await prisma.functionStorageItem.update({
					where: { id: existing.id },
					data: {
						value: storeValue,
						expiresAt,
					},
				});
			} else {
				item = await prisma.functionStorageItem.create({
					data: {
						key: data.key,
						value: storeValue,
						expiresAt,
						storageId: storage.id,
					},
				});
			}
			return ctr.print({ status: "OK", data: item });
		}),
	)

	// Get item by key and storage name
	.http("GET", "/api/storage/{storageName}/item/{key}", (http) =>
		http.onRequest(async (ctr) => {
			const storageName = ctr.params.get("storageName");
			const key = ctr.params.get("key");
			if (!storageName || !key) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: "Invalid storage name or key" });
			}
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}
			if (authCheck.method === "apiKey") {
				if (authCheck.apiKey.name.startsWith("token_exec_")) {
					ctr.skipRateLimit(); // Skip ratelimit as this is a action by a function
				}
			}
			const storage = await prisma.functionStorage.findFirst({
				where: { name: storageName, user: authCheck.user.id },
			});
			if (!storage) {
				return ctr
					.status(ctr.$status.NOT_FOUND)
					.print({ status: 404, message: "Storage not found" });
			}
			const item = await prisma.functionStorageItem.findFirst({
				where: { storageId: storage.id, key },
			});
			if (!item) {
				return ctr
					.status(ctr.$status.NOT_FOUND)
					.print({ status: 404, message: "Item not found" });
			}
			// Check expiration using helper
			const now = new Date();
			if (await deleteExpiredItem(item, now)) {
				return ctr
					.status(ctr.$status.NOT_FOUND)
					.print({ status: 404, message: "Item expired" });
			}
			let parsedItem = item;
			try {
				parsedItem.value = JSON.parse(item.value);
			} catch {
				// Intentionally ignore JSON parse errors; value remains as string if not valid JSON
			}
			return ctr.print({ status: "OK", data: parsedItem });
		}),
	)

	// Get all items in storage by name (filter out expired)
	.http("GET", "/api/storage/{storageName}/items", (http) =>
		http.onRequest(async (ctr) => {
			const storageName = ctr.params.get("storageName");
			if (!storageName) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: "Invalid storage name" });
			}
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}
			if (authCheck.method === "apiKey") {
				if (authCheck.apiKey.name.startsWith("token_exec_")) {
					ctr.skipRateLimit(); // Skip ratelimit as this is a action by a function
				}
			}
			const storage = await prisma.functionStorage.findFirst({
				where: { name: storageName, user: authCheck.user.id },
			});
			if (!storage) {
				return ctr
					.status(ctr.$status.NOT_FOUND)
					.print({ status: 404, message: "Storage not found" });
			}
			const items = await prisma.functionStorageItem.findMany({
				where: { storageId: storage.id },
			});
			const now = new Date();
			// Collect expired item IDs and filter valid items
			const expiredItemIds: number[] = [];
			const validItems = [];
			for (const item of items) {
				if (item.expiresAt && item.expiresAt < now) {
					expiredItemIds.push(item.id);
				} else {
					// Parse value if possible, do not mutate Prisma object
					let parsedValue: any;
					try {
						parsedValue = JSON.parse(item.value);
					} catch {
						parsedValue = item.value;
					}
					validItems.push({ ...item, value: parsedValue });
				}
			}
			if (expiredItemIds.length > 0) {
				await prisma.functionStorageItem.deleteMany({
					where: { id: { in: expiredItemIds } },
				});
			}
			return ctr.print({ status: "OK", data: validItems });
		}),
	)

	// Delete item by key and storage name
	.http("DELETE", "/api/storage/{storageName}/item/{key}", (http) =>
		http.onRequest(async (ctr) => {
			const storageName = ctr.params.get("storageName");
			const key = ctr.params.get("key");
			if (!storageName || !key) {
				return ctr
					.status(ctr.$status.BAD_REQUEST)
					.print({ status: 400, message: "Invalid storage name or key" });
			}
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}
			if (authCheck.method === "apiKey") {
				if (authCheck.apiKey.name.startsWith("token_exec_")) {
					ctr.skipRateLimit(); // Skip ratelimit as this is a action by a function
				}
			}
			const storage = await prisma.functionStorage.findFirst({
				where: { name: storageName, user: authCheck.user.id },
			});
			if (!storage) {
				return ctr
					.status(ctr.$status.NOT_FOUND)
					.print({ status: 404, message: "Storage not found" });
			}
			const item = await prisma.functionStorageItem.findFirst({
				where: { storageId: storage.id, key },
			});
			if (!item) {
				return ctr
					.status(ctr.$status.NOT_FOUND)
					.print({ status: 404, message: "Item not found" });
			}
			await prisma.functionStorageItem.delete({ where: { id: item.id } });
			return ctr.print({ status: "OK", message: "Item deleted" });
		}),
	);
