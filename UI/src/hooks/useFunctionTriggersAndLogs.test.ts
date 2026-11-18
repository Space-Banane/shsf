import { act, renderHook } from "@testing-library/react";
import { toast } from "react-toastify";
import { useFunctionTriggers } from "./useFunctionTriggers";
import { useFunctionLogs } from "./useFunctionLogs";
import {
	createTrigger,
	deleteTrigger,
	getTriggers,
	runTrigger,
	updateTrigger,
} from "../services/backend.triggers";
import { getLogsByFuncId } from "../services/backend.functions";
import type { Trigger } from "../types/Prisma";

vi.mock("..", () => ({ BASE_URL: "", PUBLIC_BASE_URL: "" }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../services/backend.triggers", () => ({
	createTrigger: vi.fn(),
	deleteTrigger: vi.fn(),
	getTriggers: vi.fn(),
	runTrigger: vi.fn(),
	updateTrigger: vi.fn(),
}));
vi.mock("../services/backend.functions", () => ({ getLogsByFuncId: vi.fn() }));

const trigger = (id: number, name = `t${id}`): Trigger => ({ id, name }) as Trigger;
const input = { name: "n", description: "", cron: "* * * * *", data: "{}", enabled: true };

describe("useFunctionTriggers", () => {
	beforeEach(() => vi.clearAllMocks());

	it("reloads the list after creating a trigger", async () => {
		vi.mocked(createTrigger).mockResolvedValue({ status: "OK", data: { id: 3 } });
		vi.mocked(getTriggers).mockResolvedValue({ status: "OK", data: [trigger(3)] });
		const { result } = renderHook(() => useFunctionTriggers(1));

		let ok = false;
		await act(async () => {
			ok = await result.current.create(input);
		});

		expect(ok).toBe(true);
		expect(createTrigger).toHaveBeenCalledWith(1, input);
		expect(result.current.triggers).toEqual([trigger(3)]);
	});

	it("toasts and reports failure when the backend rejects a create", async () => {
		vi.mocked(createTrigger).mockResolvedValue({ status: 400, message: "bad cron" } as never);
		const { result } = renderHook(() => useFunctionTriggers(1));

		let ok = true;
		await act(async () => {
			ok = await result.current.create(input);
		});

		expect(ok).toBe(false);
		expect(toast.error).toHaveBeenCalledWith("Error creating trigger: bad cron");
		expect(getTriggers).not.toHaveBeenCalled();
	});

	it("replaces an updated trigger in place and removes a deleted one", async () => {
		vi.mocked(updateTrigger).mockResolvedValue({
			status: "OK",
			data: trigger(2, "renamed"),
		});
		vi.mocked(deleteTrigger).mockResolvedValue({ status: "OK", message: "" });
		const { result } = renderHook(() => useFunctionTriggers(1));
		act(() => result.current.setTriggers([trigger(1), trigger(2)]));

		await act(async () => void (await result.current.update(2, input)));
		expect(result.current.triggers.map((t) => t.name)).toEqual(["t1", "renamed"]);

		await act(async () => void (await result.current.remove(1)));
		expect(result.current.triggers.map((t) => t.id)).toEqual([2]);
	});

	it("runs a trigger, toasts success and notifies the caller", async () => {
		vi.mocked(runTrigger).mockResolvedValue({ status: "OK", data: {} });
		const onRan = vi.fn();
		const { result } = renderHook(() => useFunctionTriggers(1, { onRan }));

		let ok = false;
		await act(async () => {
			ok = await result.current.run(trigger(5));
		});

		expect(ok).toBe(true);
		expect(runTrigger).toHaveBeenCalledWith(1, 5);
		expect(toast.success).toHaveBeenCalledWith("Trigger executed");
		expect(onRan).toHaveBeenCalled();
	});

	it("does nothing without a trigger", async () => {
		const { result } = renderHook(() => useFunctionTriggers(1));
		expect(await result.current.run(null)).toBe(false);
		expect(runTrigger).not.toHaveBeenCalled();
	});
});

