import ReactDOM from "react-dom/client";
import App from "./App";

const container = document.getElementById("root") as HTMLElement;
const root = ReactDOM.createRoot(container);

root.render(<App />);

export const BASE_URL =
	process.env.REACT_APP_API_URL || "http://localhost:5000";

export const VERSION: {
	type: "SHSF API" | "SHSF UI";
	major: number;
	minor: number;
	patch: number;
	toString: () => string;
} = {
	type: "SHSF API",
	major: 2,
	minor: 0,
	patch: 0,
	toString() {
		return `${this.major}.${this.minor}.${this.patch}`;
	},
};
