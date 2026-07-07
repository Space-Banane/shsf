import { ERROR_MESSAGES } from "./errors";

type ResponseContent =
	| { code: number; message?: string; data?: unknown }
	| { status: number; message?: string; data?: unknown };

function resolve(content: ResponseContent) {
	const code = "code" in content ? content.code : content.status;
	const message = code >= 500 ? ERROR_MESSAGES.INTERNAL_SERVER_ERROR.message : content.message;
	return { code, message };
}

function buildBody(code: number, message: string | undefined, data: unknown) {
	if (code >= 400) {
		return { status: "FAILED", message };
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
	const { code, message } = resolve(content);
	const data = "data" in content ? content.data : undefined;
	return ctr.status(code).print(buildBody(code, message, data));
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
	const { code, message } = resolve(content);
	const data = "data" in content ? content.data : undefined;
	ctr.status(code).print(buildBody(code, message, data));
	end();
}