describe("useFunctionLogs", () => {
	let hidden = false;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		hidden = false;
		Object.defineProperty(document, "hidden", {
			configurable: true,
			get: () => hidden,
		});
		vi.mocked(getLogsByFuncId).mockResolvedValue({ status: "OK", data: [] });
	});
	afterEach(() => {
		vi.useRealTimers();
		Object.defineProperty(document, "hidden", {
			configurable: true,
			value: false,
		});
	});

	it("does not poll while the log view is closed", async () => {
		renderHook(() => useFunctionLogs(1, false));

		await act(async () => void vi.advanceTimersByTime(30_000));
		expect(getLogsByFuncId).not.toHaveBeenCalled();
	});

	it("loads immediately, then polls every 10 seconds while the card is expanded", async () => {
		const { result } = renderHook(() => useFunctionLogs(1, false));
		act(() => result.current.setExpanded(true));
		await act(async () => {});
		expect(getLogsByFuncId).toHaveBeenCalledTimes(1);

		await act(async () => void vi.advanceTimersByTime(10_000));
		expect(getLogsByFuncId).toHaveBeenCalledTimes(2);
	});

	it("polls while the logs modal is open and stops when it closes", async () => {
		const { result } = renderHook(() => useFunctionLogs(1, false));
		act(() => result.current.setModalOpen(true));
		await act(async () => {});
		expect(getLogsByFuncId).toHaveBeenCalledTimes(1);

		await act(async () => void vi.advanceTimersByTime(10_000));
		expect(getLogsByFuncId).toHaveBeenCalledTimes(2);

		act(() => result.current.setModalOpen(false));
		vi.mocked(getLogsByFuncId).mockClear();

		await act(async () => void vi.advanceTimersByTime(30_000));
		expect(getLogsByFuncId).not.toHaveBeenCalled();
	});

	it("pauses polling while the tab is hidden and refreshes when it is visible again", async () => {
		const { result } = renderHook(() => useFunctionLogs(1, false));
		act(() => result.current.setExpanded(true));
		await act(async () => {});
		vi.mocked(getLogsByFuncId).mockClear();

		hidden = true;
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"));
		});
		await act(async () => void vi.advanceTimersByTime(30_000));
		expect(getLogsByFuncId).not.toHaveBeenCalled();

		hidden = false;
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"));
		});
		expect(getLogsByFuncId).toHaveBeenCalledTimes(1);
	});

	it("does not toggle the loading spinner for background refreshes", async () => {
		const { result } = renderHook(() => useFunctionLogs(1, false));
		act(() => result.current.setExpanded(true));
		await act(async () => {});
		expect(result.current.isLoading).toBe(false);

		vi.mocked(getLogsByFuncId).mockResolvedValue({
			status: "OK",
			data: [{ id: 1 }] as never,
		});
		await act(async () => void vi.advanceTimersByTime(10_000));

		expect(getLogsByFuncId).toHaveBeenCalledTimes(2);
		expect(result.current.isLoading).toBe(false);
	});

	it("refreshes silently once a run settles, even while the log view is closed", async () => {
		const { rerender } = renderHook(({ settled }) => useFunctionLogs(1, settled), {
			initialProps: { settled: false },
		});
		await act(async () => {});
		expect(getLogsByFuncId).not.toHaveBeenCalled();

		rerender({ settled: true });
		await act(async () => {});
		expect(getLogsByFuncId).toHaveBeenCalledTimes(1);
	});

	it("exposes the fetched logs", async () => {
		vi.mocked(getLogsByFuncId).mockResolvedValue({
			status: "OK",
			data: [{ id: 1 }] as never,
		});
		const { result } = renderHook(() => useFunctionLogs(1, false));
		act(() => result.current.setExpanded(true));
		await act(async () => {});
		expect(result.current.logs).toEqual([{ id: 1 }]);
		expect(result.current.isLoading).toBe(false);
	});
});
