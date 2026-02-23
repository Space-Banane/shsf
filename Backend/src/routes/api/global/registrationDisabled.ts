import { API_KEY_HEADER, COOKIE, fileRouter } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import { getRegistrationDisabled, setRegistrationDisabled } from "../../../lib/DataManager";

export = new fileRouter.Path("/")
	.http("GET", "/api/global/registration-disabled", (http) =>
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

			return ctr.print({ status: "OK", disabled: await getRegistrationDisabled() });
		}),
	)
	.http("PATCH", "/api/global/registration-disabled", (http) =>
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
				z.object({ disabled: z.boolean() }),
			);

			if (!data)
				return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

			await setRegistrationDisabled(data.disabled);

			return ctr.print({ status: "OK", disabled: data.disabled });
		}),
	);
