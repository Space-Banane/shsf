export const ERROR_MESSAGES = {
	UNAUTHORIZED: { code: 401, errorCode: "AUTHENTICATION_REQUIRED", message: "You are not authorized to access this resource." },
	FORBIDDEN: { code: 403, errorCode: "PERMISSION_DENIED", message: "You do not have permission to access this resource." },
	NOT_FOUND: { code: 404, errorCode: "NOT_FOUND", message: "The requested resource was not found." },
	INTERNAL_SERVER_ERROR: { code: 500, errorCode: "SERVER_ERROR", message: "An unexpected server error has occurred." },
	BAD_REQUEST: { code: 400, errorCode: "VALIDATION_ERROR", message: "The request was invalid or malformed." },
	CONFLICT: { code: 409, errorCode: "CONFLICT", message: "The request conflicts with the current state of the resource." },
} as const;

export type ApiErrorCode = typeof ERROR_MESSAGES[keyof typeof ERROR_MESSAGES]["errorCode"]
	| "DEPENDENCY_ERROR"
	| "DEPENDENCY_TIMEOUT"
	| "FUNCTION_TIMEOUT"
	| "FUNCTION_EXECUTION_FAILED"
	| "RATE_LIMITED";
