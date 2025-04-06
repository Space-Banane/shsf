import ReactDOM from "react-dom/client";
import App from "./App";

const container = document.getElementById("root") as HTMLElement;
const root = ReactDOM.createRoot(container);

root.render(
	<App />
);

export const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";