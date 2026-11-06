import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CreateFunctionModal from "./CreateFunctionModal";
import { createFunction } from "../../../services/backend.functions";

vi.mock("../../..", () => ({ BASE_URL: "" }));
vi.mock("../../../services/backend.functions", () => ({
	createFunction: vi.fn(),
	getDeprecatedImages: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../../services/backend.files", () => ({
	loadPossibleDefaults: vi.fn().mockResolvedValue({ status: "OK", defaults: [] }),
}));

it("validates the form, then creates a function and opens its editor", async () => {
	vi.mocked(createFunction).mockResolvedValue({ status: "OK", data: { id: 42 } } as never);
	const onSuccess = vi.fn();
	render(
		<MemoryRouter initialEntries={["/functions"]}>
			<Routes>
				<Route path="/functions" element={<CreateFunctionModal isOpen onClose={vi.fn()} onSuccess={onSuccess} namespaces={[{ id: 2, name: "prod" } as never]} />} />
				<Route path="/functions/:id" element={<div>Function editor</div>} />
			</Routes>
		</MemoryRouter>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Create Function" }));
	expect(screen.getByText("Please select a namespace")).toBeInTheDocument();
	fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "2" } });
	fireEvent.change(screen.getByPlaceholderText("my-awesome-function"), { target: { value: "hello" } });
	fireEvent.click(screen.getByRole("button", { name: "Create Function" }));
	await waitFor(() => expect(screen.getByText("Function editor")).toBeInTheDocument());
	expect(createFunction).toHaveBeenCalledWith(expect.objectContaining({ name: "hello", namespaceId: 2 }));
	expect(onSuccess).toHaveBeenCalledTimes(1);
});
