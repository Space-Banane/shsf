import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css"; // Import Tailwind CSS
import App from "./App";
import reportWebVitals from './reportWebVitals';

const container = document.getElementById("root") as HTMLElement;
const root = ReactDOM.createRoot(container);

root.render(
	<App />
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

export const BASE_URL = "http://localhost:5000"