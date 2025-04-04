import { BASE_URL } from "..";
import { Session, User } from "../types/Prisma";

async function getUserInfo() {
    const response = await fetch(`${BASE_URL}/api/account/getUserInfo`, {
        credentials: "include",
    });
    const data = await response.json() as {
        status:"OK"
        user:User;
        session:Session
    } | {
        status:401,
        message:string
    };
    return data;
}

export {
    getUserInfo,
}