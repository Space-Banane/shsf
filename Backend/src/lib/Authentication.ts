import { AccessToken, Function, FunctionFile, Session, User } from "@prisma/client";
import { prisma, REACT_APP_API_URL, UI_URL } from "..";
import { Cookie } from "rjweb-server";

export async function checkAuthentication(
	sessionHash: Session["hash"] | null,
	apiKey: string | null,
): Promise<
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
	  }
> {
	if (!sessionHash && !apiKey) {
		return {
			success: false,
			message: "No authentication data provided",
			method: "none",
		};
	}

	if (sessionHash) {
		const session = await prisma.session.findFirst({
			where: { hash: sessionHash },
			include: { user: true },
		});

		if (!session) {
			return {
				success: false,
				message: "Invalid session",
				method: "none",
			};
		}

		return {
			success: true,
			method: "session",
			user: session.user,
			session: session,
		};
	} else if (apiKey) {
		const apiKeyRecord = await prisma.accessToken.findFirst({
			where: { token: apiKey },
			include: { user: true },
		});

		if (!apiKeyRecord) {
			return {
				success: false,
				message: "Invalid API key",
				method: "none",
			};
		}

		// Expiration Check
		if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
			await prisma.accessToken.update({
				where: { id: apiKeyRecord.id },
				data: { expired: true },
			});
			return {
				success: false,
				message: "API key has expired",
				method: "none",
			};
		}

		if (apiKeyRecord.expired) {
			return {
				success: false,
				message: "API key has expired",
				method: "none",
			};
		}

		return {
			success: true,
			method: "apiKey",
			user: apiKeyRecord.user,
			apiKey: apiKeyRecord,
		};
	} else {
		return {
			success: false,
			message: "No data provided to authenticate",
			method: "none",
		};
	}
}

// Helper function for HTTP execution permission (guest/auth logic)
export async function checkHttpExecutionPermission(
	ctr: any,
	functionData: {
		files: FunctionFile[];
		namespace: { id: number; name: string };
	} & Function,
	namespaceId: number,
	functionId: string
) {
	// Returns: { state: boolean, reason: string, redirect?: string }
	// Handles secure_header, x-access-key, guest users/cookies, and sets cookies if needed
	let permissionToExecute: {
		state: boolean;
		reason: string;
		redirect?: string;
	} = {
		state: true,
		reason: "",
	};

	// Secure header check
	if (functionData.secure_header) {
		if (!ctr.headers.has("x-secure-header")) {
			permissionToExecute = { state: false, reason: "Missing secure header" };
		} else {
			const secureHeader = ctr.headers.get("x-secure-header");
			if (secureHeader !== functionData.secure_header) {
				permissionToExecute = { state: false, reason: "Invalid secure header" };
			}
		}
	}

	// API key check
	if (ctr.headers.has("x-access-key")) {
		const accessKey = ctr.headers.get("x-access-key") || "";
		const authState = await checkAuthentication(null, accessKey);
		if (authState.success && authState.method === "apiKey") {
			if (authState.user.id === functionData.userId) {
				permissionToExecute = {
					state: true,
					reason: "Provided API Key and owns the function",
				};
			} else {
				permissionToExecute = {
					state: false,
					reason: "Provided Access Token, but does not own the function",
				};
			}
		} else {
			permissionToExecute = {
				state: false,
				reason: "Provided Access Token, but it's invalid",
			};
		}
	}

	// Guest user logic
	// If the function allows guest access, check if the request is from a permitted guest user.
	if (functionData.guest_access) {
		// Find all guest users permitted to access this function
		const guests = await prisma.guestUser.findMany({
			where: {
				permittedFunctions: { array_contains: [functionData.id] },
				guestOwnerId: functionData.userId,
			},
		});
		// Default: require authentication unless a valid guest session is found
		permissionToExecute = {
			state: false,
			reason: "Function has guest users assigned, authentication required now",
		};
		// Check for guest cookie (identifies the guest session for this function)
		const guestCookie = ctr.cookies.get(
			`shsf_guest_${namespaceId}_${functionId}`
		);
		if (guestCookie) {
			// If cookie exists, look up the guest session in the database
			const guestSession = await prisma.guestSession.findFirst({
				where: { hash: guestCookie },
				include: { guestUser: true },
			});
			if (guestSession) {
				const now = new Date();
				// If the session has expired, deny and clear the cookie
				if (guestSession.expiresAt < now) {
					permissionToExecute = {
						state: false,
						reason: "Guest session has expired",
					};
					await prisma.guestSession.delete({ where: { id: guestSession.id } });
					ctr.cookies.set(
						`shsf_guest_${namespaceId}_${functionId}`,
						new Cookie("", {
							domain: REACT_APP_API_URL.replace("https://", "")
								.replace("http://", "")
								.replace("/", ""),
							expires: new Date(Date.now()),
						})
					);
					permissionToExecute.redirect = undefined;
				}
				// If the guest user is not permitted for this function, deny and clear cookie
				else if (!guests.map((g) => g.id).includes(guestSession.guestUser.id)) {
					permissionToExecute = {
						state: false,
						reason:
							"Guest user does not have permission to access this function. [FORCE RELOAD]",
					};
					ctr.cookies.set(
						`shsf_guest_${namespaceId}_${functionId}`,
						new Cookie("", {
							domain: REACT_APP_API_URL.replace("https://", "")
								.replace("http://", "")
								.replace("/", ""),
							expires: new Date(Date.now()),
						})
					);
					// Redirect to re-authenticate as guest
					permissionToExecute.redirect = `${REACT_APP_API_URL}/api/exec/${namespaceId}/${functionId}`;
				} else {
					// Valid guest session and user is permitted
					permissionToExecute = { state: true, reason: "Valid guest cookie" };
				}
			} else {
				// Cookie exists but session not found: clear cookie and deny
				permissionToExecute = { state: false, reason: "Invalid guest cookie" };
				ctr.cookies.set(
					`shsf_guest_${namespaceId}_${functionId}`,
					new Cookie("", {
						domain: REACT_APP_API_URL.replace("https://", "")
							.replace("http://", "")
							.replace("/", ""),
						expires: new Date(Date.now()),
					})
				);
			}
		} else {
			// No guest cookie: deny and redirect to guest access UI for authentication
			permissionToExecute = { state: false, reason: "Missing guest cookie" };
			permissionToExecute.redirect =
				UI_URL +
				"/guest-access?nsp=" +
				functionData.namespaceId +
				"&func=" +
				functionData.executionId;
		}
	}

	return permissionToExecute;
}