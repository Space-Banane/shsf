module.exports = {
	darkMode: "class",
	content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
	theme: {
		extend: {
			colors: {
				text: "#dde2f0",
				subhead: "#fbf2c4",
				background: "#070b14",
				surface: "#0c1120",
				"surface-raised": "#111827",
				primary: "#7c83fd",
				secondary: "#96baff",
				accent: "#7dedff",
				footer: "#070b14",
				navbar: "#070b14",
				grayed: "#5a6478",
				shsf: "#7c83fd",
				muted: "#64748b",
			},
			borderColor: {
				DEFAULT: "rgba(255,255,255,0.07)",
				primary: "#7c83fd",
				secondary: "#96baff",
				accent: "#7dedff",
				text: "#dde2f0",
				subtle: "rgba(255,255,255,0.07)",
				"primary-dim": "rgba(124,131,253,0.2)",
			},
			animation: {
				fadeIn: "fadeIn 0.2s ease-in-out",
				slideIn: "slideIn 0.2s ease-in-out",
			},
			keyframes: {
				fadeIn: {
					"0%": { opacity: "0" },
					"100%": { opacity: "1" },
				},
				slideIn: {
					"0%": { transform: "translateY(-10px)", opacity: "0" },
					"100%": { transform: "translateY(0)", opacity: "1" },
				},
			},
			scale: {
				102: "1.02",
				98: "0.98",
			},
		},
	},
	plugins: [],
};
