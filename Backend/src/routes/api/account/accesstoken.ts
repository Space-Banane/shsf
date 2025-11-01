import { randomBytes } from "crypto";
import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../../..";
import { checkAuthentication } from "../../../lib/Authentication";

function maskToken(token: string) {
    if (token.length <= 8) return token;
    return token.slice(0, 4) + "..." + token.slice(-4);
}

export = new fileRouter.Path("/")
    // Generate a new access token
    .http("POST", "/api/account/accesstoken/generate", (http) =>
        http
            .ratelimit((limit) => limit.hits(3).window(60000).penalty(10000))
            .onRequest(async (ctr) => {
                const [data, error] = await ctr.bindBody((z) =>
                    z.object({
                        name: z.string().min(2).max(128),
                        purpose: z.string().max(512).optional(),
                        expires_in: z.number().int().min(1).max(365).nullable().optional()
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

                // Generate secure random token
                const token = randomBytes(32).toString("hex");
                let expiresAt: Date | null = null;
                if (typeof data.expires_in === "number") {
                    expiresAt = new Date(Date.now() + data.expires_in * 24 * 60 * 60 * 1000);
                }
                // If expires_in is null or undefined, expiresAt stays null (never expires)

                // Check for existing token with same name for this user
                const existingToken = await prisma.accessToken.findFirst({
                    where: {
                        userId: authCheck.user.id,
                        name: data.name,
                    },
                });
                if (existingToken) {
                    return ctr.status(ctr.$status.CONFLICT).print({
                        status: "FAILED",
                        message: "An access token with this name already exists",
                    });
                }

                const created = await prisma.accessToken.create({
                    data: {
                        token,
                        name: data.name,
                        purpose: data.purpose,
                        expiresAt,
                        userId: authCheck.user.id,
                    },
                });

                return ctr.print({
                    status: "OK",
                    id: created.id,
                    name: created.name,
                    purpose: created.purpose,
                    expiresAt: created.expiresAt,
                    createdAt: created.createdAt,
                    token, // Only show full token on creation
                });
            })
    )
    // Revoke (delete) an access token
    .http("DELETE", "/api/account/accesstoken/revoke", (http) =>
        http
            .ratelimit((limit) => limit.hits(5).window(60000).penalty(10000))
            .onRequest(async (ctr) => {
                const [data, error] = await ctr.bindBody((z) =>
                    z.object({
                        id: z.number().int(),
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

                // Only allow deleting own tokens
                const token = await prisma.accessToken.findUnique({
                    where: { id: data.id },
                });
                if (!token || token.userId !== authCheck.user.id) {
                    return ctr.status(ctr.$status.NOT_FOUND).print({
                        status: "FAILED",
                        message: "Token not found",
                    });
                }

                await prisma.accessToken.delete({
                    where: { id: data.id },
                });

                return ctr.print({
                    status: "OK",
                    message: "Token revoked",
                });
            })
    )
    // List all access tokens for the user (masked)
    .http("GET", "/api/account/accesstoken/list", (http) =>
        http
            .ratelimit((limit) => limit.hits(10).window(60000).penalty(5000))
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

                const tokens = await prisma.accessToken.findMany({
                    where: { userId: authCheck.user.id },
                    orderBy: { createdAt: "desc" },
                });

                return ctr.print({
                    status: "OK",
                    tokens: tokens.map(t => ({
                        id: t.id,
                        name: t.name,
                        purpose: t.purpose,
                        expiresAt: t.expiresAt,
                        createdAt: t.createdAt,
                        expired: t.expired,
                        hidden: t.hidden,
                        tokenMasked: maskToken(t.token),
                    })),
                });
            })
    )
    // Update access token name and purpose
    .http("PATCH", "/api/account/accesstoken/update", (http) =>
        http
            .ratelimit((limit) => limit.hits(5).window(60000).penalty(10000))
            .onRequest(async (ctr) => {
                const [data, error] = await ctr.bindBody((z) =>
                    z.object({
                        id: z.number().int(),
                        name: z.string().min(2).max(128).optional(),
                        purpose: z.string().max(512).optional().nullable(),
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

                // Only allow updating own tokens
                const token = await prisma.accessToken.findUnique({
                    where: { id: data.id },
                });
                if (!token || token.userId !== authCheck.user.id) {
                    return ctr.status(ctr.$status.NOT_FOUND).print({
                        status: "FAILED",
                        message: "Token not found",
                    });
                }

                // If name is being changed, check for conflicts
                if (data.name && data.name !== token.name) {
                    const existingToken = await prisma.accessToken.findFirst({
                        where: {
                            userId: authCheck.user.id,
                            name: data.name,
                        },
                    });
                    if (existingToken) {
                        return ctr.status(ctr.$status.CONFLICT).print({
                            status: "FAILED",
                            message: "An access token with this name already exists",
                        });
                    }
                }

                const updated = await prisma.accessToken.update({
                    where: { id: data.id },
                    data: {
                        name: data.name ?? token.name,
                        purpose: data.purpose !== undefined ? data.purpose : token.purpose,
                    },
                });

                return ctr.print({
                    status: "OK",
                    id: updated.id,
                    name: updated.name,
                    purpose: updated.purpose,
                    expiresAt: updated.expiresAt,
                    createdAt: updated.createdAt,
                    expired: updated.expired,
                    hidden: updated.hidden,
                    tokenMasked: maskToken(updated.token),
                });
            })
    )
    // Auth Check
    .http("GET", "/api/account/accesstoken/authcheck", (http) =>
        http
            .ratelimit((limit) => limit.hits(20).window(60000).penalty(2000))
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

                return ctr.print({
                    status: "OK",
                    message: "Authenticated",
                    userId: authCheck.user.id,
                    method: authCheck.method,
                });
            })
    );
