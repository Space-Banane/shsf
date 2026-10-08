import { BASE_URL } from "..";
import { Trigger } from "../types/Prisma";
import {
	apiFetch,
	isApiFailure,
	isRecord,
	normalizeApiFailure,
	type ApiFailure,
} from "./api";

const fetch = apiFetch;

interface OKResponse {
	status: "OK";
	message: string;
}
type ErrorResponse = ApiFailure;

export interface RunTriggerResponse {
	status: "OK";
	data: {
		result?: unknown;
		exit_code?: number;
		logs?: string;
	};
}

interface CreateTriggerResponse {
	status: "OK";
	data: {
		id: number;
	};
}

async function createTrigger(
	functionId: number,
	config: {
		name: string;
		description: string;
		cron: string;
		data?: string;
		enabled?: boolean;
	},
) {
	const response = await fetch(
		`${BASE_URL}/api/functions/${functionId}/triggers`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify(config),
		},
	);

	const data = (await response.json()) as CreateTriggerResponse | ErrorResponse;
	return data;
}

async function getTriggers(functionId: number) {
	const response = await fetch(
		`${BASE_URL}/api/functions/${functionId}/triggers`,
		{
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
		},
	);

	const data = (await response.json()) as
		| { status: "OK"; data: Trigger[] }
		| ErrorResponse;
	return data;
}

async function getTrigger(functionId: number, triggerId: number) {
	const response = await fetch(
		`${BASE_URL}/api/functions/${functionId}/triggers/${triggerId}`,
		{
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
		},
	);

	const data = (await response.json()) as
		| { status: "OK"; data: Trigger }
		| ErrorResponse;
	return data;
}

async function deleteTrigger(functionId: number, triggerId: number) {
	const response = await fetch(
		`${BASE_URL}/api/functions/${functionId}/triggers/${triggerId}`,
		{
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
		},
	);

	const data = (await response.json()) as OKResponse | ErrorResponse;
	return data;
}

async function updateTrigger(
	functionId: number,
	triggerId: number,
	config: {
		name: string;
		description: string;
		cron: string;
		data?: string;
		enabled?: boolean;
	},
) {
	const response = await fetch(
		`${BASE_URL}/api/functions/${functionId}/triggers/${triggerId}`,
		{
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify(config),
		},
	);

	const data = (await response.json()) as
		| { status: "OK"; data: Trigger }
		| ErrorResponse;
	return data;
}

async function listAllTriggers() {
	const response = await fetch(`${BASE_URL}/api/triggers`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	const data = (await response.json()) as
		| {
				status: "OK";
				data: (Trigger & { function: { name: string } })[];
		  }
		| ErrorResponse;
	return data;
}

export function parseRunTriggerResponse(
	payload: unknown,
): RunTriggerResponse | ErrorResponse {
	if (isApiFailure(payload)) return payload;

	if (
		isRecord(payload) &&
		payload.status === "OK" &&
		isRecord(payload.data) &&
		(payload.data.exit_code === undefined || typeof payload.data.exit_code === "number") &&
		(payload.data.logs === undefined || typeof payload.data.logs === "string")
	) {
		return {
			status: "OK",
			data: {
				...("result" in payload.data ? { result: payload.data.result } : {}),
				...(typeof payload.data.exit_code === "number"
					? { exit_code: payload.data.exit_code }
					: {}),
				...(typeof payload.data.logs === "string" ? { logs: payload.data.logs } : {}),
			},
		};
	}

	return normalizeApiFailure(502, undefined, "SERVER_ERROR");
}

async function runTrigger(functionId: number, triggerId: number) {
	const response = await fetch(
		`${BASE_URL}/api/functions/${functionId}/triggers/${triggerId}/run`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
		},
	);

	return parseRunTriggerResponse(await response.json());
}

export {
	createTrigger,
	getTriggers,
	getTrigger,
	deleteTrigger,
	updateTrigger,
	listAllTriggers,
	runTrigger,
};
export type { OKResponse, ErrorResponse };
export type { CreateTriggerResponse };
