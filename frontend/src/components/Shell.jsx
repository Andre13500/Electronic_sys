import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { useTheme } from '../hooks/useTheme.jsx'
import { Avatar } from './ui.jsx'

// Migas de pan según la ruta actual.
function buildCrumbs(pathname) {
  const crumbs = [{ label: 'Inicio', to: '/' }]
  if (pathname.startsWith('/nuevo-informe')) crumbs.push({ label: 'Nuevo informe' })
  else if (pathname.includes('/preview')) crumbs.push({ label: 'Informe', to: pathname.replace('/preview', '') }, { label: 'Vista previa' })
  else if (pathname.startsWith('/informes/')) crumbs.push({ label: 'Editar informe' })
  else if (pathname.startsWith('/perfil')) crumbs.push({ label: 'Mi perfil' })
  else if (pathname.startsWith('/admin')) crumbs.push({ label: 'Usuarios' })
  return crumbs
}

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      className="btn-ghost p-2 rounded-xl"
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label="Cambiar tema"
    >
      {isDark ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Cierra al hacer clic fuera o con Escape
  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  const go = (to) => { setOpen(false); nav(to) }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-warm-bg transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar nombre={user?.nombre} size="md" />
        <div className="hidden sm:block text-left leading-tight">
          <div className="text-sm font-semibold text-warm-ink max-w-[140px] truncate">{user?.nombre}</div>
          <div className="text-[11px] text-warm-mute">{user?.rol}</div>
        </div>
        <svg className={`w-4 h-4 text-warm-mute transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 menu-panel z-50" role="menu">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1 border-b border-warm-line">
            <Avatar nombre={user?.nombre} size="md" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-warm-ink truncate">{user?.nombre}</div>
              <div className="text-[11px] text-warm-mute truncate">{user?.email}</div>
            </div>
          </div>
          <button className="menu-item" onClick={() => go('/perfil')} role="menuitem">
            <span className="text-base">👤</span> Mi Perfil
          </button>
          <button className="menu-item" onClick={() => go('/perfil#preferencias')} role="menuitem">
            <span className="text-base">⚙️</span> Configuración
          </button>
          <div className="my-1 h-px bg-warm-line" />
          <button
            className="menu-item text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
            onClick={() => { setOpen(false); logout(); nav('/login') }}
            role="menuitem"
          >
            <span className="text-base">🚪</span> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export default function Shell() {
  const { user } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const isAdmin = user?.rol === 'Admin'
  const crumbs = buildCrumbs(loc.pathname)

  // Atajos de teclado globales (se ignoran mientras se escribe en un campo)
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return
      if (e.key === 'n') { e.preventDefault(); nav('/nuevo-informe') }
      else if (e.key === 'p') { e.preventDefault(); nav('/perfil') }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [nav])

  return (
    <div className="min-h-screen flex flex-col bg-warm-bg">
      <header className="sticky top-0 z-40 card-glass rounded-none border-x-0 border-t-0">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <button onClick={() => nav('/')} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">LG</div>
            <div className="leading-tight text-left hidden sm:block">
              <div className="font-semibold text-sm text-warm-ink">Informes</div>
              <div className="text-[11px] text-warm-mute">Instalación</div>
            </div>
          </button>

          <div className="flex items-center gap-1.5">
            <nav className="hidden sm:flex items-center gap-1">
              <button
                onClick={() => nav('/')}
                className={`btn-ghost text-sm ${loc.pathname === '/' ? 'text-brand-600 font-medium bg-brand-50 dark:bg-brand-600/15' : ''}`}
              >
                Mis informes
              </button>
              {isAdmin && (
                <button
                  onClick={() => nav('/admin')}
                  className={`btn-ghost text-sm ${loc.pathname === '/admin' ? 'text-brand-600 font-medium bg-brand-50 dark:bg-brand-600/15' : ''}`}
                >
                  Usuarios
                </button>
              )}
            </nav>

            <ThemeToggle />
            <div className="w-px h-6 bg-warm-line hidden sm:block" />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Migas de pan */}
      <div className="max-w-5xl mx-auto w-full px-4 pt-4">
        <nav className="flex items-center gap-1.5 text-xs text-warm-mute" aria-label="Migas de pan">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="opacity-50">/</span>}
              {c.to && i < crumbs.length - 1 ? (
                <button onClick={() => nav(c.to)} className="hover:text-brand-600 transition-colors">{c.label}</button>
              ) : (
                <span className={i === crumbs.length - 1 ? 'text-warm-ink font-medium' : ''}>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
