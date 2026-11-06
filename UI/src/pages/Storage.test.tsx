import { fireEvent, render, screen } from "@testing-library/react";
import StoragePage from "./Storage";
import { listStorageItems, listStorages } from "../services/backend.storage";
import type { MockedFunction } from "vitest";

const mockLocation = vi.fn();
const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
	useLocation: () => mockLocation(),
	useNavigate: () => mockNavigate,
}), { virtual: true });

vi.mock("../services/backend.sharing", () => ({
	can: (access: string | undefined, need: string) => {
		const rank: Record<string, number> = { view: 1, execute: 2, edit: 3, owner: 4 };
		return rank[access ?? "owner"] >= rank[need];
	},
	listShares: vi.fn(),
	listShareableGroups: vi.fn(),
	addShare: vi.fn(),
	revokeShare: vi.fn(),
	PERMISSIONS: { storage: ["view", "edit"] },
}));

vi.mock("../services/backend.storage", () => ({
	listStorages: vi.fn(),
	listStorageItems: vi.fn(),
	createStorage: vi.fn(),
	deleteStorage: vi.fn(),
	clearStorageItems: vi.fn(),
	setStorageItem: vi.fn(),
	getStorageItem: vi.fn(),
	deleteStorageItem: vi.fn(),
}));

const mockedListStorages = listStorages as MockedFunction<typeof listStorages>;
const mockedListStorageItems = listStorageItems as MockedFunction<typeof listStorageItems>;

describe("StoragePage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLocation.mockReturnValue({ pathname: "/storage", search: "", hash: "", state: null });
		mockedListStorages.mockResolvedValue({
			status: "OK",
			data: [{ id: 1, name: "storage-one", purpose: "Test storage", user: 1 }],
		});
		mockedListStorageItems.mockResolvedValue({ status: "OK", data: [] });
	});

	it("adds a history entry when opening a storage and goes back from its detail view", async () => {
		const { rerender } = render(<StoragePage />);

		await screen.findByRole("button", { name: /^storage-one/i });
		fireEvent.click(screen.getByRole("button", { name: /^storage-one/i }));
		expect(mockNavigate).toHaveBeenCalledWith("/storage", {
			state: { storageExplorer: { selectedStorageId: 1 } },
		});

		mockLocation.mockReturnValue({
			pathname: "/storage",
			search: "",
			hash: "",
			state: { storageExplorer: { selectedStorageId: 1 } },
		});
		rerender(<StoragePage />);
		await screen.findByText("No items in this storage.");

		fireEvent.click(screen.getByRole("button", { name: "Back to storages" }));
		expect(mockNavigate).toHaveBeenLastCalledWith(-1);
	});

	it("marks a storage shared with view access, shows its owner, and hides write actions", async () => {
		const shared = {
			id: 9,
			name: "team-kv",
			purpose: "Shared",
			user: 2,
			shared: true,
			access: "view" as const,
			owner: { id: 2, displayName: "Owner", email: "owner@x.test" },
		};
		mockedListStorages.mockResolvedValue({ status: "OK", data: [shared] });
		mockLocation.mockReturnValue({ pathname: "/storage", search: "", hash: "", state: { storageExplorer: { selectedStorageId: 9 } } });
		render(<StoragePage />);

		await screen.findByText(/Owned by Owner/);
		expect(screen.getByText(/Shared · view/i)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Get Item" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Clear All" })).toBeNull();
		expect(screen.queryByRole("button", { name: /Add Item/ })).toBeNull();
		expect(mockedListStorageItems).toHaveBeenCalledWith(shared);
	});

	it("offers sharing only on storages the user owns", async () => {
		mockedListStorages.mockResolvedValue({
			status: "OK",
			data: [
				{ id: 1, name: "mine", purpose: "", user: 1 },
				{ id: 2, name: "theirs", purpose: "", user: 2, shared: true, access: "edit", owner: { id: 2, displayName: "Bob", email: "b@x" } },
			],
		});
		render(<StoragePage />);

		await screen.findByRole("button", { name: "Share storage mine" });
		expect(screen.queryByRole("button", { name: "Share storage theirs" })).toBeNull();
		expect(screen.getByText(/Shared by Bob · edit/i)).toBeTruthy();
	});
});
