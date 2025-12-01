import { BASE_URL } from "..";

export interface AccountEnvVar {
    name: string;
    value: string;
}

async function getAccountEnv() {
    const response = await fetch(`${BASE_URL}/api/account/env`, {
        credentials: "include",
    });
    const data = await response.json() as {
        status: "OK";
        data: AccountEnvVar[];
    } | {
        status: "FAILED";
        message: string;
    };
    return data;
}

async function updateAccountEnv(env: AccountEnvVar[]) {
    const response = await fetch(`${BASE_URL}/api/account/env`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ env }),
    });
    const data = await response.json() as {
        status: "OK";
        message: string;
        data: AccountEnvVar[];
    } | {
        status: "FAILED";
        message: string;
    };
    return data;
}

export {
    getAccountEnv,
    updateAccountEnv,
};
