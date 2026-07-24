import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DependencyManagerModal from "./DependencyManagerModal";

describe("DependencyManagerModal", () => {
	it.each([
		["python:3.12", "Python Dependencies", "requirements.txt"],
		["golang:1.23", "Go Dependencies", "go.mod"],
		["node:22", "Node.js Dependencies", "package.json"],
	])("supports %s dependency manifests", async (image, title, filename) => {
		const onSave = jest.fn().mockResolvedValue(true);

		render(React.createElement(DependencyManagerModal, {
			isOpen: true,
			onClose: jest.fn(),
			functionId: 1,
			image,
			files: [],
			onSave,
		}));

		expect(screen.getByRole("heading", { name: title })).toBeTruthy();
		const selector = screen.getByRole("combobox");
		expect(selector.value).toBe(filename);

		fireEvent.change(screen.getByRole("textbox", { name: `${filename} content` }), {
			target: { value: "updated dependency content" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save Dependencies" }));

		await waitFor(() => {
			expect(onSave).toHaveBeenCalledWith(filename, "updated dependency content");
		});
	});

	it("renders null for unsupported runtimes", () => {
		const { container } = render(React.createElement(DependencyManagerModal, {
			isOpen: true,
			onClose: jest.fn(),
			functionId: 1,
			image: "unknown:1.0",
			files: [],
			onSave: jest.fn(),
		}));
		expect(container.firstChild).toBeNull();
	});

	it("pre-populates package.json with a useful default for node", () => {
		render(React.createElement(DependencyManagerModal, {
			isOpen: true,
			onClose: jest.fn(),
			functionId: 42,
			image: "node:24",
			files: [],
			onSave: jest.fn(),
		}));

		const textarea = screen.getByRole("textbox", { name: "package.json content" });
		expect(textarea.value).toContain('"dependencies"');
		expect(textarea.value).toContain('shsf-function-42');
	});
});
