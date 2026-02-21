import { BASE_URL } from "..";

export type AIMode = "kickoff" | "revision";

interface AIGenerateRequest {
	mode: AIMode;
	prompt: string;
	files?: string[]; // filenames for revision mode (up to 3)
}

interface AIGenerateSuccess {
	status: "OK";
	message: string;
	data: {
		writtenFiles: string[];
		model: string;
	};
}

interface ErrorResponse {
	status: number | string;
	message: string;
}

async function generateWithAI(
	functionId: number,
	request: AIGenerateRequest,
): Promise<AIGenerateSuccess | ErrorResponse> {
	const response = await fetch(
		`${BASE_URL}/api/function/${functionId}/ai/generate`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify(request),
		},
	);

	const data = (await response.json()) as AIGenerateSuccess | ErrorResponse;
	return data;
}

export { generateWithAI };
export type { AIGenerateRequest, AIGenerateSuccess, ErrorResponse };
