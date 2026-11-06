import { API_KEY_HEADER, COOKIE, fileRouter } from "../..";
import { checkAuthentication } from "../../lib/Authentication";
import {
	StorageServiceError,
	functionStorageService,
} from "../../lib/FunctionStorageService";
import { OpenAPITags } from "../../lib/openapi";
import { prisma } from "../..";
import {
	type Access,
	describeStorageAccess,
	storageAccessInclude,
	storageAccessWhere,
} from "../../lib/Sharing";

// rjweb's route context is inferred inside chained route builders; this helper
// keeps route bodies small while preserving the framework-provided shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getStorageAuthUser(ctr: any) {
	const authCheck = await checkAuthentication(
		ctr.cookies.get(COOKIE),
		ctr.headers.get(API_KEY_HEADER),
	);
	if (!authCheck.success) {
		return { error: ctr.print({ status: 401, message: authCheck.message }) };
	}
	if (
		authCheck.method === "apiKey" &&
		authCheck.apiKey.name.startsWith("token_exec_")
	) {
		ctr.skipRateLimit();
	}
	return { userId: authCheck.user.id };
}

// Storage is addressed by name within its owner's account. `?owner=<userId>`
// selects a storage shared by another user; access is checked here and the
// service then runs scoped to that owner. Returns null when not permitted, so
// unauthorized storages are indistinguishable from missing ones.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveStorageOwner(ctr: any, userId: number, storageName: string, need: Access) {
	const owner = Number(ctr.queries.get("owner"));
	if (!Number.isInteger(owner) || owner <= 0 || owner === userId) return userId;
	if (need === "owner") return null;
	const storage = await prisma.functionStorage.findFirst({
		where: { name: storageName, user: owner, ...storageAccessWhere(userId, need) },
		select: { id: true },
	});
	return storage ? owner : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function printStorageNotFound(ctr: any) {
	return ctr.status(404).print({ status: 404, message: "Storage not found" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function printStorageError(ctr: any, error: unknown) {
	if (error instanceof StorageServiceError) {
		return ctr
			.status(error.statusCode)
			.print({ status: error.statusCode, message: error.message });
	}

	return ctr.status(500).print({
		status: 500,
		message: error instanceof Error ? error.message : "Storage request failed",
	});
}

export = new fileRouter.Path("/")
	// ------ Function Storages ------
	.http("POST", "/api/storage", (http) =>
		http
			.document({
				description: "Create a new function storage",
				tags: ["Storage"] as OpenAPITags[],
				operationId: "createStorage",
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["name", "purpose"],
								properties: {
									name: {
										type: "string",
										description: "Storage name (alphanumeric, underscores, hyphens)",
									},
									purpose: {
										type: "string",
										description: "Description of the storage purpose",
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "Storage created successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: { type: "object" },
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						name: z
							.string()
							.min(1)
							.max(128)
							.regex(
								/^[a-zA-Z0-9_-]+$/,
								"Name must be alphanumeric with underscores or hyphens",
							),
						purpose: z.string().min(1).max(256),
					}),
				);
				if (!data) {
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print({ status: 400, message: error.toString() });
				}
				const auth = await getStorageAuthUser(ctr);
				if ("error" in auth) return auth.error;

				try {
					const storage = await functionStorageService.createStorage(
						auth.userId,
						data.name,
						data.purpose,
					);
					return ctr.print({ status: "OK", data: storage });
				} catch (storageError) {
					return printStorageError(ctr, storageError);
				}
			}),
	)

	.http("GET", "/api/storage", (http) =>
		http
			.document({
				description: "List all storages for the authenticated user",
				tags: ["Storage"] as OpenAPITags[],
				operationId: "listStorages",
				responses: {
					200: {
						description: "List of storages",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: { type: "array", items: { type: "object" } },
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const auth = await getStorageAuthUser(ctr);
				if ("error" in auth) return auth.error;
				const storages = await prisma.functionStorage.findMany({
					where: storageAccessWhere(auth.userId, "view"),
					include: storageAccessInclude(auth.userId),
				});
				return ctr.print({
					status: "OK",
					data: storages.map((s) => describeStorageAccess(auth.userId, s)),
				});
			}),
	)

	.http("DELETE", "/api/storage/{storageName}", (http) =>
		http
			.document({
				description: "Delete a storage and all its items by name",
				tags: ["Storage"] as OpenAPITags[],
				operationId: "deleteStorage",
				responses: {
					200: {
						description: "Storage deleted successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										message: { type: "string" },
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const storageName = ctr.params.get("storageName");
				if (!storageName) {
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print({ status: 400, message: "Invalid storage name" });
				}
				const auth = await getStorageAuthUser(ctr);
				if ("error" in auth) return auth.error;
				const ownerId = await resolveStorageOwner(ctr, auth.userId, storageName, "owner");
				if (ownerId === null) return printStorageNotFound(ctr);

				try {
					const result = await functionStorageService.deleteStorage(
						ownerId,
						storageName,
					);
					return ctr.print({ status: "OK", message: result.message });
				} catch (storageError) {
					return printStorageError(ctr, storageError);
				}
			}),
	)

	.http("DELETE", "/api/storage/{storageName}/items", (http) =>
		http
			.document({
				description: "Clear all items in a storage by name",
				tags: ["Storage"] as OpenAPITags[],
				operationId: "clearStorageItems",
				responses: {
					200: {
						description: "All items cleared",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										message: { type: "string" },
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const storageName = ctr.params.get("storageName");
				if (!storageName) {
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print({ status: 400, message: "Invalid storage name" });
				}
				const auth = await getStorageAuthUser(ctr);
				if ("error" in auth) return auth.error;
				const ownerId = await resolveStorageOwner(ctr, auth.userId, storageName, "edit");
				if (ownerId === null) return printStorageNotFound(ctr);

				try {
					const result = await functionStorageService.clearStorageItems(
						ownerId,
						storageName,
					);
					return ctr.print({ status: "OK", message: result.message });
				} catch (storageError) {
					return printStorageError(ctr, storageError);
				}
			}),
	)

	// ------ Function Storage Items ------
	.http("POST", "/api/storage/{storageName}/item", (http) =>
		http
			.document({
				description: "Create or update a storage item by key",
				tags: ["Storage"] as OpenAPITags[],
				operationId: "setStorageItem",
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["key", "value"],
								properties: {
									key: {
										type: "string",
										description: "Item key (alphanumeric, underscores, hyphens)",
									},
									value: {
										description: "Item value (any type)",
									},
									expiresAt: {
										description: "Expiration as ISO datetime string or hours (number)",
										oneOf: [{ type: "string" }, { type: "number" }],
									},
								},
							},
						},
					},
				},
				responses: {
					200: {
						description: "Item created or updated successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: { type: "object" },
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
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
								/^[a-zA-Z0-9_-]+$/,
								"Key must be alphanumeric with underscores or hyphens",
							),
						value: z.any(),
						expiresAt: z.union([z.string(), z.number()]).optional(),
					}),
				);
				if (!data) {
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print({ status: 400, message: error.toString() });
				}
				const auth = await getStorageAuthUser(ctr);
				if ("error" in auth) return auth.error;
				const ownerId = await resolveStorageOwner(ctr, auth.userId, storageName, "edit");
				if (ownerId === null) return printStorageNotFound(ctr);

				try {
					const item = await functionStorageService.setStorageItem(
						ownerId,
						storageName,
						{
							key: data.key,
							value: data.value,
							expiresAt: data.expiresAt,
						},
					);
					return ctr.print({ status: "OK", data: item });
				} catch (storageError) {
					return printStorageError(ctr, storageError);
				}
			}),
	)

	.http("GET", "/api/storage/{storageName}/item/{key}", (http) =>
		http
			.document({
				description: "Get a storage item by key",
				tags: ["Storage"] as OpenAPITags[],
				operationId: "getStorageItem",
				responses: {
					200: {
						description: "Storage item retrieved",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: { type: "object" },
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const storageName = ctr.params.get("storageName");
				const key = ctr.params.get("key");
				if (!storageName || !key) {
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print({ status: 400, message: "Invalid storage name or key" });
				}
				const auth = await getStorageAuthUser(ctr);
				if ("error" in auth) return auth.error;
				const ownerId = await resolveStorageOwner(ctr, auth.userId, storageName, "view");
				if (ownerId === null) return printStorageNotFound(ctr);

				try {
					const item = await functionStorageService.getStorageItem(
						ownerId,
						storageName,
						key,
					);
					return ctr.print({ status: "OK", data: item });
				} catch (storageError) {
					return printStorageError(ctr, storageError);
				}
			}),
	)

	.http("GET", "/api/storage/{storageName}/items", (http) =>
		http
			.document({
				description: "Get all non-expired items in a storage",
				tags: ["Storage"] as OpenAPITags[],
				operationId: "listStorageItems",
				responses: {
					200: {
						description: "List of storage items",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										data: { type: "array", items: { type: "object" } },
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const storageName = ctr.params.get("storageName");
				if (!storageName) {
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print({ status: 400, message: "Invalid storage name" });
				}
				const auth = await getStorageAuthUser(ctr);
				if ("error" in auth) return auth.error;
				const ownerId = await resolveStorageOwner(ctr, auth.userId, storageName, "view");
				if (ownerId === null) return printStorageNotFound(ctr);

				try {
					const items = await functionStorageService.listStorageItems(
						ownerId,
						storageName,
					);
					return ctr.print({ status: "OK", data: items });
				} catch (storageError) {
					return printStorageError(ctr, storageError);
				}
			}),
	)

	.http("DELETE", "/api/storage/{storageName}/item/{key}", (http) =>
		http
			.document({
				description: "Delete a storage item by key",
				tags: ["Storage"] as OpenAPITags[],
				operationId: "deleteStorageItem",
				responses: {
					200: {
						description: "Item deleted successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string" },
										message: { type: "string" },
									},
								},
							},
						},
					},
				},
			})
			.onRequest(async (ctr) => {
				const storageName = ctr.params.get("storageName");
				const key = ctr.params.get("key");
				if (!storageName || !key) {
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print({ status: 400, message: "Invalid storage name or key" });
				}
				const auth = await getStorageAuthUser(ctr);
				if ("error" in auth) return auth.error;
				const ownerId = await resolveStorageOwner(ctr, auth.userId, storageName, "edit");
				if (ownerId === null) return printStorageNotFound(ctr);

				try {
					const result = await functionStorageService.deleteStorageItem(
						ownerId,
						storageName,
						key,
					);
					return ctr.print({ status: "OK", message: result.message });
				} catch (storageError) {
					return printStorageError(ctr, storageError);
				}
			}),
	);
