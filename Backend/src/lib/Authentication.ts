import { Session, User } from "@prisma/client";
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
            apiKey: any;
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
        // ! Implement later
        return {
            success: false,
            message: "API key authentication not implemented",
            method: "none",
        };
    } else {
        return {
            success: false,
            message: "No data provided to authenticate",
            method: "none",
        };
    }
}
