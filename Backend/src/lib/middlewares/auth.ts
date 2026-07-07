import { Middleware } from "rjweb-server";
import { type AccessToken, type Session, type User } from "@prisma/client";
import { checkAuthentication } from "../Authentication";
import { COOKIE, API_KEY_HEADER } from "../..";
import { createLogger } from "../logger";
import { ERROR_MESSAGES } from "../errors";

const log = createLogger("AUTH");

export type AuthState =
	| {
			success: true;
			method: "session";
			user: User;
			session: Session;
	}
	| {
			success: true;
			method: "apiKey";
			user: User;
			apiKey: AccessToken;
	}
	| {
			success: false;
			message: string;
			method: "none";
			// whether a token was actually provided (false = anonymous request)
			tokenProvided: boolean;
	};

type AuthContext = {
	auth?: AuthState;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const authResolutionMiddleware = new Middleware<{}, AuthContext>(
	"Auth Resolution Middleware",
	"1.0.0",
)
	.load(() => {
		log.info("Auth resolution middleware loaded");
	})
	.httpRequest(async (_config, _server, context, ctr) => {
		const cookieToken = ctr.cookies.get(COOKIE);
		const apiKeyToken = ctr.headers.get(API_KEY_HEADER);
		const tokenProvided = Boolean(cookieToken || apiKeyToken);

		const result = await checkAuthentication(cookieToken, apiKeyToken);

		const data = context.data(authResolutionMiddleware);
		if (result.success) {
			data.auth = result;
		} else {
			data.auth = { ...result, tokenProvided };
		}
	})
	.httpRequestContext(
		(_config, Original) =>
			class extends Original {
				getAuth(): AuthState {
					const data = this.context.data(authResolutionMiddleware);
					if (!data.auth) {
						return { success: false, message: "Auth not resolved", method: "none", tokenProvided: false };
					}

					return data.auth;
				}
			},
	)
	.export();

// Blocks requests where a token WAS provided but is invalid/expired.
// Anonymous requests (no token) pass through; route handlers decide if auth is required.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const authEnforcementMiddleware = new Middleware<{}, {}>(
	"Auth Enforcement Middleware",
	"1.0.0",
)
	.httpRequest(async (_config, _server, context, ctr, end) => {
		const data = context.data(authResolutionMiddleware) as AuthContext;
		const auth = data.auth;

		if (!auth || auth.success || !auth.tokenProvided) {
			return;
		}

		log.warn({ message: auth.message, ip: ctr.client.ip.usual() }, "Bad token rejected");

		return end(
			ctr.status(ERROR_MESSAGES.UNAUTHORIZED.code).print({
				status: "FAILED",
				message: auth.message,
			}),
		);
	})
	.export();
