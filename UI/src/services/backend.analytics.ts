import { BASE_URL } from "..";
import {
	AccountFunctionAnalyticsResponse,
	AnalyticsRange,
	SingleFunctionAnalyticsResponse,
} from "../types/Analytics";

interface ErrorResponse {
	status: number;
	message: string;
}

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
