/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,jsx,js}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', 'ui-sans-serif', 'Inter', 'sans-serif'],
      },
      colors: {
        bg: '#050816',
        accent: '#ff6bcb',
        accentSoft: '#7f5af0',
        card: '#0b1022',
      },
      boxShadow: {
        glow: '0 0 40px rgba(255, 107, 203, 0.45)',
      },
    },
  },
  plugins: [],
}
