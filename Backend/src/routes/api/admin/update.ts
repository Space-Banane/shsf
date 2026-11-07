import { API_KEY_HEADER, COOKIE, fileRouter } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { getAutoUpdateEnabled, setAutoUpdateEnabled } from "../../../lib/DataManager";
import {
	UpdateBusyError,
	UpdateNotCancellableError,
	applyUpdate,
	cancelUpdate,
	checkForUpdate,
	getOperation,
	getUpdateStatus,
	listOperations,
	serializeOperation,
} from "../../../lib/Updater";

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

export = new fileRouter.Path("/")
	// GET /api/admin/update — current status (latest operation + last check)
	.http("GET", "/api/admin/update", (http) =>
		http
			.ratelimit((limit) => limit.hits(30).window(60000).penalty(1000))
			.onRequest(async (ctr) => {
				const auth = await requireAdmin(ctr);
				if (auth.error) return auth.error;

				const [autoUpdateEnabled, status] = await Promise.all([getAutoUpdateEnabled(), getUpdateStatus()]);
				const check = status.lastCheck;

				return ctr.print({
					status: "OK",
					autoUpdateEnabled,
					checking: status.checking,
					applying: status.applying,
					operation: status.operation,
					lastCheckedAt: check?.checkedAt ?? null,
					updateAvailable: check?.updateAvailable ?? null,
					currentImageId: check?.currentImageId?.slice(7, 19) ?? null,
					newImageId: check?.newImageId?.slice(7, 19) ?? null,
				});
			}),
	)

	// PATCH /api/admin/update — toggle auto-update
	.http("PATCH", "/api/admin/update", (http) =>
		http
			.ratelimit((limit) => limit.hits(10).window(60000).penalty(2000))
			.onRequest(async (ctr) => {
				const auth = await requireAdmin(ctr);
				if (auth.error) return auth.error;

				const [data, error] = await ctr.bindBody((z) => z.object({ autoUpdateEnabled: z.boolean() }));
				if (!data) return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

				await setAutoUpdateEnabled(data.autoUpdateEnabled);
				return ctr.print({ status: "OK", autoUpdateEnabled: data.autoUpdateEnabled });
			}),
	)

	// POST /api/admin/update/check — pull the tracked image and detect if an update is available
	.http("POST", "/api/admin/update/check", (http) =>
		http
			.ratelimit((limit) => limit.hits(5).window(300000).penalty(60000))
			.onRequest(async (ctr) => {
				const auth = await requireAdmin(ctr);
				if (auth.error) return auth.error;

				try {
					const result = await checkForUpdate();
					return ctr.print({
						status: "OK",
						updateAvailable: result.updateAvailable,
						currentImageId: result.currentImageId.slice(7, 19),
						newImageId: result.newImageId?.slice(7, 19) ?? null,
					});
				} catch (err) {
					return ctr
						.status(err instanceof UpdateBusyError ? ctr.$status.CONFLICT : ctr.$status.INTERNAL_SERVER_ERROR)
						.print({ status: "FAILED", message: err instanceof Error ? err.message : "Update check failed" });
				}
			}),
	)

	// POST /api/admin/update/apply — start an update; returns a durable operation ID, not success
	.http("POST", "/api/admin/update/apply", (http) =>
		http
			.ratelimit((limit) => limit.hits(5).window(3600000).penalty(600000))
			.onRequest(async (ctr) => {
				const auth = await requireAdmin(ctr);
				if (auth.error) return auth.error;

				try {
					const { operationId } = await applyUpdate("manual");
					return ctr.status(ctr.$status.ACCEPTED).print({
						status: "OK",
						operationId,
						message:
							"Update started. It is only complete once the new version passes its readiness checks; follow the operation for progress.",
					});
				} catch (err) {
					return ctr
						.status(err instanceof UpdateBusyError ? ctr.$status.CONFLICT : ctr.$status.INTERNAL_SERVER_ERROR)
						.print({ status: "FAILED", message: err instanceof Error ? err.message : "Update apply failed" });
				}
			}),
	)

	// GET /api/admin/update/operations — recent operations (without output)
	.http("GET", "/api/admin/update/operations", (http) =>
		http
			.ratelimit((limit) => limit.hits(30).window(60000).penalty(1000))
			.onRequest(async (ctr) => {
				const auth = await requireAdmin(ctr);
				if (auth.error) return auth.error;

				const rows = await listOperations(10);
				return ctr.print({ status: "OK", operations: rows.map((row) => serializeOperation(row)) });
			}),
	)

	// GET /api/admin/update/operations/{id} — one operation including logs
	.http("GET", "/api/admin/update/operations/{id}", (http) =>
		http
			.ratelimit((limit) => limit.hits(60).window(60000).penalty(1000))
			.onRequest(async (ctr) => {
				const auth = await requireAdmin(ctr);
				if (auth.error) return auth.error;

				const row = await getOperation(ctr.params.get("id") ?? "");
				if (!row) return ctr.status(ctr.$status.NOT_FOUND).print({ status: "FAILED", message: "Operation not found" });
				return ctr.print({ status: "OK", operation: serializeOperation(row, true) });
			}),
	)

	// POST /api/admin/update/operations/{id}/cancel — only possible before the replacement starts
	.http("POST", "/api/admin/update/operations/{id}/cancel", (http) =>
		http
			.ratelimit((limit) => limit.hits(10).window(60000).penalty(2000))
			.onRequest(async (ctr) => {
				const auth = await requireAdmin(ctr);
				if (auth.error) return auth.error;

				try {
					await cancelUpdate(ctr.params.get("id") ?? "");
					return ctr.print({ status: "OK" });
				} catch (err) {
					const message = err instanceof Error ? err.message : "Cancel failed";
					return ctr
						.status(err instanceof UpdateNotCancellableError ? ctr.$status.CONFLICT : ctr.$status.NOT_FOUND)
						.print({ status: "FAILED", message });
				}
			}),
	);
