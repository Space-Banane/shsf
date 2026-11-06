import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ShareModal from "./ShareModal";
import { addShare, listShareableGroups, listShares, revokeShare } from "../../../services/backend.sharing";

vi.mock("../../..", () => ({ BASE_URL: "" }));
vi.mock("../../../services/backend.sharing", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../../services/backend.sharing")>()),
	listShares: vi.fn(),
	listShareableGroups: vi.fn(),
	addShare: vi.fn(),
	revokeShare: vi.fn(),
}));

const share = {
	id: 4,
	permission: "edit" as const,
	createdAt: "",
	user: { id: 3, displayName: "Alice", email: "alice@x.test" },
	group: null,
};

describe("ShareModal", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(listShareableGroups).mockResolvedValue({ status: "OK", data: [{ id: 7, name: "eng", description: null }] });
	});

	it("shows an empty state, then lists a new grant after sharing by email", async () => {
		vi.mocked(listShares).mockResolvedValueOnce({ status: "OK", data: [] }).mockResolvedValueOnce({ status: "OK", data: [share] });
		vi.mocked(addShare).mockResolvedValue({ status: "OK", data: share });
		render(<ShareModal isOpen onClose={vi.fn()} type="function" resourceId={1} resourceName="fn" />);

		await screen.findByText("Not shared with anyone yet.");
		fireEvent.change(screen.getByLabelText("User email or group"), { target: { value: "alice@x.test" } });
		fireEvent.change(screen.getByLabelText("Permission"), { target: { value: "edit" } });
		fireEvent.click(screen.getByRole("button", { name: "Share" }));

		await screen.findByText(/Alice \(alice@x.test\)/);
		expect(addShare).toHaveBeenCalledWith("function", 1, { email: "alice@x.test", permission: "edit" });
	});

	it("shares with a group and offers only the permissions valid for storage", async () => {
		vi.mocked(listShares).mockResolvedValue({ status: "OK", data: [] });
		vi.mocked(addShare).mockResolvedValue({ status: "OK", data: { ...share, user: null, group: { id: 7, name: "eng" } } });
		render(<ShareModal isOpen onClose={vi.fn()} type="storage" resourceId={2} resourceName="kv" />);

		await screen.findByText("Not shared with anyone yet.");
		const options = Array.from((screen.getByLabelText("Permission") as HTMLSelectElement).options).map((o) => o.value);
		expect(options).toEqual(["view", "edit"]);
		fireEvent.change(screen.getByLabelText("User email or group"), { target: { value: "group:7" } });
		fireEvent.click(screen.getByRole("button", { name: "Share" }));
		await waitFor(() => expect(addShare).toHaveBeenCalledWith("storage", 2, { groupId: 7, permission: "view" }));
	});

	it("revokes a grant and surfaces a backend error", async () => {
		vi.mocked(listShares).mockResolvedValueOnce({ status: "OK", data: [share] }).mockResolvedValue({ status: "OK", data: [] });
		vi.mocked(revokeShare).mockResolvedValue({ status: "OK", data: undefined });
		vi.mocked(addShare).mockResolvedValue({ status: "FAILED", code: "NOT_FOUND", message: "No user with that email." });
		render(<ShareModal isOpen onClose={vi.fn()} type="namespace" resourceId={5} resourceName="team" />);

		fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
		await screen.findByText("Not shared with anyone yet.");
		expect(revokeShare).toHaveBeenCalledWith("namespace", 5, 4);

		fireEvent.change(screen.getByLabelText("User email or group"), { target: { value: "ghost@x.test" } });
		fireEvent.click(screen.getByRole("button", { name: "Share" }));
		await screen.findByText("No user with that email.");
	});
});
