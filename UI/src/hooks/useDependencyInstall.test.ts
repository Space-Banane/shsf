import { act, renderHook } from "@testing-library/react";
import { useDependencyInstall } from "./useDependencyInstall";
import {
	getDependencyInstallStatus,
	installDependencies,
	type DependencyInstallJob,
} from "../services/backend.functions";

vi.mock("..", () => ({ BASE_URL: "", PUBLIC_BASE_URL: "" }));
vi.mock("../services/backend.functions", () => ({
	installDependencies: vi.fn(),
	getDependencyInstallStatus: vi.fn(),
}));

const runningJob: DependencyInstallJob = {
	id: 1,
	functionId: 4,
	status: "running",
	message: null,
	startedAt: new Date().toISOString(),
	finishedAt: null,
};

const finishedJob = (
	status: "succeeded" | "failed",
	message: string,
): DependencyInstallJob => ({
	...runningJob,
	status,
	message,
	finishedAt: new Date().toISOString(),
});

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("useDependencyInstall", () => {
	it("polls the job until it succeeds", async () => {
		vi.mocked(installDependencies).mockResolvedValue({
			status: "OK",
			job: runningJob,
		});
		vi.mocked(getDependencyInstallStatus)
			.mockResolvedValueOnce({ status: "OK", job: runningJob })
			.mockResolvedValue({
				status: "OK",
				job: finishedJob("succeeded", "Dependencies installed successfully."),
			});
		const onFinished = vi.fn();
		const { result } = renderHook(() => useDependencyInstall(4, { onFinished }));

		let pending: Promise<void>;
		await act(async () => {
			pending = result.current.install();
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(2_000);
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(2_000);
			await pending;
		});

		expect(getDependencyInstallStatus).toHaveBeenCalledTimes(2);
		expect(getDependencyInstallStatus).toHaveBeenCalledWith(4, runningJob.id);
		expect(result.current.installing).toBe(false);
		expect(result.current.result).toMatchObject({
			title: "Dependencies Installed",
			success: true,
		});
		expect(onFinished).toHaveBeenCalled();
	});

	it("shows the failure message the job reported", async () => {
		vi.mocked(installDependencies).mockResolvedValue({
			status: "OK",
			job: runningJob,
		});
		vi.mocked(getDependencyInstallStatus).mockResolvedValue({
			status: "OK",
			job: finishedJob("failed", "Dependency installation timed out after 10 minute(s)."),
		});
		const { result } = renderHook(() => useDependencyInstall(4));

		let pending: Promise<void>;
		await act(async () => {
			pending = result.current.install();
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(2_000);
			await pending;
		});

		expect(result.current.installing).toBe(false);
		expect(result.current.result).toMatchObject({
			title: "Install Error",
			success: false,
			message: "Dependency installation timed out after 10 minute(s).",
		});
	});

	it("reports a rejected start without polling", async () => {
		vi.mocked(installDependencies).mockResolvedValue({
			status: "FAILED",
			code: "DEPENDENCY_ERROR",
			message: "Function has no requirements.txt file",
		});
		const { result } = renderHook(() => useDependencyInstall(4));

		await act(async () => {
			await result.current.install();
		});

		expect(getDependencyInstallStatus).not.toHaveBeenCalled();
		expect(result.current.installing).toBe(false);
		expect(result.current.result).toMatchObject({
			title: "Install Error",
			success: false,
			message: "Function has no requirements.txt file",
		});
	});
});
