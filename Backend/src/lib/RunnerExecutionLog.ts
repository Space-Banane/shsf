import { prisma } from "..";
import { getLoggingConfigFromData, stripHeadersFromPayload } from "./FunctionLogging";
import { enqueueLogAnalysis } from "./LogAnalysis";
import { createLogger } from "./logger";
import { isHtmlStartupFile, truncateDbField } from "./RunnerUtils";
import type { PersistedFunctionExecutionLogInput } from "./RunnerTypes";
const log = createLogger("Runner");

export async function persistFunctionExecutionLog(
	input: PersistedFunctionExecutionLogInput,
) {
	const loggingConfig = await getLoggingConfigFromData(input.functionData.logging);
	if (!loggingConfig.enabled && !input.force) {
		return;
	}

	let disableResult = false;
	let disableResultReason = "";
	let payloadForDb = input.payload ?? JSON.stringify(null);
	const resultForDb =
		typeof input.output === "string" && input.output !== ""
			? input.output
			: JSON.stringify(null);
	const containsBase64TransportEnvelope =
		/"__shsf_transport"\s*:\s*"base64-bytes-v1"/.test(resultForDb);

	if (loggingConfig.enabled && loggingConfig.hide_payload_headers) {
		payloadForDb = await stripHeadersFromPayload(payloadForDb);
	}

	if (isHtmlStartupFile(input.functionData.startup_file)) {
		disableResult = true;
		disableResultReason = "HTML content detected in startup file";
	}

	if (resultForDb.includes("<!DOCTYPE html>") || resultForDb.includes("<html")) {
		disableResult = true;
		disableResultReason = "HTML content detected in result";
	}

	if (containsBase64TransportEnvelope) {
		disableResult = true;
		disableResultReason = "Base64 transport envelope detected in result";
	}

	const triggerLog = await prisma.triggerLog.create({
		data: {
			functionId: input.functionId,
			logs: truncateDbField(input.logs),
			result: JSON.stringify({
				exit_code: input.exit_code,
				tooks: input.tooks ?? [],
				output: disableResult ? disableResultReason : truncateDbField(resultForDb),
				payload: truncateDbField(payloadForDb),
				...(input.ratelimit ? { ratelimit: input.ratelimit } : {}),
				...(input.error_type ? { error_type: input.error_type } : {}),
			}),
		},
	});

	if (loggingConfig.enabled && loggingConfig.analyze) {
		try {
			await enqueueLogAnalysis(prisma, triggerLog.id, input.functionId);
		} catch (error) {
			// Advisory analysis must never affect the execution path.
			log.error({ err: error, functionId: input.functionId }, "Failed to enqueue log analysis");
		}
	}
}
