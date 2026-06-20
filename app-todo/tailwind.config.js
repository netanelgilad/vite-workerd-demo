/** @type {import('tailwindcss').Config} */
export default {
  content: {
    // relative: resolve globs against this config file, not process.cwd()
    relative: true,
    files: ['./index.html', './src/**/*.{ts,tsx}'],
  },
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#2f6fed',
          600: '#2459c9',
          700: '#1d4fc4',
        },
      },
    },
  },
  plugins: [],
}
