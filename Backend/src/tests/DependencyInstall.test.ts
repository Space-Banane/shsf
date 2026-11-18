import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../lib/env";

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	findFirst: vi.fn(),
	update: vi.fn(),
	installDependencies: vi.fn(),
}));

vi.mock("../index", () => ({
	prisma: {
		dependencyInstall: {
			create: mocks.create,
			findFirst: mocks.findFirst,
			update: mocks.update,
		},
	},
}));

vi.mock("../lib/Runner", () => ({
	installDependencies: mocks.installDependencies,
}));

import {
	getDependencyInstallStatus,
	startDependencyInstall,
} from "../lib/DependencyInstall";

const functionData = { id: 7, git_url: null, env: null, userId: 1 } as never;

function jobRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 1,
		functionId: 7,
		status: "running",
		message: null,
		startedAt: new Date(),
		finishedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.installDependencies.mockResolvedValue(true);
	mocks.create.mockResolvedValue(jobRow());
	mocks.findFirst.mockResolvedValue(null);
	mocks.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
		Promise.resolve(jobRow(data)),
	);
});

describe("startDependencyInstall", () => {
	it("creates a job and runs the install in the background", async () => {
		const job = await startDependencyInstall(7, functionData, []);

		expect(job.status).toBe("running");
		expect(mocks.create).toHaveBeenCalledWith({ data: { functionId: 7 } });

		await vi.waitFor(() =>
			expect(mocks.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: 1 },
					data: expect.objectContaining({ status: "succeeded" }),
				}),
			),
		);
	});

	it("reuses a running job instead of starting a second install", async () => {
		mocks.findFirst.mockResolvedValue(jobRow());

		const job = await startDependencyInstall(7, functionData, []);

		expect(job.status).toBe("running");
		expect(mocks.create).not.toHaveBeenCalled();
		expect(mocks.installDependencies).not.toHaveBeenCalled();
	});

	it("dedupes concurrent starts for the same function", async () => {
		const first = startDependencyInstall(7, functionData, []);
		const second = startDependencyInstall(7, functionData, []);

		const [firstJob, secondJob] = await Promise.all([first, second]);

		expect(firstJob.id).toBe(secondJob.id);
		expect(mocks.create).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => expect(mocks.update).toHaveBeenCalled());
	});

	it("records a failed job when the install reports failure", async () => {
		mocks.installDependencies.mockResolvedValue(false);

		await startDependencyInstall(7, functionData, []);

		await vi.waitFor(() =>
			expect(mocks.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						status: "failed",
						message: expect.stringContaining("could not be installed"),
					}),
				}),
			),
		);
	});

	it("records an actionable error when the install times out", async () => {
		vi.useFakeTimers();
		try {
			mocks.installDependencies.mockImplementation(
				(_id: number, _data: unknown, _files: unknown, options: { signal: AbortSignal }) =>
					new Promise((_resolve, reject) => {
						options.signal.addEventListener("abort", () =>
							reject(new Error("Dependency installation aborted")),
						);
					}),
			);

			await startDependencyInstall(7, functionData, []);
			await vi.advanceTimersByTimeAsync(env.DEPENDENCY_INSTALL_TIMEOUT_MS);

			expect(mocks.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						status: "failed",
						message: expect.stringContaining("timed out"),
					}),
				}),
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it("records the in-container timeout exit code as a timed-out job", async () => {
		mocks.installDependencies.mockResolvedValue("timeout");

		await startDependencyInstall(7, functionData, []);

		await vi.waitFor(() =>
			expect(mocks.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						status: "failed",
						message: expect.stringContaining("timed out"),
					}),
				}),
			),
		);
	});
});

describe("getDependencyInstallStatus", () => {
	it("returns the latest job", async () => {
		const running = jobRow();
		mocks.findFirst.mockResolvedValue(running);

		await expect(getDependencyInstallStatus(7)).resolves.toBe(running);
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it("looks up a specific job for the function", async () => {
		const finished = jobRow({ id: 9, status: "succeeded" });
		mocks.findFirst.mockResolvedValue(finished);

		await expect(getDependencyInstallStatus(7, 9)).resolves.toBe(finished);
		expect(mocks.findFirst).toHaveBeenCalledWith({
			where: { id: 9, functionId: 7 },
		});
	});

	it("fails a running job that outlived the timeout", async () => {
		mocks.findFirst.mockResolvedValue(
			jobRow({
				startedAt: new Date(
					Date.now() - env.DEPENDENCY_INSTALL_TIMEOUT_MS - 120_000,
				),
			}),
		);

		const job = await getDependencyInstallStatus(7);

		expect(job?.status).toBe("failed");
		expect(mocks.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: "failed",
					message: expect.stringContaining("timed out"),
				}),
			}),
		);
	});

	it("fails a running job left behind by a restart", async () => {
		mocks.findFirst.mockResolvedValue(
			jobRow({
				startedAt: new Date(Date.now() - process.uptime() * 1000 - 60_000),
			}),
		);

		const job = await getDependencyInstallStatus(7);

		expect(job?.status).toBe("failed");
		expect(mocks.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: "failed",
					message: expect.stringContaining("restarted"),
				}),
			}),
		);
	});
});
