import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const Ctx = createContext(null)

// Lee el tema inicial: preferencia guardada o la del sistema operativo.
function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  // Aplica la clase .dark al <html> y persiste la preferencia.
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    // Activa la transición animada solo durante el cambio manual
    const root = document.documentElement
    root.classList.add('theme-anim')
    window.setTimeout(() => root.classList.remove('theme-anim'), 350)
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <Ctx.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTheme() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme fuera de ThemeProvider')
  return v
}
