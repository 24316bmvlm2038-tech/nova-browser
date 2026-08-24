/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0b7a5e',
        /* Surfaces are separated by tone rather than borders — the reference
           apps use almost no visible rules. */
        ground: { light: '#f7f8f8', dark: '#0d100f' },
        surface: { light: '#ffffff', dark: '#171a19' },
        sunk: { light: '#f0f2f1', dark: '#1e2321' },
      },
      borderRadius: {
        composer: '26px',
        card: '20px',
      },
      fontSize: {
        /* Large, light headline — the friendly register these apps use. */
        hero: ['32px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
      },
    },
  },
  plugins: [],
};
