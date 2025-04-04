import { API_KEY_HEADER, COOKIE, fileRouter } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";

export = new fileRouter.Path("/").http("GET", "/api/account/getUserInfo", (http) =>
	http
		.onRequest(async (ctr) => {
			const authCheck = await checkAuthentication(
                ctr.cookies.get(COOKIE),
                ctr.headers.get(API_KEY_HEADER),
            );

            if (!authCheck.success) {
                return ctr.print({
                    status: 401,
                    message: authCheck.message,
                });
            } 

			return ctr.print({
				status: "OK",
				user: authCheck.user,
                session: authCheck.method === "session" ? authCheck.session : null,
                apiKey: authCheck.method === "apiKey" ? authCheck.apiKey : null,
			});
		})
);
