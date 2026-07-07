/*
Helper for Function Trigger Logging
*/

import { TriggerLog } from "@prisma/client";
import { prisma } from "..";
import { createLogger } from "./logger";

const log = createLogger("FunctionLogging");

interface LoggingConfigEnabled {
    enabled: true;

    logs_last_cleared?: Date;
    last_log_deleted?: TriggerLog; // So we can have the last log that was deleted, incase we need to restore it.

    hide_payload_headers?: boolean;
}

interface LoggingConfigDisabled {
    enabled: false;
}

export type LoggingConfig = LoggingConfigEnabled | LoggingConfigDisabled;

const defaultLoggingConfig: LoggingConfig = {
    enabled: true,
};

async function validateLoggingConfig(config: unknown): Promise<boolean> {
    // Basic validation to check if the config has the required structure
    if (typeof config !== "object" || config === null) {
        return false;
    }

    // Check if the "enabled" property exists and is a boolean
    if (typeof (config as Record<string, unknown>).enabled !== "boolean") {
        return false;
    }

    // We can add more validation rules later, this function is mainly just to make sure the data types are the ones that we expect...

    return true;
}

export async function setLoggingConfig(functionID: number, config: LoggingConfig): Promise<void> {
    try {
        const configString = JSON.stringify(config);
        await prisma.function.update({
            where: {
                id: functionID
            },
            data: {
                logging: configString
            }
        });
    } catch (error) {
        log.error({ err: error, functionID }, "Error setting logging config");
        throw error; // Rethrow the error to be handled by the caller
    }
}

export async function getLoggingConfigFromData(logging:string | null): Promise<LoggingConfig> {
    try {
        if (!logging || logging.trim() === "") {
            return defaultLoggingConfig;
        }

        const config = JSON.parse(logging);
        const isValid = await validateLoggingConfig(config);
        if (!isValid) {
            log.error({ config }, "Invalid logging config structure");
            return defaultLoggingConfig;
        }

        return config as LoggingConfig;
    } catch (error) {
        log.error({ err: error }, "Error parsing logging config");
        return defaultLoggingConfig;
    }
}

export async function getLoggingConfigByID(functionID: number): Promise<ReturnType<typeof getLoggingConfigFromData> | null> {
    try {
        const data = await prisma.function.findFirst({
            where: {
                id: functionID
            }
        });

        if (!data) {
            return null; // Function not found
        }

        const loggingdata = data.logging ?? "";
        return getLoggingConfigFromData(loggingdata);
    } catch (error) {
        log.error({ err: error, functionID }, "Error fetching logging config");
        return null;
    }
}

export async function stripHeadersFromPayload(payload: string): Promise<string> {
    // payload is stringified
    try {
        const parsed = JSON.parse(payload);
        if (parsed && typeof parsed === "object" && "headers" in parsed) {
            delete parsed.headers;
        }
        return JSON.stringify(parsed);
    } catch (error) {
        log.error({ err: error }, "Error stripping headers from payload");
        return payload;
    }
}

export async function getExitCodeFromLog(triggerLog: TriggerLog): Promise<number | null> {
    try {
        if (!triggerLog.result || triggerLog.result.trim() === "") {
            return null;
        }
        const parsed = JSON.parse(triggerLog.result);
        if (parsed && typeof parsed === "object" && "exitCode" in parsed) {
            return parsed.exitCode;
        }
    } catch (error) {
        log.error({ err: error }, "Error parsing log result for exit code");
        return null;
    }
    return null;
}