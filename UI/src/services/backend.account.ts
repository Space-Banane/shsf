import { BASE_URL } from "..";
import { Session, User } from "../types/Prisma";
import { apiFetch } from "./api";

const fetch = apiFetch;

interface EnvironmentVariable {
	name: string;
	value: string;
}

async function getUserInfo() {
	const response = await fetch(`${BASE_URL}/api/account/getUserInfo`, {
		credentials: "include",
	});
	const data = (await response.json()) as
		| {
				status: "OK";
				user: User;
				session: Session;
		  }
		| {
				status: 401;
				message: string;
		  };
	return data;
}

async function deleteAccount(confirmation: string) {
	const response = await fetch(`${BASE_URL}/api/account/delete`, {
		method: "DELETE",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			confirmation,
		}),
	});
	const data = (await response.json()) as
		| {
				status: "OK";
				message: string;
		  }
		| {
				status: "FAILED";
				message: string;
		  };
	return data;
}

async function exportAccountData() {
	const response = await fetch(`${BASE_URL}/api/account/export`, {
		credentials: "include",
		rawResponse: true,
	});

	if (!response.ok) {
		const failure = await response.json().catch(() => null);
		throw new Error(failure?.message || "Account data could not be exported. Try again.");
	}

	return response;
}

async function getAccountSettings() {
	const response = await fetch(`${BASE_URL}/api/account/settings`, {
		credentials: "include",
	});
	const data = (await response.json()) as
		| {
				status: "OK";
				data: {
					accountEnvironment: EnvironmentVariable[];
				};
		  }
		| { status: "FAILED"; message: string };
	return data;
}

async function updateAccountSettings(settings: {
	openRouterKey?: string | null;
	accountEnvironment?: EnvironmentVariable[];
}) {
	const response = await fetch(`${BASE_URL}/api/account/settings`, {
		method: "PATCH",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(settings),
	});
	const data = (await response.json()) as
		| {
				status: "OK";
				message: string;
				data?: {
					accountEnvironment: EnvironmentVariable[];
				};
		  }
		| { status: "FAILED"; message: string };
	return data;
}

export {
	getUserInfo,
	deleteAccount,
	exportAccountData,
	getAccountSettings,
	updateAccountSettings,
};
