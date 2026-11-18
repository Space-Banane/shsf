import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	publicDir: "public",
	build: {
		outDir: "build",
		rolldownOptions: {
			output: {
				codeSplitting: {
					groups: [
						// Keep Vite's preload helper out of the Monaco chunk; otherwise the entry
						// imports the helper from that chunk and preloads the editor on first paint.
						{ name: "vite-runtime", test: /preload-helper|modulepreload-polyfill/, priority: 30 },
						{ name: "monaco", test: /[\\/]node_modules[\\/]monaco-editor[\\/]/, priority: 20 },
					],
				},
			},
		},
	},
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
