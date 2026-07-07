export const IGNORE_PATHS: string[] = [
	"/api/openapi.json",
	"/api/health",
];

export const INJECT_HEADERS: Record<string, string> = {
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"X-XSS-Protection": "1; mode=block",
	"Referrer-Policy": "strict-origin-when-cross-origin",
};
