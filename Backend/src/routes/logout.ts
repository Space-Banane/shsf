import { COOKIE, fileRouter, prisma } from "..";

export = new fileRouter.Path("/").http("PATCH", "/api/logout", (http) =>
	http
		.ratelimit((limit) => limit.hits(1).window(2000).penalty(100))
		.onRequest(async (ctr) => {
			if (!ctr.cookies.has(COOKIE)) {
				return ctr
					.status(403)
					.print({ status: "FAILED", message: "You're not logged in!" });
			}

			const session = await prisma.session.findFirst({
				where: {
					hash: ctr.cookies.get(COOKIE)!,
				},
			});

			if (!session) {
				return ctr
					.status(403)
					.print({ status: "FAILED", message: "You're not logged in!" });
			}

			await prisma.session.delete({
				where: {
					id: session.id,
				},
			});

			ctr.cookies.delete(COOKIE);

			return ctr.print({
				status: "OK",
				message: "Logged out successfully!",
			});
		})
);
