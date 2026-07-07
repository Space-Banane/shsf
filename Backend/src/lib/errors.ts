export const ERROR_MESSAGES = {
	UNAUTHORIZED: { code: 401, message: "You are not authorized to access this resource." },
	FORBIDDEN: { code: 403, message: "You do not have permission to access this resource." },
	NOT_FOUND: { code: 404, message: "The requested resource was not found." },
	INTERNAL_SERVER_ERROR: { code: 500, message: "An unexpected server error has occurred." },
	BAD_REQUEST: { code: 400, message: "The request was invalid or malformed." },
	CONFLICT: { code: 409, message: "The request conflicts with the current state of the resource." },
} as const;
