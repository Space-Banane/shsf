import { API_KEY_HEADER, COOKIE, fileRouter } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";
import * as bcrypt from "bcrypt";

export = new fileRouter.Path("/").http(
	"POST",
	"/api/global/showSecret",
	(http) =>
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

				if (authCheck.user.role !== "Admin") {
					return ctr.print({
						status: 403,
						message: "You must be an admin to view the secret.",
					});
				}

				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						password: z.string().min(1),
					}),
				);

				if (!data)
					return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

				if (!authCheck.user.password) {
					return ctr.print({
						status: 403,
						message: "No password set for this account.",
					});
				}

				const passwordMatch = await bcrypt.compare(data.password, authCheck.user.password);
				if (!passwordMatch) {
					return ctr.print({
						status: 403,
						message: "Incorrect password.",
					});
				}

				return ctr.print({
					status: "OK",
					secret: process.env.INSTANCE_SECRET || "No secret set",
				});
			}),
);
