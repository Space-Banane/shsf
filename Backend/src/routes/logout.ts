import { COOKIE, fileRouter, prisma } from "..";
import { OpenAPITags } from "../lib/openapi";

export = new fileRouter.Path("/").http("PATCH", "/api/logout", (http) =>
	http
		.document({
			description: "Logout the current user and invalidate their session",
			tags: ["User"] as OpenAPITags[],
			operationId: "logoutUser",
			responses: {
				200: {
					description: "User logged out successfully",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: { type: "string" },
									message: { type: "string" },
								},
							},
						},
					},
				},
			},
		})
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
		}),
);
