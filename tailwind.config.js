/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // CAC deck palette. Home/away keep their team colours.
      colors: {
        ink: '#0B0D0B',
        paper: '#FFFFFF',
        accent: { DEFAULT: '#6BDB58', ink: '#23801A', soft: '#EFFAEC' },
        panel: '#F0F2EE',
        line: '#D6DBD3',
        muted: '#5B6359',
        home: '#0077B6',
        away: '#D90429',
      },
      fontFamily: {
        display: ['Archivo', '"Arial Black"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        sans: ['Inter', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
