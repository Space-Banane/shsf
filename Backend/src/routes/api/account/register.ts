import { createHash, randomBytes } from "crypto";
import { COOKIE, DOMAIN, fileRouter, prisma } from "../../..";
import { Cookie } from "rjweb-server";
import * as bcrypt from "bcrypt";
import { env } from "process";

export = new fileRouter.Path("/").http(
	"POST",
	"/api/account/register",
	(http) =>
		http
			.ratelimit((limit) => limit.hits(1).window(20000).penalty(2000))
			.onRequest(async (ctr) => {
				if (env.REGISTER_DISABLED === "true") {
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print("Registration is disabled");
				} 
				const [data, error] = await ctr.bindBody((z) =>
					z.object({
						display_name: z.string().max(128),
						email: z.string().email().max(200),
						password: z.string().min(8).max(120),
						password_confirm: z.string().min(8).max(120)
					})
				);

				if (!data)
					return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

				if (data.password !== data.password_confirm) {
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print("Passwords do not match");
				}

				if (ctr.cookies.has(COOKIE)) {
                    return ctr.status(ctr.$status.BAD_REQUEST).print({
                      message: "You are already logged in",
                      status: "FAILED",
                    });
                  }

				// ! Make sure user does NOT exist
				const email_check = await prisma.user.findFirst({
					where: {
						email: data.email,
					},
				});

				if (email_check) {
					ctr.clearRateLimit();
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print("Email already in use");
				}

				if (data.display_name.length < 3) {
					ctr.clearRateLimit();
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print("Display Name must be at least 3 characters long");
				}

				if (
					data.display_name.includes("[") ||
					data.display_name.includes("]")
				) {
					return ctr.status(400).print("Display Name can not contain [ or ]");
				}
				if (data.display_name === "") {
					ctr.clearRateLimit();
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print("Display Name cannot be empty");
				}

				if (data.email === "") {
					ctr.clearRateLimit();
					return ctr
						.status(ctr.$status.BAD_REQUEST)
						.print("Email cannot be empty");
				}

				const password_hash = await bcrypt.hash(data.password, 10);

				const hash = createHash("sha256")
					.update(
						`${Date.now()}+${data.email}+${randomBytes(16).toString("hex")}`
					)
					.digest("hex");

				const icon_url = "https://cdn.reversed.dev/pictures/default.png";

				const user = await prisma.user
					.create({
						data: {
							displayName: data.display_name,
							email: data.email,
							password: password_hash,
							avatar_url: icon_url,
							sessions: {
								create: {
									hash
								},
							},
						},
					})
					.catch(async (e) => {
						ctr.clearRateLimit();
						ctr.status(ctr.$status.BAD_REQUEST).print({ status: "FAILED", message: e.toString() });
						return null;
					});
				if (!user) return;

				let newdomain="";
				if (DOMAIN === "localhost") {
					newdomain = "localhost";
				} else {
					if (DOMAIN.split(".").length > 2) { // we are on a subdomain
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
					message: "Welcome!",
					cookie: {
						name: COOKIE,
						value: hash,
						expiration_in_days: 30,
					},
				});
				return;
			})
);
