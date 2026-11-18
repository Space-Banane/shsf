import { env } from "./env";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const _adapter = new PrismaMariaDb(env.DATABASE_URL);
export const prisma = new PrismaClient({
	adapter: _adapter,
	// Query logging is opt-in; errors and warnings are always logged.
	log: env.PRISMA_QUERY_LOGGING ? ["info", "error", "warn"] : ["error", "warn"],
	errorFormat: "pretty",
	transactionOptions: { timeout: 30000, maxWait: 20000 },
});
