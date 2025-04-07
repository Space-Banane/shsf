module.exports = {
	darkMode: 'class',
	content: [
		"./src/**/*.{js,jsx,ts,tsx}",
		"./public/index.html",
	],
	theme: {
		extend: {
			colors: {
				text: '#f8f8fe',
				subhead:"#fbf2c4",
				background: '#121325',
				primary: '#7c83fd',
				secondary: '#96baff',
				accent: '#7dedff',
				footer: '#121325',
				navbar: '#121325',
				grayed:"#6a7282"
			},
			animation: {
				fadeIn: 'fadeIn 0.2s ease-in-out',
				slideIn: 'slideIn 0.2s ease-in-out',
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' },
				},
				slideIn: {
					'0%': { transform: 'translateY(-10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' },
				},
			},
			scale: {
				'102': '1.02',
				'98': '0.98',
			},
		},
	},
	plugins: [],
};
