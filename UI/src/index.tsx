import ReactDOM from "react-dom/client";
import App from "./App";

const container = document.getElementById("root") as HTMLElement;
const root = ReactDOM.createRoot(container);

root.render(
	<App />
);

export const BASE_URL = process.env.UI_URL;