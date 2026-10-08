import { ERROR_MESSAGES } from "./errors";
import type { ApiErrorCode } from "./errors";

type ResponseContent =
	| { code: number; errorCode?: ApiErrorCode; message?: string; data?: unknown }
	| { status: number; errorCode?: ApiErrorCode; message?: string; data?: unknown };

function defaultErrorCode(code: number): ApiErrorCode {
	if (code === 400 || code === 422) return "VALIDATION_ERROR";
	if (code === 401) return "AUTHENTICATION_REQUIRED";
	if (code === 403) return "PERMISSION_DENIED";
	if (code === 404) return "NOT_FOUND";
	if (code === 408) return "FUNCTION_TIMEOUT";
	if (code === 409) return "CONFLICT";
	if (code === 424) return "DEPENDENCY_ERROR";
	if (code === 429) return "RATE_LIMITED";
	return "SERVER_ERROR";
}

function resolve(content: ResponseContent) {
	const code = "code" in content ? content.code : content.status;
	const message = code >= 500 ? ERROR_MESSAGES.INTERNAL_SERVER_ERROR.message : content.message;
	return { code, errorCode: content.errorCode ?? defaultErrorCode(code), message };
}

function buildBody(code: number, errorCode: ApiErrorCode, message: string | undefined, data: unknown) {
	if (code >= 400) {
		return { status: "FAILED", code: errorCode, message };
	}

	return {
		status: "OK",
		...(message !== undefined ? { message } : {}),
		...(data !== undefined ? { data } : {}),
	};
}

export async function makeResponse({
	ctr,
	content,
}: {
	ctr: any; // eslint-disable-line @typescript-eslint/no-explicit-any
	content: ResponseContent;
}) {
	const { code, errorCode, message } = resolve(content);
	const data = "data" in content ? content.data : undefined;
	return ctr.status(code).print(buildBody(code, errorCode, message, data));
}

export async function endResponse({
	ctr,
	end,
	content,
}: {
	ctr: any; // eslint-disable-line @typescript-eslint/no-explicit-any
	end: () => void;
	content: ResponseContent;
}) {
	const { code, errorCode, message } = resolve(content);
	const data = "data" in content ? content.data : undefined;
	ctr.status(code).print(buildBody(code, errorCode, message, data));
	end();
}
