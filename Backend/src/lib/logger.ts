import { env } from "./env";
import pino from "pino";

export const logger = pino({
	level: env.LOG_LEVEL,
	transport:
		env.NODE_ENV !== "production"
			? { target: "pino-pretty", options: { colorize: true } }
			: undefined,
});

export function createLogger(component: string) {
	return logger.child({ component });
}
