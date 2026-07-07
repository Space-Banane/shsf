import { API_KEY_HEADER, COOKIE, fileRouter } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { getExternalAccessDisabled, setExternalAccessDisabled } from "../../../lib/DataManager";

export = new fileRouter.Path("/")
	.http("GET", "/api/global/external-access-disabled", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) return ctr.status(ctr.$status.UNAUTHORIZED).print({ status: "FAILED", message: authCheck.message });
			if (authCheck.user.role !== "Admin") return ctr.status(ctr.$status.FORBIDDEN).print({ status: "FAILED", message: "Admins only." });
			return ctr.print({ status: "OK", disabled: await getExternalAccessDisabled() });
		}),
	)
	.http("PATCH", "/api/global/external-access-disabled", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
				ctr.cookies.get(COOKIE),
				ctr.headers.get(API_KEY_HEADER),
			);
			if (!authCheck.success) return ctr.status(ctr.$status.UNAUTHORIZED).print({ status: "FAILED", message: authCheck.message });
			if (authCheck.user.role !== "Admin") return ctr.status(ctr.$status.FORBIDDEN).print({ status: "FAILED", message: "Admins only." });

			const [data, error] = await ctr.bindBody((z) => z.object({ disabled: z.boolean() }));
			if (!data) return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

			await setExternalAccessDisabled(data.disabled);
			return ctr.print({ status: "OK", disabled: data.disabled });
		}),
	);
