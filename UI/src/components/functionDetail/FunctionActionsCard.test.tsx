import { render, screen } from "@testing-library/react";
import { FunctionActionsCard } from "./FunctionActionsCard";
import { can } from "../../services/backend.sharing";

vi.mock("../..", () => ({ BASE_URL: "" }));

const props = {
	functionData: { git_url: null },
	envDisabled: false,
	onOpenSettings: vi.fn(),
	onOpenEnv: vi.fn(),
	onOpenGuests: vi.fn(),
	onOpenVersionControl: vi.fn(),
	onOpenShare: vi.fn(),
};

describe("FunctionActionsCard permissions", () => {
	it("gives the owner sharing and guest management", () => {
		render(<FunctionActionsCard {...props} canEdit isOwner />);
		expect(screen.getByRole("button", { name: /Share/ })).toBeTruthy();
		expect(screen.getByRole("button", { name: /Guests/ })).toBeTruthy();
	});

	it("lets an edit recipient change settings but not sharing or guests", () => {
		render(<FunctionActionsCard {...props} canEdit isOwner={false} />);
		expect(screen.getByRole("button", { name: /Settings/ })).toBeTruthy();
		expect(screen.queryByRole("button", { name: /Share/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /Guests/ })).toBeNull();
	});

	it("shows no actions to view or execute recipients", () => {
		const { container } = render(<FunctionActionsCard {...props} canEdit={false} isOwner={false} />);
		expect(container).toBeEmptyDOMElement();
	});

	it("ranks access so a missing level means owner and revoked view is denied", () => {
		expect(can(undefined, "owner")).toBe(true);
		expect(can("execute", "edit")).toBe(false);
		expect(can("edit", "execute")).toBe(true);
	});
});
