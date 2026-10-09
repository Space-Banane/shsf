import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	publicDir: "public",
	build: { outDir: "build" },
	server: {
		port: 443,
		proxy: {
			"/api": "http://localhost:5000",
			"/version": "http://localhost:5000",
		},
	},
	envPrefix: ["VITE_", "REACT_APP_"],
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: "./src/setupTests.ts",
		include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
	},
});
