import dotenv from "dotenv";
import { join } from "path";
import { z } from "zod";

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
		.default("default_insecure_secret_please_set"),
	RATELIMIT: z.coerce.number().int().nonnegative().default(0),
	LOG_LEVEL: z.string().default("info"),
	OPENROUTER_API_KEY: z.string().optional(),
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

const isTest = process.env.NODE_ENV === "test";
const result = (isTest ? testSchema : baseSchema).safeParse(process.env);

if (!result.success) {
	const formatted = result.error.issues
		.map((i) => `  ${i.path.join(".")}: ${i.message}`)
		.join("\n");
	throw new Error(`Invalid environment variables:\n${formatted}`);
}

export const env = result.data;
