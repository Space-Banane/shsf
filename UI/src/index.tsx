import ReactDOM from "react-dom/client";
import App from "./App";

const container = document.getElementById("root") as HTMLElement;
const root = ReactDOM.createRoot(container);

root.render(<App />);

export const BASE_URL = process.env.REACT_APP_API_URL || "";
export const PUBLIC_BASE_URL = process.env.REACT_APP_API_URL || window.location.origin;

export const VERSION: {
	type: "SHSF API" | "SHSF UI";
	major: number;
	minor: number;
	patch: number;
	toString: () => string;
} = {
	type: "SHSF UI",
	major: 2,
	minor: 1,
	patch: 0,
	toString() {
		return `${this.major}.${this.minor}.${this.patch}`;
	},
};
