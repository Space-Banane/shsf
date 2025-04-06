import { createHash } from "crypto";
import { COOKIE, DOMAIN, fileRouter, prisma } from "../../..";
import { Cookie } from "rjweb-server";
import * as bcrypt from "bcrypt";

export = new fileRouter.Path("/").http("POST", "/api/account/login", (http) =>
	http
		.ratelimit((limit) => limit.hits(3).window(10000).penalty(0))
		.onRequest(async (ctr) => {
			const [data, error] = await ctr.bindBody((z) =>
				z.object({
					email: z.string().email().max(200),
					password: z.string().min(8).max(120),
				})
			);

			if (!data)
				return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

			if (ctr.cookies.has(COOKIE)) {
				return ctr.status(ctr.$status.BAD_REQUEST).print({
					message: "You are already logged in",
					status: "FAILED",
				});
			}

			const user = await prisma.user.findFirst({
				where: {
					email: data.email,
				},
			});

			if (!user) {
				return ctr.status(ctr.$status.UNAUTHORIZED).print({
					message: "Invalid Credentials",
					status: "FAILED",
				});
			}

			if (!user.password) {
				return ctr.status(ctr.$status.UNAUTHORIZED).print({
					message: "No password set for this account",
					status: "FAILED",
				});
			}

			const passwordMatch = await bcrypt.compare(data.password, user.password);

			if (!passwordMatch) {
				return ctr.status(ctr.$status.UNAUTHORIZED).print({
					message: "Invalid Credentials",
					status: "FAILED",
				});
			}

			const hash = createHash("sha256")
				.update(`${Date.now()}+${user.email}`)
				.digest("hex");

			const session = await prisma.session.create({
				data: {
					userId: user.id,
					hash,
				},
			});

			let newdomain = "";
			if (DOMAIN === "localhost") {
				newdomain = "localhost";
			} else {
				if (DOMAIN.split(".").length > 2) {
					// we are on a subdomain
					newdomain = DOMAIN.split(".").slice(1).join("."); // Ex. "sub.domain.com" => "domain.com"
				} else {
					newdomain = "." + DOMAIN;
				}
			}

			ctr.cookies.set(
				COOKIE,
				new Cookie(hash, {
					domain: newdomain,
					expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
				})
			);

			ctr.print({
				status: "OK",
				message: "Welcome back!",
			});

			return ctr;
		})
);
