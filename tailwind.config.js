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
        /* DeepSeek's blue. */
        primary: '#4d6bfe',
        /* Surfaces are separated by tone rather than borders — the reference
           apps use almost no visible rules. */
        ground: { light: '#ffffff', dark: '#111418' },
        surface: { light: '#ffffff', dark: '#1a1e24' },
        sunk: { light: '#f4f5f7', dark: '#20252c' },
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
