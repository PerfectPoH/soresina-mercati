/** @type {import('tailwindcss').Config} */
module.exports = {
  // darkMode 'class': il tema si attiva via classe `dark` su <html>.
  // La classe viene impostata da ThemeToggle (preferenza salvata in
  // localStorage chiave `mercati-theme`). Uno script inline nel <head>
  // la applica prima del paint per evitare flash bianco in dark mode.
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        amber: {
          brand: '#BA7517',
          light: '#FAEEDA',
          mid:   '#FAC775',
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
