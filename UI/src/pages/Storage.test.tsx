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

		await screen.findByRole("button", { name: /storage-one/i });
		fireEvent.click(screen.getByRole("button", { name: /storage-one/i }));
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
});
