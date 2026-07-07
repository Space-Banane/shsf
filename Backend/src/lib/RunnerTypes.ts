import type { Function } from "@prisma/client";
import type { LoggedExecutionRateLimitData } from "./FunctionRateLimit";

export interface TimingEntry {
	timestamp: number;
	value: number;
	description: string;
}

export type FunctionExecutionMode =
	| "dev_execute"
	| "production_execute"
	| "cron_execute";

export interface PersistedFunctionExecutionLogInput {
	functionId: number;
	functionData: Pick<Function, "logging" | "startup_file">;
	logs: string;
	output?: string | null;
	payload?: string | null;
	exit_code: number | null;
	tooks?: TimingEntry[];
	ratelimit?: LoggedExecutionRateLimitData;
	error_type?: string;
	force?: boolean;
}

export const ServeOnlyFileNotFoundHTML = `<html><head><title>File Not Found</title></head><body><h1>404 - File Not Found</h1><p>The requested HTML file was not found in the function's files.</p></body></html>`;
export const HTML_FILE_EXTENSION = ".html";
export const DB_FIELD_LIMIT = 10000;
