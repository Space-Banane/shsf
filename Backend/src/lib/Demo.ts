import { randomUUID } from "crypto";
import * as bcrypt from "bcrypt";
import { prisma } from "./db";
import { env } from "./env";
import { createLogger } from "./logger";

const log = createLogger("Demo");

// These credentials are intentionally public. This account is created only
// when IS_DEMO=true, which is intended solely for disposable demo instances.
export const DEMO_EMAIL = "demo@shsf.local";
export const DEMO_PASSWORD = "demo-password";
export const DEMO_DISPLAY_NAME = "SHSF Demo";

const DEMO_FUNCTION = {
	name: "Hello, SHSF",
	description: "A ready-to-run example function for this demo instance.",
	image: "python:3.12",
	startup_file: "main.py",
	content: [
		"def main(args):",
		"    name = args.get('body', {}).get('name', 'World')",
		"    return {'message': f'Hello, {name}!', 'demo': True}",
	].join("\n"),
} as const;

/**
 * Idempotently creates the public demo administrator and a runnable example.
 * The account's presence is the seed marker, so restarting a demo instance
 * does not overwrite a visitor's changes.
 */
export async function ensureDemoData(enabled = env.IS_DEMO) {
	if (!enabled) return null;

	const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
	if (existing) return null;

	const password = await bcrypt.hash(DEMO_PASSWORD, 10);
	const user = await prisma.$transaction(async (tx) => {
		const createdUser = await tx.user.create({
			data: {
				displayName: DEMO_DISPLAY_NAME,
				email: DEMO_EMAIL,
				password,
				role: "Admin",
			},
		});
		const namespace = await tx.namespace.create({
			data: { name: "Examples", userId: createdUser.id },
		});
		await tx.function.create({
			data: {
				name: DEMO_FUNCTION.name,
				description: DEMO_FUNCTION.description,
				image: DEMO_FUNCTION.image,
				startup_file: DEMO_FUNCTION.startup_file,
				executionId: randomUUID(),
				userId: createdUser.id,
				namespaceId: namespace.id,
				files: {
					create: { name: DEMO_FUNCTION.startup_file, content: DEMO_FUNCTION.content },
				},
			},
		});
		return createdUser;
	});

	log.info({ userId: user.id, email: user.email }, "Demo account and sample function seeded");
	return { user, functions: 1 };
}
