import { fireEvent, renderHook } from "@testing-library/react";
import { useShiftEnterSubmit } from "./useShiftEnterSubmit";

describe("useShiftEnterSubmit", () => {
	it("fires the callback on Ctrl+Enter", () => {
		const onSubmit = jest.fn();
		renderHook(() => useShiftEnterSubmit(onSubmit));

		fireEvent.keyDown(document, { key: "Enter", ctrlKey: true });
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it("fires the callback on Cmd+Enter (macOS)", () => {
		const onSubmit = jest.fn();
		renderHook(() => useShiftEnterSubmit(onSubmit));

		fireEvent.keyDown(document, { key: "Enter", metaKey: true });
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it("does not fire on plain Enter or Ctrl with other keys", () => {
		const onSubmit = jest.fn();
		renderHook(() => useShiftEnterSubmit(onSubmit));

		fireEvent.keyDown(document, { key: "Enter" });
		fireEvent.keyDown(document, { key: "s", ctrlKey: true });
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("does not fire when disabled", () => {
		const onSubmit = jest.fn();
		renderHook(() => useShiftEnterSubmit(onSubmit, false));

		fireEvent.keyDown(document, { key: "Enter", ctrlKey: true });
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("removes the listener on unmount", () => {
		const onSubmit = jest.fn();
		const { unmount } = renderHook(() => useShiftEnterSubmit(onSubmit));
		unmount();

		fireEvent.keyDown(document, { key: "Enter", ctrlKey: true });
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
