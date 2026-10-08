import { BASE_URL } from "..";
import {
	AccountFunctionAnalyticsResponse,
	AnalyticsRange,
	SingleFunctionAnalyticsResponse,
} from "../types/Analytics";
import { apiFetch, type ApiFailure } from "./api";

const fetch = apiFetch;

type ErrorResponse = ApiFailure;

export async function getAccountFunctionAnalytics(
	range: AnalyticsRange = "7d",
) {
	const response = await fetch(`${BASE_URL}/api/function-analytics?range=${range}`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	return (await response.json()) as AccountFunctionAnalyticsResponse | ErrorResponse;
}

export async function getSingleFunctionAnalytics(
	functionId: number,
	range: AnalyticsRange = "7d",
) {
	const response = await fetch(
		`${BASE_URL}/api/function/${functionId}/analytics?range=${range}`,
		{
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
		},
	);

	return (await response.json()) as SingleFunctionAnalyticsResponse | ErrorResponse;
}
