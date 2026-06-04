/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fef2f4',
          100: '#fde6ea',
          200: '#fbd0d8',
          400: '#e85f78',
          500: '#d63c5b',
          600: '#a50034',  // rojo LG oficial
          700: '#8a002c',
        },
        warm: {
          bg:    '#fafaf7',
          card:  '#ffffff',
          ink:   '#2b2b2b',
          mute:  '#6b7280',
          line:  '#ececec',
        }
      },
      fontFamily: { sans: ['Inter','system-ui','sans-serif'] },
      boxShadow: { soft: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)' },
    },
  },
  plugins: [],
}
