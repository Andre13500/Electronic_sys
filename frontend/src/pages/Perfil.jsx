import { useEffect, useRef, useState } from 'react'
import { authApi } from '../services/api'
import { useAuth } from '../hooks/useAuth.jsx'
import { useTheme } from '../hooks/useTheme.jsx'
import { useToast } from '../components/Toast.jsx'
import { Avatar, Skeleton } from '../components/ui.jsx'

const fmtFecha = (d) => new Date(d).toLocaleDateString('es-EC', {
  day: '2-digit', month: 'long', year: 'numeric'
})

const ROL_LABEL = { Admin: 'Administrador', Tecnico: 'Técnico' }

export default function Perfil() {
  const { user, onPasswordChanged } = useAuth()
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let activo = true
    authApi.me()
      .then(({ data }) => { if (activo) setPerfil(data) })
      .catch(() => { /* fallback al user del contexto */ })
      .finally(() => { if (activo) setLoading(false) })
    return () => { activo = false }
  }, [])

  // Combina datos del contexto con los del endpoint (que incluye fecha de creación)
  const datos = perfil ?? user

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h2 className="text-2xl font-bold text-warm-ink tracking-tight">Mi Perfil</h2>
        <p className="text-sm text-warm-mute mt-0.5">Gestiona tu información personal y la seguridad de tu cuenta.</p>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tarjeta de identidad */}
        <div className="card p-6 lg:row-span-2 flex flex-col items-center text-center">
          <Avatar nombre={datos?.nombre} size="lg" className="!w-20 !h-20 !text-2xl mb-4" />
          <div className="text-lg font-bold text-warm-ink">{datos?.nombre}</div>
          <div className="text-sm text-warm-mute">{datos?.email}</div>
          <span className={`badge mt-3 ${datos?.rol === 'Admin'
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-200'
            : 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'}`}>
            {ROL_LABEL[datos?.rol] ?? datos?.rol}
          </span>
          {loading ? (
            <Skeleton className="h-4 w-32 mt-6" />
          ) : perfil?.creadoEn && (
            <div className="mt-6 pt-5 border-t border-warm-line w-full">
              <div className="text-[11px] font-medium text-warm-mute uppercase tracking-wide">Miembro desde</div>
              <div className="text-sm text-warm-ink mt-0.5">{fmtFecha(perfil.creadoEn)}</div>
            </div>
          )}
        </div>

        {/* Datos detallados */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-warm-ink mb-4">Información de la cuenta</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="Nombre" value={datos?.nombre} loading={loading && !datos} />
            <InfoRow label="Usuario" value={datos?.email} loading={loading && !datos} />
            <InfoRow label="Correo electrónico" value={datos?.email} loading={loading && !datos} />
            <InfoRow label="Rol" value={ROL_LABEL[datos?.rol] ?? datos?.rol} loading={loading && !datos} />
            <InfoRow label="Fecha de creación" value={perfil?.creadoEn ? fmtFecha(perfil.creadoEn) : '—'} loading={loading} />
          </div>
        </div>

        {/* Preferencias (tema) */}
        <Preferencias />
      </div>

      {/* Cambio de contraseña */}
      <CambiarPassword onPasswordChanged={onPasswordChanged} />
    </div>
  )
}

function InfoRow({ label, value, loading }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-warm-mute uppercase tracking-wide mb-1">{label}</div>
      {loading
        ? <Skeleton className="h-5 w-40" />
        : <div className="text-sm text-warm-ink font-medium break-words">{value || <span className="text-warm-mute italic">No disponible</span>}</div>}
    </div>
  )
}

function Preferencias() {
  const { isDark, toggleTheme } = useTheme()
  // Permite que "Configuración" (con #preferencias) haga scroll hasta aquí
  const ref = useRef(null)
  useEffect(() => {
    if (window.location.hash === '#preferencias') {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  return (
    <div id="preferencias" ref={ref} className="card p-6 lg:col-span-2 scroll-mt-24">
      <h3 className="text-sm font-semibold text-warm-ink mb-4">Preferencias</h3>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-warm-ink">Apariencia</div>
          <div className="text-xs text-warm-mute mt-0.5">Cambia entre modo claro y oscuro.</div>
        </div>
        <button
          onClick={toggleTheme}
          role="switch"
          aria-checked={isDark}
          className={`relative w-14 h-8 rounded-full transition-colors duration-300 shrink-0 ${isDark ? 'bg-brand-600' : 'bg-warm-line'}`}
        >
          <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center text-[11px] transition-transform duration-300 ${isDark ? 'translate-x-6' : ''}`}>
            {isDark ? '🌙' : '☀️'}
          </span>
        </button>
      </div>
    </div>
  )
}

function CambiarPassword({ onPasswordChanged }) {
  const toast = useToast()
  const [form, setForm] = useState({ actual: '', nueva: '', confirmar: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const upd = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })) }

  const validar = () => {
    const e = {}
    if (!form.actual) e.actual = 'Ingresa tu contraseña actual.'
    if (form.nueva.length < 6) e.nueva = 'Mínimo 6 caracteres.'
    if (form.nueva && form.nueva === form.actual) e.nueva = 'Debe ser distinta a la actual.'
    if (form.confirmar !== form.nueva) e.confirmar = 'Las contraseñas no coinciden.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async (ev) => {
    ev.preventDefault()
    if (!validar()) return
    setLoading(true)
    try {
      const { data } = await authApi.changePassword(form.actual, form.nueva)
      onPasswordChanged?.(data.token)
      setForm({ actual: '', nueva: '', confirmar: '' })
      toast.success('Contraseña actualizada correctamente.')
    } catch (err) {
      const msg = err.response?.data?.error ?? 'No se pudo cambiar la contraseña.'
      // El backend devuelve "Contraseña actual incorrecta."
      if (/actual/i.test(msg)) setErrors(e => ({ ...e, actual: msg }))
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">🔒</span>
        <h3 className="text-sm font-semibold text-warm-ink">Cambiar contraseña</h3>
      </div>
      <p className="text-xs text-warm-mute mb-5">Por seguridad, necesitas confirmar tu contraseña actual.</p>
      <form onSubmit={submit} className="space-y-4">
        <PasswordField label="Contraseña actual" value={form.actual}
          onChange={v => upd('actual', v)} error={errors.actual} autoComplete="current-password" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PasswordField label="Nueva contraseña" value={form.nueva}
            onChange={v => upd('nueva', v)} error={errors.nueva} hint="Mínimo 6 caracteres" autoComplete="new-password" />
          <PasswordField label="Confirmar nueva contraseña" value={form.confirmar}
            onChange={v => upd('confirmar', v)} error={errors.confirmar} autoComplete="new-password" />
        </div>
        <div className="flex justify-end pt-1">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </div>
      </form>
    </div>
  )
}

function PasswordField({ label, value, onChange, error, hint, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className={`input pr-10 ${error ? '!border-red-400 focus:!ring-red-500/15' : ''}`}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button type="button" onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-mute hover:text-warm-ink"
          tabIndex={-1} aria-label={show ? 'Ocultar' : 'Mostrar'}>
          {show ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A9.5 9.5 0 0 1 12 4c5 0 9 4.5 9 8a12 12 0 0 1-2.2 3.4M6.1 6.1A12 12 0 0 0 3 12c0 3.5 4 8 9 8 1.4 0 2.7-.3 3.9-.9" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {error
        ? <p className="text-[11px] text-red-500 mt-1">{error}</p>
        : hint && <p className="text-[11px] text-warm-mute mt-1">{hint}</p>}
    </div>
  )
}
