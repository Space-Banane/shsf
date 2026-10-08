import dotenv from "dotenv";
import { join } from "path";
import { z } from "zod";

export const DEFAULT_INSTANCE_SECRET = "default_insecure_secret_please_set";
export const MIN_INSTANCE_SECRET_LENGTH = 32;

if (process.env.NODE_ENV !== "test") {
	dotenv.config({ path: join(__dirname, "../../.env") });
}

const baseSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	DATABASE_URL: z.string().default("mysql://test:test@localhost:3306/test"),
	PORT: z.coerce.number().int().positive(),
	UI_URL: z.string().min(1),
	REACT_APP_API_URL: z.string().min(1),
	DOMAIN: z.string().min(1),
	CORS_URLS: z.string().min(1),
	INSTANCE_SECRET: z
		.string()
		.default(DEFAULT_INSTANCE_SECRET),
	RATELIMIT: z.coerce.number().int().nonnegative().default(0),
	LOG_LEVEL: z.string().default("info"),
	OPENROUTER_API_KEY: z.string().optional(),
	// Demo mode is deliberately opt-in. It creates a public, disposable account
	// and sample function data, so it must never be enabled for a real instance.
	IS_DEMO: z
		.string()
		.default("false")
		.transform((v) => v === "true"),
	REQUEST_DEBUGGING: z
		.enum(["true", "false"])
		.transform((v) => v === "true")
		.default(false),
	RESPONSE_DEBUGGING: z
		.enum(["true", "false"])
		.transform((v) => v === "true")
		.default(false),
});

// In test mode the server never starts, so production-required vars get safe defaults.
const testSchema = baseSchema.extend({
	PORT: z.coerce.number().int().positive().default(3000),
	UI_URL: z.string().default("http://localhost:3000"),
	REACT_APP_API_URL: z.string().default("http://localhost:3000"),
	DOMAIN: z.string().default("localhost"),
	CORS_URLS: z.string().default("http://localhost:3000"),
});

export function parseEnvironment(input: NodeJS.ProcessEnv = process.env) {
	const schema = input.NODE_ENV === "test" ? testSchema : baseSchema;
	const result = schema
		.superRefine(({ NODE_ENV, INSTANCE_SECRET }, ctx) => {
			if (NODE_ENV !== "production") return;

			if (INSTANCE_SECRET === DEFAULT_INSTANCE_SECRET) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["INSTANCE_SECRET"],
					message: "must not use the default value in production. Generate one with: openssl rand -hex 32",
				});
			}

			if (INSTANCE_SECRET.length < MIN_INSTANCE_SECRET_LENGTH) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["INSTANCE_SECRET"],
					message: `must be at least ${MIN_INSTANCE_SECRET_LENGTH} characters in production. Generate one with: openssl rand -hex 32`,
				});
			}
		})
		.safeParse(input);

	if (!result.success) {
		const formatted = result.error.issues
			.map((i) => `  ${i.path.join(".")}: ${i.message}`)
			.join("\n");
		throw new Error(`Invalid environment variables:\n${formatted}`);
	}

	return result.data;
}

export const env = parseEnvironment();
