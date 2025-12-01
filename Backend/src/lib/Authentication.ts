import { AccessToken, Session, User } from "@prisma/client";
import { prisma } from "..";

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
