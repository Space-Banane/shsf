import { BASE_URL } from "..";

export interface LoggingConfig {
    enabled: boolean;
    hide_payload_headers?: boolean;
}

interface OKResponse {
    status: "OK";
    message: string;
}

interface GetLoggingConfigResponse {
    status: "OK";
    data: LoggingConfig;
}

interface ErrorResponse {
    status: "ERROR" | number;
    message: string;
}

/**
 * Get logging configuration for a specific function
 */
export async function getLoggingConfig(functionId: number): Promise<GetLoggingConfigResponse | ErrorResponse> {
    const response = await fetch(`${BASE_URL}/api/function/${functionId}/logging`, {
        method: "GET",
        credentials: "include",
    });

    return await response.json();
}

/**
 * Update logging configuration for a specific function
 */
export async function updateLoggingConfig(functionId: number, config: Partial<LoggingConfig>): Promise<OKResponse | ErrorResponse> {
    const response = await fetch(`${BASE_URL}/api/function/${functionId}/logging`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(config),
    });

    return await response.json();
}

/**
 * Delete all logs for a specific function
 */
export async function deleteAllLogs(functionId: number): Promise<OKResponse | ErrorResponse> {
    const response = await fetch(`${BASE_URL}/api/function/${functionId}/logs`, {
        method: "DELETE",
        credentials: "include",
    });

    return await response.json();
}

/**
 * Delete a specific log entry by ID
 */
export async function deleteSpecificLog(functionId: number, logId: number): Promise<OKResponse | ErrorResponse> {
    const response = await fetch(`${BASE_URL}/api/function/${functionId}/logs/${logId}`, {
        method: "DELETE",
        credentials: "include",
    });

    return await response.json();
}
