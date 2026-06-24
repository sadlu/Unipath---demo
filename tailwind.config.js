/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'unipath-bg': '#13111C',
        'unipath-secondary': '#1C192C',
        'unipath-card': '#1E1B2E',
        'unipath-border': '#2D2A3E',
        'unipath-purple': '#7C5CFC',
        'unipath-glow': '#6D4FF2',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
