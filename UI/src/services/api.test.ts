import { normalizeApiFailure } from "./api";

describe("API error messages", () => {
	it.each([
		[400, { message: "Function name is required" }, "VALIDATION_ERROR", "Function name is required. Review the entered values and try again."],
		[401, { message: "Invalid Credentials" }, "AUTHENTICATION_REQUIRED", "The email or password is incorrect. Check your credentials and try again."],
		[403, {}, "PERMISSION_DENIED", "You do not have permission to do this. Ask an administrator for access if you think this is a mistake."],
		[424, {}, "DEPENDENCY_ERROR", "A required dependency could not be installed. Check the dependency file and function logs, then try again."],
	])("maps HTTP %s to safe contextual guidance", (status, payload, code, message) => {
		expect(normalizeApiFailure(status, payload)).toEqual({
			status: "FAILED",
			code,
			message,
		});
	});

	it("distinguishes a browser request deadline from a function timeout", () => {
		expect(normalizeApiFailure(408, undefined, "REQUEST_TIMEOUT")).toMatchObject({
			code: "REQUEST_TIMEOUT",
			message: expect.stringContaining("server did not respond"),
		});
		expect(normalizeApiFailure(504, { code: "FUNCTION_TIMEOUT" })).toMatchObject({
			code: "FUNCTION_TIMEOUT",
			message: expect.stringContaining("configured execution timeout"),
		});
	});

	it("does not surface internal server details or credentials", () => {
		const failure = normalizeApiFailure(500, {
			message: "Prisma error: password=super-secret at /app/node_modules/client.js",
		});

		expect(failure.code).toBe("SERVER_ERROR");
		expect(failure.message).not.toContain("super-secret");
		expect(failure.message).not.toContain("Prisma");
	});

	it("honors a backend dependency timeout code instead of treating it as a request timeout", () => {
		expect(normalizeApiFailure(504, { code: "DEPENDENCY_TIMEOUT" })).toMatchObject({
			code: "DEPENDENCY_TIMEOUT",
			message: expect.stringContaining("Dependency installation"),
		});
	});
});
