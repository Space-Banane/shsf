import { BASE_URL } from "..";
import { Trigger } from "../types/Prisma";

interface OKResponse {
	status: "OK";
	message: string;
}
interface ErrorResponse {
	status: number;
	message: string;
}

interface CreateTriggerResponse {
    status: "OK";
    data: {
        id: number;
    };
}

async function createTrigger(functionId:number,config: {
    name: string;
    description: string;
    cron: string;
    data?: string;
}) {
    const response = await fetch(`${BASE_URL}/api/functions/${functionId}/triggers`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(config),
    });

    const data = await response.json() as CreateTriggerResponse | ErrorResponse;
    return data;
}

async function getTriggers(functionId:number) {
    const response = await fetch(`${BASE_URL}/api/functions/${functionId}/triggers`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
    });

    const data = await response.json() as {status:"OK";data:Trigger[]} | ErrorResponse;
    return data;
}

async function getTrigger(functionId:number, triggerId:number) {
    const response = await fetch(`${BASE_URL}/api/functions/${functionId}/triggers/${triggerId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
    });

    const data = await response.json() as {status:"OK";data:Trigger} | ErrorResponse;
    return data;
}

async function deleteTrigger(functionId:number, triggerId:number) {
    const response = await fetch(`${BASE_URL}/api/functions/${functionId}/triggers/${triggerId}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
    });

    const data = await response.json() as OKResponse | ErrorResponse;
    return data;
}

async function updateTrigger(functionId:number, triggerId:number, config: {
    name: string;
    description: string;
    cron: string;
    data?: string;
}) {
    const response = await fetch(`${BASE_URL}/api/functions/${functionId}/triggers/${triggerId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(config),
    });

    const data = await response.json() as {status:"OK";data:Trigger} | ErrorResponse;
    return data;
}

export { createTrigger, getTriggers, getTrigger, deleteTrigger, updateTrigger };
export type { OKResponse, ErrorResponse };
export type { CreateTriggerResponse };