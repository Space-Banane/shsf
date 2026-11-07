import { Cookie } from "rjweb-server";
import { COOKIE, DOMAIN, fileRouter } from "../../..";
import { getSessionCookieDomain } from "../../../lib/Authentication";
import { env } from "../../../lib/env";
import { startSsoLogin, completeSsoLogin } from "../../../lib/Sso";
import { createLogger } from "../../../lib/logger";

const log = createLogger("SSO");
const LOGIN_COOKIE = "shsf_oidc_login";
const challengeOptions = {
	httpOnly: true, sameSite: "lax" as const, path: "/api/account/sso",
	secure: env.SSO ? new URL(env.SSO.callbackUrl).protocol === "https:" : true,
};

export = new fileRouter.Path("/")
	.http("GET", "/api/account/sso/login", (http) => http
		.ratelimit((limit) => limit.hits(5).window(60_000).penalty(0))
		.onRequest(async (ctr) => {
			ctr.headers.set("Cache-Control", "no-store");
			ctr.headers.set("Referrer-Policy", "no-referrer");
			if (!env.SSO) return ctr.status(404).print({ status: "FAILED", message: "Sign-in unavailable" });
			try {
				const login = await startSsoLogin(env.SSO);
				ctr.cookies.set(LOGIN_COOKIE, new Cookie(login.cookie, { ...challengeOptions, expires: new Date(Date.now() + 300_000) }));
				ctr.headers.set("Location", login.url);
				return ctr.status(302).print("");
			} catch {
				log.warn("SSO sign-in failed");
				ctr.headers.set("Location", `${env.SSO.uiUrl}/login?sso=failed`);
				return ctr.status(302).print("");
			}
		}))
	.http("GET", "/api/account/sso/callback", (http) => http
		.ratelimit((limit) => limit.hits(10).window(60_000).penalty(0))
		.onRequest(async (ctr) => {
			ctr.headers.set("Cache-Control", "no-store");
			ctr.headers.set("Referrer-Policy", "no-referrer");
			const cookie = ctr.cookies.get(LOGIN_COOKIE);
			ctr.cookies.set(LOGIN_COOKIE, new Cookie("", { ...challengeOptions, expires: new Date(0) }));
			if (!env.SSO) return ctr.status(404).print({ status: "FAILED", message: "Sign-in unavailable" });
			try {
				const callback = new URL(env.SSO.callbackUrl);
				callback.search = new URL(ctr.url.href, callback).search;
				const session = await completeSsoLogin(env.SSO, callback, cookie);
				ctr.cookies.set(COOKIE, new Cookie(session.hash, {
					domain: getSessionCookieDomain(DOMAIN),
					httpOnly: true, secure: challengeOptions.secure, sameSite: "lax", path: "/", expires: session.expiresAt,
				}));
				ctr.headers.set("Location", env.SSO.uiUrl);
				return ctr.status(302).print("");
			} catch {
				log.warn("SSO sign-in failed");
				ctr.headers.set("Location", `${env.SSO.uiUrl}/login?sso=failed`);
				return ctr.status(302).print("");
			}
		}));
