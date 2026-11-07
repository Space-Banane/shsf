import { createHash } from "crypto";
import { COOKIE, DOMAIN, fileRouter, prisma } from "../../..";
import { Cookie } from "rjweb-server";
import * as bcrypt from "bcrypt";
import { env } from "../../../lib/env";
import { getSessionCookieDomain } from "../../../lib/Authentication";

export = new fileRouter.Path("/").http("POST", "/api/account/login", (http) =>
	http
		.ratelimit((limit) => limit.hits(3).window(10000).penalty(0))
		.onRequest(async (ctr) => {
			if (env.SSO && !env.SSO.localLoginEnabled) return ctr.status(403).print({ status: "FAILED", message: "Local login is disabled" });
			const [data, error] = await ctr.bindBody((z) =>
				z.object({
					email: z.string().email().max(200),
					password: z.string().min(8).max(120),
				}),
			);

			if (!data)
				return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

			if (ctr.cookies.has(COOKIE) && ctr.getAuth().success) {
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

			if (!user || user.ssoIdentity) {
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

			await prisma.session.create({
				data: {
					userId: user.id,
					hash,
				},
			});

			ctr.cookies.set(
				COOKIE,
				new Cookie(hash, {
					domain: getSessionCookieDomain(DOMAIN),
					expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
				}),
			);

			ctr.print({
				status: "OK",
				message: "Welcome back!",
			});

			return ctr;
		}),
);
