import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";

export = new fileRouter.Path("/")
	.http("GET", "/api/account/env", (http) =>
		http
			.ratelimit((limit) => limit.hits(20).window(60000).penalty(5000))
			.onRequest(async (ctr) => {
				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);

				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						message: authCheck.message,
					});
				}

				const user = await prisma.user.findUnique({
					where: {
						id: authCheck.user.id,
					},
					select: {
						accountEnv: true,
					},
				});

				if (!user) {
					return ctr.status(ctr.$status.NOT_FOUND).print({
						status: "FAILED",
						message: "User not found",
					});
				}

				let accountEnv = [];
				if (user.accountEnv) {
					try {
						accountEnv = JSON.parse(user.accountEnv);
					} catch (e) {
						console.error("Error parsing accountEnv:", e);
					}
				}

				return ctr.print({
					status: "OK",
					data: accountEnv,
				});
			})
	)
	.http("POST", "/api/account/env", (http) =>
		http
			.ratelimit((limit) => limit.hits(10).window(60000).penalty(5000))
			.onRequest(async (ctr) => {
				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						env: z.array(
							z.object({
								name: z.string().min(1).max(256),
								value: z.string().max(4096),
							})
						),
					})
				);

				if (!data)
					return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

				const authCheck = await checkAuthentication(
					ctr.cookies.get(COOKIE),
					ctr.headers.get(API_KEY_HEADER),
				);

				if (!authCheck.success) {
					return ctr.status(ctr.$status.UNAUTHORIZED).print({
						status: "FAILED",
						message: authCheck.message,
					});
				}

				// Validate env variable names (no special characters, spaces, etc.)
				for (const envVar of data.env) {
					if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(envVar.name)) {
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: "FAILED",
							message: `Invalid environment variable name: ${envVar.name}. Must start with a letter or underscore and contain only letters, numbers, and underscores.`,
						});
					}
				}

				// Update user's account environment variables
				await prisma.user.update({
					where: {
						id: authCheck.user.id,
					},
					data: {
						accountEnv: JSON.stringify(data.env),
					},
				});

				return ctr.print({
					status: "OK",
					message: "Account environment variables updated successfully",
					data: data.env,
				});
			})
	);
