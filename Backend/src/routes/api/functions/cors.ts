import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";

export = new fileRouter.Path("/")
	// New route to GET/PATCH CORS origins for a function
	.http("GET", "/api/function/{id}/cors-origins", (http) =>
		http.onRequest(async (ctr) => {
			const id = ctr.params.get("id");
			if (!id) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Missing function id",
				});
			}
			const functionId = parseInt(id);
			if (isNaN(functionId)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Invalid function id",
				});
			}

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

			const fn = await prisma.function.findFirst({
				where: {
					id: functionId,
					userId: authCheck.user.id,
				},
				select: { cors_origins: true },
			});
			if (!fn) {
				return ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "Function not found",
				});
			}
			return ctr.print({
				status: "OK",
				cors_origins: fn.cors_origins,
			});
		}),
	)
	.http("PATCH", "/api/function/{id}/cors-origins", (http) =>
		http.onRequest(async (ctr) => {
			const id = ctr.params.get("id");
			if (!id) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Missing function id",
				});
			}
			const functionId = parseInt(id);
			if (isNaN(functionId)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: "Invalid function id",
				});
			}

			const [data, error] = await ctr.bindBody((z) =>
				z.object({
					cors_origins: z.string().max(2048),
				}),
			);
			if (!data) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					status: 400,
					message: error.toString(),
				});
			}

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

			const fn = await prisma.function.findFirst({
				where: {
					id: functionId,
					userId: authCheck.user.id,
				},
			});
			if (!fn) {
				return ctr.status(ctr.$status.NOT_FOUND).print({
					status: 404,
					message: "Function not found",
				});
			}

			// Validate and normalize CORS origins
			const rawOrigins = data.cors_origins
				.split(",")
				.map((o) => o.trim())
				.filter((o) => o.length > 0);
			const validated: string[] = [];

			for (const origin of rawOrigins) {
				if (origin === "*") {
					validated.push("*");
					continue;
				}

				try {
					const url = new URL(origin);
					if (url.protocol !== "http:" && url.protocol !== "https:") {
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: 400,
							message: `Invalid CORS origin '${origin}': only http and https schemes are allowed.`,
						});
					}
					if (url.origin === "null") {
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: 400,
							message: `Invalid CORS origin '${origin}': opaque origins are not allowed.`,
						});
					}
					if (url.username || url.password) {
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: 400,
							message: `Invalid CORS origin '${origin}': credentials are not allowed.`,
						});
					}
					if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
						return ctr.status(ctr.$status.BAD_REQUEST).print({
							status: 400,
							message: `Invalid CORS origin '${origin}': path, query, and fragments are not allowed.`,
						});
					}
					validated.push(url.origin);
				} catch {
					return ctr.status(ctr.$status.BAD_REQUEST).print({
						status: 400,
						message: `Invalid CORS origin '${origin}': must be a valid URL (scheme://host[:port]).`,
					});
				}
			}
			data.cors_origins = Array.from(new Set(validated)).join(",");

			await prisma.function.update({
				where: { id: functionId },
				data: { cors_origins: data.cors_origins },
			});

			return ctr.print({
				status: "OK",
				cors_origins: data.cors_origins,
			});
		}),
	);
