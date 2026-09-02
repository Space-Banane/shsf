import { API_KEY_HEADER, COOKIE, fileRouter } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import {
	getAutoUpdateEnabled,
	setAutoUpdateEnabled,
	getUpdateLastCheck,
} from "../../../lib/DataManager";
import { getUpdateState, checkForUpdate, applyUpdate } from "../../../lib/Updater";

export = new fileRouter.Path("/")
	// GET /api/admin/update — current status
	.http("GET", "/api/admin/update", (http) =>
		http
			.ratelimit((limit) => limit.hits(30).window(60000).penalty(1000))
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);
				if (!authCheck.success)
					return ctr
						.status(ctr.$status.UNAUTHORIZED)
						.print({ status: "FAILED", message: authCheck.message });
				if (authCheck.user.role !== "Admin")
					return ctr
						.status(ctr.$status.FORBIDDEN)
						.print({ status: "FAILED", message: "Admins only." });

				const [autoUpdateEnabled, lastCheck] = await Promise.all([
					getAutoUpdateEnabled(),
					getUpdateLastCheck(),
				]);

				const live = getUpdateState();

				return ctr.print({
					status: "OK",
					autoUpdateEnabled,
					phase: live.phase,
					error: live.error,
					// Prefer live in-memory state; fall back to persisted last-check
					lastCheckedAt: live.lastCheckedAt?.toISOString() ?? lastCheck?.checkedAt ?? null,
					updateAvailable: live.updateAvailable ?? lastCheck?.updateAvailable ?? null,
					currentImageId: (live.currentImageId ?? lastCheck?.currentImageId ?? null)?.slice(7, 19) ?? null,
					newImageId: (live.newImageId ?? lastCheck?.newImageId ?? null)?.slice(7, 19) ?? null,
				});
			}),
	)

	// PATCH /api/admin/update — toggle auto-update
	.http("PATCH", "/api/admin/update", (http) =>
		http
			.ratelimit((limit) => limit.hits(10).window(60000).penalty(2000))
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);
				if (!authCheck.success)
					return ctr
						.status(ctr.$status.UNAUTHORIZED)
						.print({ status: "FAILED", message: authCheck.message });
				if (authCheck.user.role !== "Admin")
					return ctr
						.status(ctr.$status.FORBIDDEN)
						.print({ status: "FAILED", message: "Admins only." });

				const [data, error] = await ctr.bindBody((z) =>
					z.object({ autoUpdateEnabled: z.boolean() }),
				);
				if (!data)
					return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

				await setAutoUpdateEnabled(data.autoUpdateEnabled);

				return ctr.print({
					status: "OK",
					autoUpdateEnabled: data.autoUpdateEnabled,
				});
			}),
	)

	// POST /api/admin/update/check — pull latest image and detect if update is available
	.http("POST", "/api/admin/update/check", (http) =>
		http
			.ratelimit((limit) => limit.hits(5).window(300000).penalty(60000))
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);
				if (!authCheck.success)
					return ctr
						.status(ctr.$status.UNAUTHORIZED)
						.print({ status: "FAILED", message: authCheck.message });
				if (authCheck.user.role !== "Admin")
					return ctr
						.status(ctr.$status.FORBIDDEN)
						.print({ status: "FAILED", message: "Admins only." });

				const current = getUpdateState();
				if (current.phase !== "idle") {
					return ctr.status(ctr.$status.CONFLICT).print({
						status: "FAILED",
						message: `Operation already in progress: ${current.phase}`,
					});
				}

				try {
					const result = await checkForUpdate();
					return ctr.print({
						status: "OK",
						updateAvailable: result.updateAvailable,
						currentImageId: result.currentImageId.slice(7, 19),
						newImageId: result.newImageId?.slice(7, 19) ?? null,
					});
				} catch (err) {
					return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
						status: "FAILED",
						message: err instanceof Error ? err.message : "Update check failed",
					});
				}
			}),
	)

	// POST /api/admin/update/apply — recreate container with the pulled image
	.http("POST", "/api/admin/update/apply", (http) =>
		http
			.ratelimit((limit) => limit.hits(3).window(3600000).penalty(3600000))
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);
				if (!authCheck.success)
					return ctr
						.status(ctr.$status.UNAUTHORIZED)
						.print({ status: "FAILED", message: authCheck.message });
				if (authCheck.user.role !== "Admin")
					return ctr
						.status(ctr.$status.FORBIDDEN)
						.print({ status: "FAILED", message: "Admins only." });

				const current = getUpdateState();
				if (current.phase !== "idle") {
					return ctr.status(ctr.$status.CONFLICT).print({
						status: "FAILED",
						message: `Operation already in progress: ${current.phase}`,
					});
				}

				try {
					const result = await applyUpdate();
					return ctr.print({
						status: "OK",
						method: result.method,
						message:
							result.method === "compose"
								? "Pulling and force-recreating the Docker Compose project — the service will be briefly unavailable."
								: "Recreating container directly — the service will be briefly unavailable.",
					});
				} catch (err) {
					return ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({
						status: "FAILED",
						message: err instanceof Error ? err.message : "Update apply failed",
					});
				}
			}),
	);
