import { API_KEY_HEADER, COOKIE, fileRouter } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { getLinkLock, setLinkLock } from "../../../lib/DataManager";

export = new fileRouter.Path("/")
	.http("GET", "/api/global/link-lock", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);

			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}

			if (authCheck.user.role !== "Admin") {
				return ctr.print({ status: 403, message: "Admins only." });
			}

			return ctr.print({ status: "OK", locked: await getLinkLock() });
		}),
	)
	.http("PATCH", "/api/global/link-lock", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);

			if (!authCheck.success) {
				return ctr.print({ status: 401, message: authCheck.message });
			}

			if (authCheck.user.role !== "Admin") {
				return ctr.print({ status: 403, message: "Admins only." });
			}

			const [data, error] = await ctr.bindBody((z) =>
				z.object({ locked: z.boolean() }),
			);

			if (!data)
				return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

			await setLinkLock(data.locked);

			return ctr.print({ status: "OK", locked: data.locked });
		}),
	);
