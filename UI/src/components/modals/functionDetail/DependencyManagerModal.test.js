import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DependencyManagerModal from "./DependencyManagerModal";

const dotnetProject = {
	id: 1,
	name: "app.csproj",
	content: "<Project />",
	functionId: 1,
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe("DependencyManagerModal", () => {
	it.each([
		["python:3.12", "Python Dependencies", "requirements.txt"],
		["golang:1.23", "Go Dependencies", "go.mod"],
		["mcr.microsoft.com/dotnet/sdk:8.0", ".NET Dependencies", "app.csproj"],
	])("supports %s dependency manifests", async (image, title, filename) => {
		const onSave = jest.fn().mockResolvedValue(true);
		const files = image.startsWith("mcr.microsoft.com") ? [dotnetProject] : [];

		render(React.createElement(DependencyManagerModal, {
			isOpen: true,
			onClose: jest.fn(),
			functionId: 1,
			image,
			files,
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
});
