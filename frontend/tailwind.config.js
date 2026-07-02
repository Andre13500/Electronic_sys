/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class', // el tema oscuro se activa con la clase .dark en <html>
  theme: {
    extend: {
      colors: {
        // Identidad LG — el rojo de marca NO cambia entre temas
        brand: {
          50:  '#fef2f4',
          100: '#fde6ea',
          200: '#fbd0d8',
          300: '#f3a6b5',
          400: '#e85f78',
          500: '#d63c5b',
          600: '#a50034',  // rojo LG oficial
          700: '#8a002c',
        },
        // Colores de superficie basados en variables CSS (definidas en index.css).
        // Cambian automáticamente entre tema claro y oscuro, por lo que todas las
        // clases existentes (bg-warm-bg, text-warm-ink, border-warm-line, ...) se
        // vuelven theme-aware sin tocar el marcado de los componentes.
        warm: {
          bg:   'rgb(var(--warm-bg) / <alpha-value>)',
          card: 'rgb(var(--warm-card) / <alpha-value>)',
          ink:  'rgb(var(--warm-ink) / <alpha-value>)',
          mute: 'rgb(var(--warm-mute) / <alpha-value>)',
          line: 'rgb(var(--warm-line) / <alpha-value>)',
        },
      },
      fontFamily: { sans: ['Inter','system-ui','sans-serif'] },
      boxShadow: {
        soft: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        card: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.12)',
        lift: '0 12px 32px -12px rgba(0,0,0,0.18), 0 4px 12px -6px rgba(165,0,52,0.10)',
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem' },
      keyframes: {
        'fade-in':   { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'fade-up':   { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in':  { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'slide-down':{ '0%': { opacity: '0', transform: 'translateY(-6px) scale(0.98)' }, '100%': { opacity: '1', transform: 'translateY(0) scale(1)' } },
        'toast-in':  { '0%': { opacity: '0', transform: 'translateX(16px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        shimmer:     { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in':   'fade-in 0.25s ease both',
        'fade-up':   'fade-up 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in':  'scale-in 0.2s ease both',
        'slide-down':'slide-down 0.18s cubic-bezier(0.22,1,0.36,1) both',
        'toast-in':  'toast-in 0.3s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
}
