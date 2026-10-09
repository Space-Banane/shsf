import { fireEvent, render, screen } from "@testing-library/react";
import Modal, { ModalError } from "./Modal";
import { toast } from "react-toastify";

vi.mock("react-toastify", () => ({
	toast: { error: vi.fn() },
}));

describe("Modal", () => {
	it("renders title and children when open", () => {
		render(
			<Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
				<p>modal body</p>
			</Modal>,
		);
		expect(screen.getByRole("heading", { name: "Test Modal" })).toBeInTheDocument();
		expect(screen.getByText("modal body")).toBeInTheDocument();
	});

	it("renders nothing when closed", () => {
		render(
			<Modal isOpen={false} onClose={vi.fn()} title="Hidden">
				<p>hidden body</p>
			</Modal>,
		);
		expect(screen.queryByText("hidden body")).not.toBeInTheDocument();
	});

	it("closes on Escape", () => {
		const onClose = vi.fn();
		render(
			<Modal isOpen={true} onClose={onClose} title="Esc">
				<p>body</p>
			</Modal>,
		);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("does not close on Escape while loading", () => {
		const onClose = vi.fn();
		render(
			<Modal isOpen={true} onClose={onClose} title="Busy" isLoading={true}>
				<p>body</p>
			</Modal>,
		);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onClose).not.toHaveBeenCalled();
	});
});

describe("ModalError", () => {
	it("renders the error message", () => {
		render(<ModalError message="Something failed" />);
		expect(screen.getByText("Something failed")).toBeInTheDocument();
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("renders nothing without a message", () => {
		const { container } = render(<ModalError message={null} />);
		expect(container).toBeEmptyDOMElement();
	});
});
