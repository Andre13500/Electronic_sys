import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Login() {
  const { login, user } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      const data = await login(email, password)
      // Si el admin asignó contraseña temporal, redirigir a cambio obligatorio
      nav(data.mustChangePassword ? '/change-password' : '/', { replace: true })
    } catch {
      setErr('Credenciales inválidas')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-warm-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold text-lg shadow-soft">LG</div>
          <h1 className="mt-4 text-xl font-semibold text-warm-ink">Electronic Forms</h1>
          <p className="text-sm text-warm-mute mt-1">Inicia sesión para continuar</p>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="label">Correo</label>
            <input className="input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input className="input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} required />
          </div>
          {err && <div className="text-sm text-brand-600 bg-brand-50 rounded-lg px-3 py-2">{err}</div>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <div className="mt-4 text-center text-xs text-warm-mute">
          Demo: <code className="text-warm-ink">tecnico@empresa.com</code> / <code className="text-warm-ink">tecnico123</code>
        </div>
      </div>
    </div>
  )
}
