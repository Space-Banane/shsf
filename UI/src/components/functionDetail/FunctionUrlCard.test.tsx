import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-toastify";
import { FunctionUrlCard } from "./FunctionUrlCard";
import { copyTextToClipboard } from "../../utils/clipboard";
import type { XFunction } from "../../types/Prisma";

vi.mock("../..", () => ({ BASE_URL: "", PUBLIC_BASE_URL: "http://shsf.test" }));
vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../../utils/clipboard", () => ({ copyTextToClipboard: vi.fn() }));

const fn = (overrides: Partial<XFunction> = {}) =>
	({ allow_http: true, namespaceId: 2, executionId: "abc", ...overrides }) as XFunction;

describe("FunctionUrlCard", () => {
	beforeEach(() => vi.clearAllMocks());

	it("shows the execution URL and copies it", async () => {
		render(<FunctionUrlCard functionData={fn()} />);
		expect(screen.getByLabelText("Function URL")).toHaveValue("http://shsf.test/api/exec/2/abc");

		fireEvent.click(screen.getByRole("button", { name: /Copy URL to Clipboard/ }));

		await screen.findByRole("button", { name: /Copied!/ });
		expect(copyTextToClipboard).toHaveBeenCalledWith("http://shsf.test/api/exec/2/abc");
	});

	it("tells the user to copy manually when the clipboard is unavailable", async () => {
		vi.mocked(copyTextToClipboard).mockRejectedValueOnce(new Error("denied"));
		render(<FunctionUrlCard functionData={fn()} />);

		fireEvent.click(screen.getByRole("button", { name: /Copy URL/ }));

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				"The URL could not be copied. Select it and copy it manually.",
			),
		);
	});

	it("offers the alias URL only when HTTP is allowed and an alias exists", async () => {
		const { rerender } = render(
			<FunctionUrlCard functionData={fn({ executionAlias: "my-alias" })} />,
		);
		expect(screen.getByLabelText("Alias URL")).toHaveValue("http://shsf.test/exec/my-alias");
		fireEvent.click(screen.getByRole("button", { name: /Copy Alias URL/ }));
		await waitFor(() =>
			expect(copyTextToClipboard).toHaveBeenCalledWith("http://shsf.test/exec/my-alias"),
		);

		rerender(<FunctionUrlCard functionData={fn({ allow_http: false, executionAlias: "my-alias" })} />);
		expect(screen.queryByLabelText("Alias URL")).toBeNull();
		expect(screen.getByLabelText("Function URL")).toHaveValue("No HTTP Access 🚫");
	});
});
