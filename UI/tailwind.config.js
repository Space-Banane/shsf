module.exports = {
	content: [
		"./src/**/*.{js,jsx,ts,tsx}", // Include all source files
	],
	theme: {
		extend: {
			colors: {
				'dark': {
					100: '#d1d5db',
					200: '#9ca3af',
					300: '#6b7280',
					400: '#4b5563',
					500: '#374151',
					600: '#1f2937',
					700: '#111827',
					800: '#0d1420',
					900: '#030712',
				},
			},
			boxShadow: {
				'custom': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
			},
		},
	},
	plugins: [],
};
