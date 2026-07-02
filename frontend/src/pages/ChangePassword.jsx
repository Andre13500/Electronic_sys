import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function ChangePassword() {
  const nav = useNavigate()
  const { onPasswordChanged, logout } = useAuth()
  const [form, setForm] = useState({ passwordActual: '', passwordNuevo: '', confirmar: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (form.passwordNuevo !== form.confirmar) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }
    if (form.passwordNuevo.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    setLoading(true)
    try {
      const { data } = await authApi.changePassword(form.passwordActual, form.passwordNuevo)
      onPasswordChanged(data.token)
      nav('/', { replace: true })
    } catch (e) {
      setError(e.response?.data?.error ?? 'Error al cambiar la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-warm-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-up">
        <div className="card p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-lg mx-auto mb-3">LG</div>
            <h1 className="text-xl font-semibold text-warm-ink">Cambia tu contraseña</h1>
            <p className="text-sm text-warm-mute mt-1">
              Tu cuenta requiere cambiar la contraseña antes de continuar.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Contraseña actual (temporal)</label>
              <input
                type="password"
                className="input"
                value={form.passwordActual}
                onChange={e => upd('passwordActual', e.target.value)}
                placeholder="Contraseña que te dio el administrador"
                required
              />
            </div>
            <div>
              <label className="label">Nueva contraseña</label>
              <input
                type="password"
                className="input"
                value={form.passwordNuevo}
                onChange={e => upd('passwordNuevo', e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>
            <div>
              <label className="label">Confirmar nueva contraseña</label>
              <input
                type="password"
                className="input"
                value={form.confirmar}
                onChange={e => upd('confirmar', e.target.value)}
                placeholder="Repite la nueva contraseña"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              {loading ? 'Guardando...' : 'Cambiar contraseña y continuar'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button onClick={() => { logout(); nav('/login') }} className="text-xs text-warm-mute hover:text-warm-ink">
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
