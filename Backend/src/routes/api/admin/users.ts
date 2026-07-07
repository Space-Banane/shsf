import * as bcrypt from "bcrypt";
import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { cleanupFunctionContainer } from "../../../lib/Runner";
import { createLogger } from "../../../lib/logger";

const log = createLogger("admin/users");

export = new fileRouter.Path("/")
	// List all users with their stats
	.http("GET", "/api/admin/users", (http) =>
		http
			.ratelimit((limit) => limit.hits(30).window(60000).penalty(1000))
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);
				if (!authCheck.success) return ctr.status(ctr.$status.UNAUTHORIZED).print({ status: "FAILED", message: authCheck.message });
				if (authCheck.user.role !== "Admin") return ctr.status(ctr.$status.FORBIDDEN).print({ status: "FAILED", message: "Admins only." });

				const users = await prisma.user.findMany({
					orderBy: { createdAt: "asc" },
					select: {
						id: true,
						displayName: true,
						email: true,
						role: true,
						allow_docker_mount: true,
						createdAt: true,
						updatedAt: true,
						_count: {
							select: {
								functions: true,
								namespaces: true,
								sessions: true,
							},
						},
					},
				});

				return ctr.print({ status: "OK", users });
			}),
	)
	// Create a new user (admin action, no password confirmation required)
	.http("POST", "/api/admin/users", (http) =>
		http
			.ratelimit((limit) => limit.hits(10).window(60000).penalty(5000))
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);
				if (!authCheck.success) return ctr.status(ctr.$status.UNAUTHORIZED).print({ status: "FAILED", message: authCheck.message });
				if (authCheck.user.role !== "Admin") return ctr.status(ctr.$status.FORBIDDEN).print({ status: "FAILED", message: "Admins only." });

				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						displayName: z.string().min(2).max(128),
						email: z.string().email().max(256),
						password: z.string().min(8).max(120),
						role: z.enum(["Admin", "User"]).default("User"),
						allow_docker_mount: z.boolean().default(false),
					}),
				);
				if (!data) return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

				const existing = await prisma.user.findUnique({ where: { email: data.email } });
				if (existing) {
					return ctr.status(ctr.$status.CONFLICT).print({ status: "FAILED", message: "A user with this email already exists." });
				}

				const password_hash = await bcrypt.hash(data.password, 10);

				const created = await prisma.user.create({
					data: {
						displayName: data.displayName,
						email: data.email,
						password: password_hash,
						role: data.role,
						allow_docker_mount: data.allow_docker_mount,
					},
					select: {
						id: true,
						displayName: true,
						email: true,
						role: true,
						allow_docker_mount: true,
						createdAt: true,
					},
				});

				log.info({ adminId: authCheck.user.id, createdUserId: created.id }, "Admin created user");
				return ctr.print({ status: "OK", user: created });
			}),
	)
	// Update a user's role, displayName, or docker mount permission
	.http("PATCH", "/api/admin/users/{id}", (http) =>
		http
			.ratelimit((limit) => limit.hits(20).window(60000).penalty(2000))
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);
				if (!authCheck.success) return ctr.status(ctr.$status.UNAUTHORIZED).print({ status: "FAILED", message: authCheck.message });
				if (authCheck.user.role !== "Admin") return ctr.status(ctr.$status.FORBIDDEN).print({ status: "FAILED", message: "Admins only." });

				const idParam = ctr.params.get("id");
				const targetId = parseInt(idParam ?? "");
				if (isNaN(targetId)) return ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: "Invalid user id." });

				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						displayName: z.string().min(2).max(128).optional(),
						role: z.enum(["Admin", "User"]).optional(),
						allow_docker_mount: z.boolean().optional(),
						password: z.string().min(8).max(120).optional(),
					}),
				);
				if (!data) return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

				const target = await prisma.user.findUnique({ where: { id: targetId } });
				if (!target) return ctr.status(ctr.$status.NOT_FOUND).print({ status: "FAILED", message: "User not found." });

				const updatePayload: Record<string, unknown> = {};
				if (data.displayName !== undefined) updatePayload.displayName = data.displayName;
				if (data.role !== undefined) updatePayload.role = data.role;
				if (data.allow_docker_mount !== undefined) updatePayload.allow_docker_mount = data.allow_docker_mount;
				if (data.password !== undefined) updatePayload.password = await bcrypt.hash(data.password, 10);

				if (Object.keys(updatePayload).length === 0) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: "Nothing to update." });
				}

				const updated = await prisma.user.update({
					where: { id: targetId },
					data: updatePayload,
					select: {
						id: true,
						displayName: true,
						email: true,
						role: true,
						allow_docker_mount: true,
						updatedAt: true,
					},
				});

				log.info({ adminId: authCheck.user.id, targetId, changes: Object.keys(updatePayload) }, "Admin updated user");
				return ctr.print({ status: "OK", user: updated });
			}),
	)
	// Delete a user and all their data
	.http("DELETE", "/api/admin/users/{id}", (http) =>
		http
			.ratelimit((limit) => limit.hits(5).window(60000).penalty(10000))
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);
				if (!authCheck.success) return ctr.status(ctr.$status.UNAUTHORIZED).print({ status: "FAILED", message: authCheck.message });
				if (authCheck.user.role !== "Admin") return ctr.status(ctr.$status.FORBIDDEN).print({ status: "FAILED", message: "Admins only." });

				const idParam = ctr.params.get("id");
				const targetId = parseInt(idParam ?? "");
				if (isNaN(targetId)) return ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: "Invalid user id." });

				if (targetId === authCheck.user.id) {
					return ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: "You cannot delete your own account from the admin panel." });
				}

				const target = await prisma.user.findUnique({
					where: { id: targetId },
					include: { functions: { select: { id: true } } },
				});
				if (!target) return ctr.status(ctr.$status.NOT_FOUND).print({ status: "FAILED", message: "User not found." });

				for (const fn of target.functions) {
					try {
						await cleanupFunctionContainer(fn.id);
					} catch (err) {
						log.error({ err, functionId: fn.id }, "Failed to clean up container during admin user delete");
					}
				}

				await prisma.user.delete({ where: { id: targetId } });

				log.info({ adminId: authCheck.user.id, deletedUserId: targetId }, "Admin deleted user");
				return ctr.print({ status: "OK", message: "User deleted." });
			}),
	);
