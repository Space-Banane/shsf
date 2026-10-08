import { BASE_URL } from "..";
import { apiFetch, type ApiFailure } from "./api";

const fetch = apiFetch;

export type AIMode = "kickoff" | "revision";

export interface AIGenerateRequest {
mode: AIMode;
prompt: string;
files?: string[];
}

export interface AIKickoffConfigResponse {
status: "OK";
data: {
name: string;
description: string;
startup_file: string;
};
}

export interface AIGenerateSuccess {
status: "OK";
message: string;
data: {
writtenFiles: string[];
model: string;
};
}

export type ErrorResponse = ApiFailure;

export async function generateConfigWithAI(
prompt: string,
image: string,
): Promise<AIKickoffConfigResponse | ErrorResponse> {
const response = await fetch(BASE_URL + "/api/ai/kickoff/config", {
method: "POST",
headers: {
"Content-Type": "application/json",
},
credentials: "include",
body: JSON.stringify({ prompt, image }),
timeoutMs: 2 * 60_000,
});
return response.json();
}

export async function generateWithAI(
functionId: number,
request: AIGenerateRequest,
signal?: AbortSignal,
): Promise<AIGenerateSuccess | ErrorResponse> {
const response = await fetch(
BASE_URL + "/api/function/" + functionId + "/ai/generate",
{
method: "POST",
headers: { "Content-Type": "application/json" },
credentials: "include",
body: JSON.stringify(request),
signal,
timeoutMs: 10 * 60_000,
},
);

const data = (await response.json()) as AIGenerateSuccess | ErrorResponse;
return data;
}
