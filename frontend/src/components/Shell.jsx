import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Shell() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const isAdmin = user?.rol === 'Admin'

  return (
    <div className="min-h-screen flex flex-col bg-warm-bg">
      <header className="bg-white border-b border-warm-line">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button onClick={() => nav('/')} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-sm">LG</div>
            <div className="leading-tight text-left">
              <div className="font-semibold text-sm text-warm-ink">Informes</div>
              <div className="text-[11px] text-warm-mute">Instalación</div>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {/* Menú de navegación */}
            <nav className="hidden sm:flex items-center gap-1">
              <button
                onClick={() => nav('/')}
                className={`btn-ghost text-sm ${loc.pathname === '/' ? 'text-brand-600 font-medium' : ''}`}
              >
                Mis informes
              </button>
              {/* El panel de admin solo aparece para usuarios con rol Admin */}
              {isAdmin && (
                <button
                  onClick={() => nav('/admin')}
                  className={`btn-ghost text-sm ${loc.pathname === '/admin' ? 'text-brand-600 font-medium' : ''}`}
                >
                  Usuarios
                </button>
              )}
            </nav>

            <div className="w-px h-5 bg-warm-line hidden sm:block" />

            <div className="hidden sm:block text-right leading-tight">
              <div className="text-sm font-medium text-warm-ink">{user?.nombre}</div>
              <div className="text-[11px] text-warm-mute">{user?.rol}</div>
            </div>
            <button
              onClick={() => { logout(); nav('/login') }}
              className="btn-ghost text-sm"
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
