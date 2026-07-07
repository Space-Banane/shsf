import { env } from "./env";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const _adapter = new PrismaMariaDb(env.DATABASE_URL);
export const prisma = new PrismaClient({
	adapter: _adapter,
	log: ["info", "error", "warn"],
	errorFormat: "pretty",
	transactionOptions: { timeout: 30000, maxWait: 20000 },
});
