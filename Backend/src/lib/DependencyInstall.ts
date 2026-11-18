import type { DependencyInstall, Function, FunctionFile } from "@prisma/client";
import { prisma } from "..";
import { env } from "./env";
import { createLogger } from "./logger";
import { installDependencies } from "./Runner";

const log = createLogger("DependencyInstall");

// A job that never reports back (for example because the process restarted)
// must not block new installs forever.
const STALE_GRACE_MS = 60_000;

// Guards the create-vs-create race: two requests arriving together must share
// one job row instead of both starting an install.
const startingInstalls = new Map<number, Promise<DependencyInstall>>();

function timeoutMinutes(): number {
	return Math.max(1, Math.round(env.DEPENDENCY_INSTALL_TIMEOUT_MS / 60_000));
}

function timeoutMessage(): string {
	return `Dependency installation timed out after ${timeoutMinutes()} minute(s). Check requirements.txt and the function logs, then try again.`;
}

function failedMessage(): string {
	return "Dependencies could not be installed. Check requirements.txt and the function logs, then try again.";
}

function restartMessage(): string {
	return "The server restarted during the installation. Run it again.";
}

/**
 * Latest install job for a function (or one specific job), with running jobs
 * that can no longer finish in this process marked failed.
 */
export async function getDependencyInstallStatus(
	functionId: number,
	jobId?: number,
): Promise<DependencyInstall | null> {
	const job = jobId
		? await prisma.dependencyInstall.findFirst({
				where: { id: jobId, functionId },
			})
		: await prisma.dependencyInstall.findFirst({
				where: { functionId },
				orderBy: { id: "desc" },
			});
	if (!job || job.status !== "running") return job;

	const deadline =
		job.startedAt.getTime() + env.DEPENDENCY_INSTALL_TIMEOUT_MS + STALE_GRACE_MS;
	if (Date.now() > deadline) {
		log.warn({ functionId, jobId: job.id }, "Marking stale dependency install as failed");
		return finish(job.id, "failed", timeoutMessage());
	}

	// An install only runs in the process that created the job. A row older than
	// this process was interrupted by a restart and would otherwise block new
	// installs until the timeout elapses.
	const processStartedAt = Date.now() - process.uptime() * 1000;
	if (job.startedAt.getTime() < processStartedAt) {
		log.warn(
			{ functionId, jobId: job.id },
			"Marking interrupted dependency install as failed",
		);
		return finish(job.id, "failed", restartMessage());
	}

	return job;
}

/**
 * Starts a dependency install unless one is already running for the function.
 * Returns immediately with the job row; the install itself runs in the
 * background and updates the row when it finishes.
 */
export async function startDependencyInstall(
	functionId: number,
	functionData: Function,
	files: FunctionFile[],
): Promise<DependencyInstall> {
	const pending = startingInstalls.get(functionId);
	if (pending) return pending;

	const promise = (async () => {
		const active = await getDependencyInstallStatus(functionId);
		if (active?.status === "running") return active;

		const job = await prisma.dependencyInstall.create({ data: { functionId } });
		void runDependencyInstall(job.id, functionId, functionData, files).catch(
			(error) => {
				log.error(
					{ err: error, functionId, jobId: job.id },
					"Dependency install job crashed",
				);
			},
		);
		return job;
	})();

	startingInstalls.set(functionId, promise);
	try {
		return await promise;
	} finally {
		startingInstalls.delete(functionId);
	}
}

async function runDependencyInstall(
	jobId: number,
	functionId: number,
	functionData: Function,
	files: FunctionFile[],
): Promise<void> {
	const controller = new AbortController();
	const timer = setTimeout(
		() => controller.abort(),
		env.DEPENDENCY_INSTALL_TIMEOUT_MS,
	);
	const aborted = new Promise<never>((_resolve, reject) => {
		const onAbort = () => reject(new Error("Dependency installation aborted"));
		if (controller.signal.aborted) onAbort();
		else controller.signal.addEventListener("abort", onAbort, { once: true });
	});

	try {
		// Race so the job is finalized even if a Docker/DB call ignores the signal.
		const result = await Promise.race([
			installDependencies(functionId, functionData, files, {
				signal: controller.signal,
			}),
			aborted,
		]);

		if (result === true) {
			await finish(jobId, "succeeded", "Dependencies installed successfully.");
		} else if (result === "timeout") {
			await finish(jobId, "failed", timeoutMessage());
		} else if (result === 404) {
			await finish(
				jobId,
				"failed",
				"Function has not been executed yet. Run it first and it will install dependencies automatically on its first ever run! After that, use Pip Install to update dependencies, if you have modified the requirements.txt file.",
			);
		} else {
			await finish(jobId, "failed", failedMessage());
		}
	} catch (error) {
		log.error({ err: error, functionId, jobId }, "Dependency installation failed");
		await finish(
			jobId,
			"failed",
			controller.signal.aborted ? timeoutMessage() : failedMessage(),
		);
	} finally {
		clearTimeout(timer);
	}
}

function finish(
	jobId: number,
	status: "succeeded" | "failed",
	message: string,
): Promise<DependencyInstall> {
	return prisma.dependencyInstall.update({
		where: { id: jobId },
		data: { status, message, finishedAt: new Date() },
	});
}
