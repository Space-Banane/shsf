import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import StoragePage from "./Storage";
import { listStorageItems, listStorages } from "../services/backend.storage";
import type { MockedFunction } from "vitest";

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

function renderStorage(initialEntry: string) {
	const router = createMemoryRouter(
		[{ path: "/storage", element: <StoragePage /> }],
		{ initialEntries: [initialEntry] },
	);
	render(<RouterProvider router={router} />);
	return router;
}

describe("StoragePage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedListStorages.mockResolvedValue({
			status: "OK",
			data: [{ id: 1, name: "storage-one", purpose: "Test storage", user: 1 }],
		});
		mockedListStorageItems.mockResolvedValue({ status: "OK", data: [] });
	});

	it("selects a storage without adding a history entry and returns to the list in place", async () => {
		const router = renderStorage("/storage");

		await screen.findByRole("button", { name: /^storage-one/i });
		fireEvent.click(screen.getByRole("button", { name: /^storage-one/i }));

		await screen.findByText("No items in this storage.");
		expect(router.state.location.search).toBe("?storage=1");
		expect(router.state.historyAction).toBe("REPLACE");

		fireEvent.click(screen.getByRole("button", { name: "Back to storages" }));
		await waitFor(() => expect(router.state.location.search).toBe(""));
		expect(await screen.findByRole("button", { name: /^storage-one/i })).toBeInTheDocument();
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
		renderStorage("/storage?storage=9");

		await screen.findByText(/Owned by Owner/);
		expect(screen.getByText(/Shared · view/i)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Get Item" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Clear All" })).toBeNull();
		expect(screen.queryByRole("button", { name: /Add Item/ })).toBeNull();
		expect(mockedListStorageItems).toHaveBeenCalledWith(shared, 1);
	});

	it("still honours the legacy location.state selection and mirrors it into the URL", async () => {
		const router = createMemoryRouter(
			[{ path: "/storage", element: <StoragePage /> }],
			{
				initialEntries: [
					{
						pathname: "/storage",
						state: { storageExplorer: { selectedStorageId: 1 } },
					},
				],
			},
		);
		render(<RouterProvider router={router} />);

		await screen.findByText("No items in this storage.");
		await waitFor(() => expect(router.state.location.search).toBe("?storage=1"));
	});

	it("offers sharing only on storages the user owns", async () => {
		mockedListStorages.mockResolvedValue({
			status: "OK",
			data: [
				{ id: 1, name: "mine", purpose: "", user: 1 },
				{ id: 2, name: "theirs", purpose: "", user: 2, shared: true, access: "edit", owner: { id: 2, displayName: "Bob", email: "b@x" } },
			],
		});
		renderStorage("/storage");

		await screen.findByRole("button", { name: "Share storage mine" });
		expect(screen.queryByRole("button", { name: "Share storage theirs" })).toBeNull();
		expect(screen.getByText(/Shared by Bob · edit/i)).toBeTruthy();
	});
});
