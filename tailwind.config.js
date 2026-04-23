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
        // Ambra/oro - colore principale (tetto bancarelle, CTA, badge)
        amber: {
          brand: '#BA7517',
          light: '#FAEEDA',
          mid:   '#FAC775',
          dark:  '#8A5711',  // Hover/press, testo su sfondo chiaro
          deep:  '#5B3A08',  // Titoli hero, massimo contrasto su crema
        },
        // Sage - accento secondario (OK / conferma / bancarella libera)
        sage: {
          50:  '#F1F4F0',
          100: '#E0E7DE',
          300: '#A7B9A0',
          500: '#6B8064',
          700: '#455843',
        },
        // Cream - sfondo warm neutral (card, sezioni hero)
        cream: {
          50:  '#FDFBF5',
          100: '#F8F3E7',
          200: '#EEE4CC',
        },
      },
      fontFamily: {
        sans:  ['var(--font-sans)', 'system-ui', 'sans-serif'],
        brand: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      // Box shadow piu' morbide e calde per matchare la palette crema
      boxShadow: {
        warm:     '0 1px 3px 0 rgba(91, 58, 8, 0.08), 0 1px 2px -1px rgba(91, 58, 8, 0.06)',
        'warm-lg':'0 4px 12px -2px rgba(91, 58, 8, 0.12), 0 2px 4px -2px rgba(91, 58, 8, 0.08)',
      },
    },
  },
  plugins: [],
}
